"""Code-aware chunking and search over a repository."""

from __future__ import annotations

import ast
import fnmatch
from pathlib import Path

from rag_common import Chunk, HybridIndex

CODE_EXTS = {".py", ".js", ".ts", ".tsx", ".go", ".java", ".rs", ".rb", ".md", ".toml", ".yaml", ".yml", ".json"}
SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", ".rag_index", "chroma_db"}


def python_chunks(path: str, source: str) -> list[Chunk]:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []
    lines, out = source.splitlines(), []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            start, end = node.lineno, node.end_lineno or node.lineno
            body = "\n".join(lines[start - 1 : end])
            if len(body) > 4000:  # very long classes: keep the head (signature, docstring, first methods)
                body = body[:4000] + "\n    ..."
            kind = "class" if isinstance(node, ast.ClassDef) else "def"
            out.append(Chunk(f"# {path}:{start}-{end} ({kind} {node.name})\n{body}",
                             {"path": path, "start": start, "end": end, "symbol": node.name}))
    return out


def window_chunks(path: str, source: str, size: int = 60) -> list[Chunk]:
    lines = source.splitlines()
    return [
        Chunk(f"# {path}:{i + 1}-{min(i + size, len(lines))}\n" + "\n".join(lines[i : i + size]),
              {"path": path, "start": i + 1, "end": min(i + size, len(lines))})
        for i in range(0, len(lines), size)
    ]


class CodeIndex:
    def __init__(self, repo: str | Path):
        self.repo = Path(repo).resolve()
        self.files = sorted(
            p for p in self.repo.rglob("*")
            if p.is_file() and p.suffix in CODE_EXTS and not SKIP_DIRS & set(p.relative_to(self.repo).parts)
            and p.stat().st_size < 300_000
        )
        chunks = []
        for p in self.files:
            rel, src = str(p.relative_to(self.repo)), p.read_text(errors="ignore")
            file_chunks = python_chunks(rel, src) if p.suffix == ".py" else []
            chunks += file_chunks or window_chunks(rel, src)
        for i, c in enumerate(chunks):
            c.metadata["chunk_id"] = f"{c.metadata['path']}:{c.metadata['start']}#{i}"
        self.index = HybridIndex(chunks)

    def search_code(self, query: str, k: int = 6) -> str:
        return "\n\n".join(c.text[:1500] for c in self.index.search(query, k=k)) or "No matches."

    def read_file(self, path: str, start: int = 1, end: int = 200) -> str:
        target = (self.repo / path).resolve()
        if self.repo not in target.parents or not target.is_file():
            raise ValueError(f"{path} is not a file inside the repository")
        lines = target.read_text(errors="ignore").splitlines()
        end = min(end, start + 400, len(lines))
        return "\n".join(f"{n:>5}  {lines[n - 1]}" for n in range(max(start, 1), end + 1))

    def list_files(self, pattern: str = "*") -> str:
        rels = [str(p.relative_to(self.repo)) for p in self.files]
        return "\n".join(r for r in rels if fnmatch.fnmatch(r, pattern))[:6000] or "No files match."
