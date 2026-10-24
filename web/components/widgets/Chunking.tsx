"use client";
// Day 04: the three chunkers from rag_common/chunking.py on a handbook page.
import { useMemo, useState } from "react";
import { chunkByHeadings, chunkFixed, chunkRecursive } from "@/lib/rag";
import type { WidgetProps } from ".";

type Strategy = "fixed" | "recursive" | "headings";
const LABEL: Record<Strategy, string> = { fixed: "Fixed size", recursive: "Recursive", headings: "Heading-aware" };

export default function Chunking({ data }: WidgetProps) {
  const [doc, setDoc] = useState(data.docs.find((d) => d.name === "pricing.md")?.name ?? data.docs[0]?.name ?? "");
  const [strategy, setStrategy] = useState<Strategy>("fixed");
  const [size, setSize] = useState(300);
  const [overlap, setOverlap] = useState(50);
  const text = data.docs.find((d) => d.name === doc)?.text ?? "";

  const chunks = useMemo(() => {
    if (strategy === "fixed") return chunkFixed(text, size, Math.min(overlap, size - 1)).map((t) => ({ text: t, section: "" }));
    if (strategy === "recursive") return chunkRecursive(text, size).map((t) => ({ text: t, section: "" }));
    return chunkByHeadings(text, size);
  }, [text, strategy, size, overlap]);

  const lengths = chunks.map((c) => c.text.length);
  // A chunk that starts or ends mid-word is the classic sign of a bad split.
  const cut = chunks.filter((c) => /\w$/.test(c.text.trimEnd()) && !/[.:!?)\]*]$/.test(c.text.trimEnd()) && c.text.length >= size - 1).length;
  const avg = lengths.length ? Math.round(lengths.reduce((a, n) => a + n, 0) / lengths.length) : 0;

  return (
    <div className="widget">
      <div className="controls">
        <label>Document
          <select value={doc} onChange={(e) => setDoc(e.target.value)}>
            {data.docs.map((d) => <option key={d.name}>{d.name}</option>)}
          </select>
        </label>
        <div className="segmented" role="group" aria-label="Chunking strategy">
          {(Object.keys(LABEL) as Strategy[]).map((s) => (
            <button key={s} type="button" className={strategy === s ? "on" : ""} aria-pressed={strategy === s} onClick={() => setStrategy(s)}>{LABEL[s]}</button>
          ))}
        </div>
        <label>size <input type="range" min={80} max={1200} step={20} value={size} onChange={(e) => setSize(+e.target.value)} /> <span className="stat">{size}</span></label>
        {strategy === "fixed" && (
          <label>overlap <input type="range" min={0} max={Math.min(300, size - 20)} step={10} value={Math.min(overlap, size - 20)} onChange={(e) => setOverlap(+e.target.value)} /> <span className="stat">{Math.min(overlap, size - 20)}</span></label>
        )}
      </div>
      <div className="meta-row" style={{ marginBottom: 12 }}>
        <span className="pill accent">{chunks.length} chunks</span>
        <span className="pill">avg {avg} chars</span>
        <span className="pill">min {Math.min(...lengths, 0) || 0} · max {Math.max(...lengths, 0)}</span>
        {strategy === "fixed" ? <span className={`pill ${cut ? "warn" : "good"}`}>{cut} cut mid-sentence</span> : <span className="pill good">splits on natural boundaries</span>}
      </div>
      <ol className="chunk-list">
        {chunks.map((c, i) => (
          <li key={i} className="chunk" style={{ "--hue": (i * 47) % 360 } as React.CSSProperties}>
            <div className="chunk-head">
              <span>#{i + 1}</span>
              {c.section && <span className="chunk-section">{c.section}</span>}
              <span className="spacer" />
              <span>{c.text.length} chars</span>
            </div>
            <pre className="chunk-text">
              {strategy === "fixed" && i > 0 && overlap > 0 ? (
                <>
                  <mark title="Overlap with the previous chunk">{c.text.slice(0, Math.min(overlap, size - 20))}</mark>
                  {c.text.slice(Math.min(overlap, size - 20))}
                </>
              ) : (
                c.text
              )}
            </pre>
          </li>
        ))}
      </ol>
      <p className="muted small" style={{ margin: "10px 0 0" }}>
        Highlighted text is overlap, repeated so a fact that straddles a boundary survives in at least one chunk. Heading-aware chunks start with their section path
        (<code>Pricing &gt; Plans &gt; Pro</code>), which is what lets a question about “Pro” find the right price.
      </p>
    </div>
  );
}
