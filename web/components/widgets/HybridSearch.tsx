"use client";
// Day 08: dense vs BM25 vs Reciprocal Rank Fusion over the handbook, ranks side by side.
import { useMemo, useState } from "react";
import { HybridIndex, type Ranked, handbookChunks } from "@/lib/rag";
import type { WidgetProps } from ".";

// The first three are the queries days/day-08-hybrid-search/hybrid.py prints.
const PRESETS = ["error 409", "how do I get my money back", "SEV1 status page update frequency", "requests per minute on Pro", "SAML single sign-on"];

export default function HybridSearch({ data }: WidgetProps) {
  const index = useMemo(() => new HybridIndex(handbookChunks(data.docs)), [data.docs]);
  const [q, setQ] = useState(PRESETS[0]);
  const [k, setK] = useState(60);
  const [top, setTop] = useState(5);
  const [hover, setHover] = useState<string | null>(null);

  const dense = useMemo(() => index.dense(q), [index, q]);
  const sparse = useMemo(() => index.sparse(q), [index, q]);
  const fused = useMemo(() => index.hybrid(q, k), [index, q, k]);
  const rankIn = (list: Ranked[], id: string) => {
    const i = list.findIndex((r) => r.id === id);
    return i >= 0 && i < 20 ? i + 1 : null;
  };

  const column = (title: string, sub: string, list: Ranked[], fmt: (n: number) => string, extra?: (id: string) => React.ReactNode) => (
    <section className="rank-col">
      <h4>{title} <span className="muted small">{sub}</span></h4>
      {list.length === 0 && <p className="muted small">No document contains any query term.</p>}
      <ol>
        {list.slice(0, top).map((r, i) => {
          const c = index.byId(r.id)!;
          return (
            <li key={r.id} className={`hit ${hover === r.id ? "on" : ""}`} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}>
              <span className="hit-rank">{i + 1}</span>
              <span className="hit-main">
                <b>{c.section || c.source}</b>
                <span className="muted small">{c.source}.md · {fmt(r.score)}{extra?.(r.id)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );

  return (
    <div className="widget">
      <div className="lab-search wide" style={{ marginBottom: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask the Nimbus Cloud handbook…" aria-label="Query" />
      </div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {PRESETS.map((p) => <button key={p} type="button" className={`filter-chip ${q === p ? "on" : ""}`} onClick={() => setQ(p)}>{p}</button>)}
      </div>
      <div className="controls">
        <label>RRF k <input type="range" min={1} max={100} value={k} onChange={(e) => setK(+e.target.value)} /> <span className="stat">{k}</span></label>
        <label>show top <input type="range" min={3} max={8} value={top} onChange={(e) => setTop(+e.target.value)} /> <span className="stat">{top}</span></label>
        <span className="muted small">{index.chunks.length} heading-aware chunks from {data.docs.length} files</span>
      </div>
      <div className="rank-cols">
        {column("Dense", "hashing embedder · cosine", dense, (n) => `cos ${n.toFixed(3)}`)}
        {column("BM25", "keywords", sparse, (n) => `bm25 ${n.toFixed(2)}`)}
        {column("Hybrid", "RRF fusion", fused, (n) => `rrf ${n.toFixed(4)}`, (id) => (
          <> · dense #{rankIn(dense, id) ?? "–"}, bm25 #{rankIn(sparse, id) ?? "–"}</>
        ))}
      </div>
      <p className="muted small" style={{ margin: "10px 0 0" }}>
        RRF ignores raw scores and adds <code>1 / (k + rank)</code> from each list, so a chunk ranked well by both wins. Small <code>k</code> rewards the very top ranks; the usual 60
        smooths that out. Try an exact identifier like “SEV1”, then a paraphrase like “money back”.
      </p>
    </div>
  );
}
