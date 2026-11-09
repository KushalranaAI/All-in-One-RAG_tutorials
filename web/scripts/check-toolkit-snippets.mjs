// Runs every Python snippet in lib/toolkit-guide.ts so the Toolkit page never ships code that does not work:
//   - each example runs as written (those that call Claude are only syntax-checked),
//   - each "build it yourself" starter is syntax-checked,
//   - each check passes when run after a correct solution of its starter.
// Usage (from web/): node scripts/check-toolkit-snippets.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const { TOOLS } = await import(pathToFileURL(path.join(here, "..", "lib", "toolkit-guide.ts")).href);

// A correct completion of each starter whose check can run without an API key.
const SOLUTIONS = {
  loaders: `from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Document:
    text: str
    metadata: dict = field(default_factory=dict)


def load_directory(path, exts=(".md", ".txt")):
    docs = []
    for p in sorted(Path(path).rglob("*")):
        if p.suffix.lower() in exts:
            docs.append(Document(p.read_text(encoding="utf-8", errors="ignore"), {"source": str(p), "title": p.stem}))
    return docs`,
  chunking: `def chunk_fixed(text: str, size: int = 800, overlap: int = 100) -> list[str]:
    if overlap >= size:
        raise ValueError("overlap must be smaller than size")
    step = size - overlap
    return [text[i : i + size] for i in range(0, max(len(text) - overlap, 1), step)]`,
  embeddings: `import hashlib

import numpy as np


class MyEmbedder:
    dim = 256

    def embed(self, texts):
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for row, text in enumerate(texts):
            for word in text.lower().split():
                column = int(hashlib.md5(word.encode()).hexdigest(), 16) % self.dim
                out[row, column] += 1
        out /= np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-9)
        return out`,
  vectorstore: `import numpy as np

from rag_common import get_embedder


class MyStore:
    def __init__(self):
        self.embedder = get_embedder()
        self.texts, self.metas = [], []
        self.vectors = np.zeros((0, self.embedder.dim), dtype=np.float32)

    def add(self, texts, metas=None):
        self.vectors = np.vstack([self.vectors, self.embedder.embed(texts)])
        self.texts += texts
        self.metas += metas or [{} for _ in texts]

    def search(self, query, k=4):
        scores = self.vectors @ self.embedder.embed([query])[0]
        return [(float(scores[i]), self.texts[i], self.metas[i]) for i in np.argsort(-scores)[:k]]`,
  index: `from rag_common import SimpleVectorStore, chunk_by_headings, load_directory


def build_index(folder: str) -> SimpleVectorStore:
    store = SimpleVectorStore()
    for doc in load_directory(folder):
        chunks = chunk_by_headings(doc.text)
        store.add([c.text for c in chunks], [{"title": doc.metadata["title"]} for _ in chunks])
    return store`,
  retrieval: `def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1 / (k + rank + 1)
    return sorted(scores.items(), key=lambda item: -item[1])`,
  prompts: `def format_context(hits) -> str:
    blocks = []
    for i, hit in enumerate(hits, 1):
        title = hit.metadata.get("title", "unknown")
        blocks.append(f'<source id="{i}" title="{title}">\\n{hit.text}\\n</source>')
    return "\\n\\n".join(blocks)`,
};

const env = { ...process.env, RAG_EMBEDDER: "hashing", PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "toolkit-"));
let failed = 0;

function py(label, code, { run = true } = {}) {
  const file = path.join(tmp, `${label.replace(/\W+/g, "_")}.py`);
  fs.writeFileSync(file, code);
  const args = run ? [file] : ["-c", `import ast,sys; ast.parse(open(sys.argv[1], encoding='utf-8').read())`, file];
  const r = spawnSync("python", args, { cwd: repo, env, encoding: "utf-8" });
  const ok = r.status === 0;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${run ? "" : " (syntax only)"}`);
  if (!ok) {
    failed++;
    console.log((r.stderr || r.stdout).split("\n").slice(-8).join("\n"));
  }
}

for (const t of TOOLS) {
  py(`${t.id}: example`, t.example, { run: !t.needsKey });
  py(`${t.id}: starter`, t.build.starter, { run: false });
  if (SOLUTIONS[t.id]) py(`${t.id}: solution + check`, `${SOLUTIONS[t.id]}\n\n${t.build.check}\n`);
  else if (!t.build.needsKey) { console.log(`FAIL ${t.id}: no solution to verify the check`); failed++; }
  else py(`${t.id}: check`, t.build.check, { run: false });
}
console.log(failed ? `\n${failed} snippet(s) failed` : "\nall toolkit snippets verified");
process.exit(failed ? 1 : 0);
