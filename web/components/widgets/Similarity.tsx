"use client";
// Day 02: cosine similarity between sentences with the course's hashing embedder.
import { useMemo, useState } from "react";
import { cosine, hashingEmbed } from "@/lib/rag";
import type { WidgetProps } from ".";

const START = [
  "How do I get a refund on my annual plan?",
  "Refunds for annual plans are prorated.",
  "Can I get my money back after a year?",
  "Our SEV1 incident process pages the on-call engineer.",
  "What is the API rate limit on the Pro plan?",
];

export default function Similarity(_: WidgetProps) {
  const [texts, setTexts] = useState(START);
  const vectors = useMemo(() => texts.map((t) => hashingEmbed(t)), [texts]);
  const [focus, setFocus] = useState<[number, number] | null>([0, 2]);

  return (
    <div className="widget">
      <div className="sim-inputs">
        {texts.map((t, i) => (
          <label key={i} className="sim-input">
            <span className="sim-tag">S{i + 1}</span>
            <input value={t} onChange={(e) => setTexts((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Sentence ${i + 1}`} />
          </label>
        ))}
      </div>
      <div className="table-wrap sim-table">
        <table>
          <thead>
            <tr><th scope="col"><span className="sr-only">Sentence</span></th>{texts.map((_, j) => <th key={j} scope="col">S{j + 1}</th>)}</tr>
          </thead>
          <tbody>
            {texts.map((_, i) => (
              <tr key={i}>
                <th scope="row">S{i + 1}</th>
                {texts.map((__, j) => {
                  const s = cosine(vectors[i], vectors[j]);
                  const on = focus && ((focus[0] === i && focus[1] === j) || (focus[0] === j && focus[1] === i));
                  return (
                    <td key={j} className={`sim-cell ${on ? "on" : ""}`} style={{ "--s": Math.max(0, s) } as React.CSSProperties} onMouseEnter={() => setFocus([i, j])} onFocus={() => setFocus([i, j])} tabIndex={0}>
                      {s.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {focus && focus[0] !== focus[1] && (
        <p className="stat">
          S{focus[0] + 1} vs S{focus[1] + 1}: cosine {cosine(vectors[focus[0]], vectors[focus[1]]).toFixed(3)}
        </p>
      )}
      <p className="muted small" style={{ margin: "8px 0 0" }}>
        This is the course&apos;s <code>HashingEmbedder</code>: it only sees shared words and letter groups. S1 and S3 mean the same thing but share few words, so they score low.
        A real model (<code>all-MiniLM-L6-v2</code>, used when <code>sentence-transformers</code> is installed) puts them close together. That gap is why semantic embeddings matter.
      </p>
    </div>
  );
}
