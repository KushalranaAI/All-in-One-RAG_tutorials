"use client";
// Day 14: hit@k and MRR on data/eval_set.json for each retriever, like days/day-14-evaluation/evaluate.py.
import { useMemo, useState } from "react";
import { HybridIndex, handbookChunks, scoreRetrieval } from "@/lib/rag";
import type { WidgetProps } from ".";

type Retriever = "dense" | "sparse" | "hybrid";
const NAMES: Record<Retriever, string> = { dense: "Dense", sparse: "BM25", hybrid: "Hybrid (RRF)" };

export default function Evaluation({ data }: WidgetProps) {
  const index = useMemo(() => new HybridIndex(handbookChunks(data.docs)), [data.docs]);
  const [k, setK] = useState(3);
  const [show, setShow] = useState<Retriever>("hybrid");

  const results = useMemo(() => {
    const out = {} as Record<Retriever, { question: string; source: string; hit: boolean; rr: number; rank: number | null; got: string[] }[]>;
    for (const r of Object.keys(NAMES) as Retriever[]) {
      out[r] = data.evalSet.map((ex) => {
        const ranked = (r === "dense" ? index.dense(ex.question) : r === "sparse" ? index.sparse(ex.question) : index.hybrid(ex.question)).slice(0, 20);
        const sources = ranked.map((x) => index.byId(x.id)!.source);
        return { question: ex.question, source: ex.source, ...scoreRetrieval(sources, ex.source, k), got: [...new Set(sources)].slice(0, k) };
      });
    }
    return out;
  }, [index, data.evalSet, k]);

  const summary = (r: Retriever) => {
    const rows = results[r];
    return { hit: rows.filter((x) => x.hit).length / Math.max(rows.length, 1), mrr: rows.reduce((a, x) => a + x.rr, 0) / Math.max(rows.length, 1) };
  };
  const best = (Object.keys(NAMES) as Retriever[]).reduce((a, b) => (summary(b).mrr > summary(a).mrr ? b : a));

  return (
    <div className="widget">
      <div className="controls">
        <label>k <input type="range" min={1} max={5} value={k} onChange={(e) => setK(+e.target.value)} /> <span className="stat">{k}</span></label>
        <span className="muted small">{data.evalSet.length} questions from <code>data/eval_set.json</code>. Relevant means “from the expected source file”.</span>
      </div>
      <div className="eval-cards">
        {(Object.keys(NAMES) as Retriever[]).map((r) => {
          const s = summary(r);
          return (
            <button key={r} type="button" className={`eval-card ${show === r ? "on" : ""}`} onClick={() => setShow(r)} aria-pressed={show === r}>
              <span className="muted small">{NAMES[r]}{r === best ? " · best MRR" : ""}</span>
              <span className="stat-value">{Math.round(s.hit * 100)}<small>% hit@{k}</small></span>
              <span className="muted small">MRR {s.mrr.toFixed(3)}</span>
              <div className="bar" aria-hidden="true"><div style={{ width: `${s.hit * 100}%` }} /></div>
            </button>
          );
        })}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Question</th><th>Expected</th><th>Top {k} sources ({NAMES[show]})</th><th>Rank</th></tr></thead>
          <tbody>
            {results[show].map((x) => (
              <tr key={x.question}>
                <td>{x.question}</td>
                <td><code>{x.source}</code></td>
                <td className="small">{x.got.map((g) => <span key={g} className={`pill ${g === x.source ? "good" : ""}`} style={{ margin: "0 4px 4px 0" }}>{g}</span>)}</td>
                <td>{x.hit ? <span className="status-text good">{x.rank}</span> : <span className="status-text bad">{x.rank ?? "miss"}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small" style={{ margin: "10px 0 0" }}>
        hit@k: did the right document appear in the top k? MRR: the average of 1/rank, so rank 1 scores 1 and rank 2 scores 0.5. Change one thing at a time and re-measure; that habit is Day 14&apos;s whole point.
      </p>
    </div>
  );
}
