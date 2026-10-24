// The course's retrieval building blocks, ported line for line from rag_common/ so the in-browser lab behaves like the
// Python code: chunk_fixed / chunk_recursive / chunk_by_headings (chunking.py), BM25 + reciprocal_rank_fusion
// (retrieval.py) and HashingEmbedder (embeddings.py). One difference: HashingEmbedder hashes features with MD5; this
// uses FNV-1a, so individual scores differ slightly while the behaviour (lexical overlap only) is the same.

// ------------------------------------------------------------------------------------ chunking (Day 04)

export type Chunk = { text: string; section: string; source: string; id: string };

/** Fixed-size character windows with overlap. */
export function chunkFixed(text: string, size = 800, overlap = 100): string[] {
  if (overlap >= size) throw new Error("overlap must be smaller than size");
  const step = size - overlap;
  const out: string[] = [];
  for (let i = 0; i < Math.max(text.length - overlap, 1); i += step) out.push(text.slice(i, i + size));
  return out;
}

/** Split on the largest natural boundary that keeps pieces under `size`, then pack. */
export function chunkRecursive(text: string, size = 800, separators = ["\n\n", "\n", ". ", " "]): string[] {
  if (text.length <= size) return text.trim() ? [text.trim()] : [];
  const sep = separators.find((s) => text.includes(s));
  if (sep === undefined) return chunkFixed(text, size, 0);
  const pieces: string[] = [];
  for (const part of text.split(sep)) pieces.push(...(part.length > size ? chunkRecursive(part, size, separators) : [part]));
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    const candidate = current ? `${current}${sep}${piece}` : piece;
    if (candidate.length <= size) current = candidate;
    else {
      if (current.trim()) chunks.push(current.trim());
      current = piece;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Split markdown by headings; each chunk remembers its section path ("Pricing > Plans > Pro"). */
export function chunkByHeadings(markdown: string, maxSize = 1200): { text: string; section: string }[] {
  const chunks: { text: string; section: string }[] = [];
  const path: string[] = [];
  const buf: string[] = [];
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) {
      const section = path.join(" > ");
      for (const piece of chunkRecursive(body, maxSize)) chunks.push({ text: section ? `${section}\n\n${piece}` : piece, section });
    }
    buf.length = 0;
  };
  for (const line of markdown.split("\n")) {
    const m = /^(#{1,6})\s+(.*)/.exec(line);
    if (m) {
      flush();
      path.splice(m[1].length - 1, path.length, m[2].trim());
    } else buf.push(line);
  }
  flush();
  return chunks;
}

/** The handbook as the lessons index it: heading-aware chunks tagged with their source file. */
export function handbookChunks(docs: { name: string; text: string }[], maxSize = 1200): Chunk[] {
  return docs.flatMap((d) => chunkByHeadings(d.text, maxSize).map((c) => ({ ...c, source: d.name.replace(/\.md$/, "") }))).map((c, i) => ({ ...c, id: `chunk-${i}` }));
}

// ------------------------------------------------------------------------------------ keyword search (Day 08)

export const tokenize = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

export class BM25 {
  private docs: Map<string, number>[];
  private lengths: number[];
  private avgLen: number;
  readonly idf = new Map<string, number>();

  constructor(texts: string[], private k1 = 1.5, private b = 0.75) {
    this.docs = texts.map((t) => {
      const c = new Map<string, number>();
      for (const w of tokenize(t)) c.set(w, (c.get(w) ?? 0) + 1);
      return c;
    });
    this.lengths = this.docs.map((d) => [...d.values()].reduce((a, n) => a + n, 0));
    this.avgLen = this.lengths.reduce((a, n) => a + n, 0) / Math.max(this.docs.length, 1);
    const df = new Map<string, number>();
    for (const d of this.docs) for (const term of d.keys()) df.set(term, (df.get(term) ?? 0) + 1);
    const n = this.docs.length;
    for (const [term, f] of df) this.idf.set(term, Math.log(1 + (n - f + 0.5) / (f + 0.5)));
  }

  scores(query: string): number[] {
    const terms = tokenize(query);
    return this.docs.map((doc, i) => {
      let s = 0;
      for (const t of terms) {
        const tf = doc.get(t);
        if (tf) s += (this.idf.get(t) ?? 0) * tf * (this.k1 + 1) / (tf + this.k1 * (1 - this.b + this.b * this.lengths[i] / this.avgLen));
      }
      return s;
    });
  }
}

/** Merge several ranked lists of ids: score = Σ 1 / (k + rank). */
export function reciprocalRankFusion(rankings: string[][], k = 60): [string, number][] {
  const scores = new Map<string, number>();
  for (const ranking of rankings) ranking.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)));
  return [...scores].sort((a, b) => b[1] - a[1]);
}

// ------------------------------------------------------------------------------------ embeddings (Day 02)

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Same features as rag_common's HashingEmbedder: words, character 4-grams and word bigrams, hashed with a sign. */
export function hashingFeatures(text: string): string[] {
  const words = tokenize(text);
  const grams = words.flatMap((w) => Array.from({ length: Math.max(1, w.length - 3) }, (_, i) => w.slice(i, i + 4)));
  const bigrams = words.slice(1).map((w, i) => `${words[i]}_${w}`);
  return [...words, ...grams, ...bigrams];
}

export function hashingEmbed(text: string, dim = 1024): Float32Array {
  const v = new Float32Array(dim);
  for (const f of hashingFeatures(text)) {
    const h = fnv1a(f);
    v[h % dim] += fnv1a(`${f}#`) & 1 ? 1 : -1;
  }
  const norm = Math.hypot(...v);
  if (norm > 0) for (let i = 0; i < dim; i++) v[i] /= norm;
  return v;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// ------------------------------------------------------------------------------------ a small hybrid index (Day 08)

export type Ranked = { id: string; score: number };

export class HybridIndex {
  readonly chunks: Chunk[];
  private bm25: BM25;
  private vectors: Float32Array[];

  constructor(chunks: Chunk[]) {
    this.chunks = chunks;
    this.bm25 = new BM25(chunks.map((c) => c.text));
    this.vectors = chunks.map((c) => hashingEmbed(c.text));
  }

  sparse(query: string): Ranked[] {
    return this.bm25.scores(query).map((score, i) => ({ id: this.chunks[i].id, score })).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  }

  dense(query: string): Ranked[] {
    const q = hashingEmbed(query);
    return this.vectors.map((v, i) => ({ id: this.chunks[i].id, score: cosine(q, v) })).sort((a, b) => b.score - a.score);
  }

  hybrid(query: string, k = 60, candidates = 20): Ranked[] {
    const d = this.dense(query).slice(0, candidates).map((r) => r.id);
    const s = this.sparse(query).slice(0, candidates).map((r) => r.id);
    return reciprocalRankFusion([d, s], k).map(([id, score]) => ({ id, score }));
  }

  byId(id: string): Chunk | undefined {
    return this.chunks.find((c) => c.id === id);
  }
}

// ------------------------------------------------------------------------------------ evaluation (Day 14)

/** hit@k and reciprocal rank for one question, where relevance means "came from the expected source document". */
export function scoreRetrieval(sources: string[], expected: string, k: number): { hit: boolean; rr: number; rank: number | null } {
  const titles = [...new Set(sources)];
  const at = titles.indexOf(expected);
  return { hit: at >= 0 && at < k, rr: at >= 0 ? 1 / (at + 1) : 0, rank: at >= 0 ? at + 1 : null };
}
