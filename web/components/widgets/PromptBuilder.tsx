"use client";
// Days 06-07: retrieve → number the sources → the exact prompt rag_common/prompts.py sends to Claude.
import { useMemo, useState } from "react";
import { HybridIndex, handbookChunks } from "@/lib/rag";
import { CopyButton } from "../Markdown";
import type { WidgetProps } from ".";

// rag_common/prompts.py: RAG_SYSTEM
const RAG_SYSTEM = `You answer questions using only the provided sources.

Rules:
- Base every claim on the sources. Cite them inline like [1] or [2][3].
- If the sources do not contain the answer, say "I don't know based on the provided documents."
  and briefly say what is missing. Do not guess.
- Be concise and direct.`;

export default function PromptBuilder({ data }: WidgetProps) {
  const index = useMemo(() => new HybridIndex(handbookChunks(data.docs)), [data.docs]);
  const [q, setQ] = useState("Which plan includes SSO, and how fast is support for it?");
  const [k, setK] = useState(4);

  const hits = useMemo(() => index.hybrid(q).slice(0, k).map((r) => index.byId(r.id)!), [index, q, k]);
  // rag_common/prompts.py: format_context + rag_user_prompt
  const context = hits.map((c, i) => `<source id="${i + 1}" title="${c.source}">\n${c.text}\n</source>`).join("\n\n");
  const user = `<sources>\n${context}\n</sources>\n\nQuestion: ${q}`;
  // ~4 characters per token for English text: a rough guide, not the real tokenizer
  const tokens = Math.round((RAG_SYSTEM.length + user.length) / 4);

  return (
    <div className="widget">
      <div className="lab-search wide" style={{ marginBottom: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Question" />
      </div>
      <div className="controls">
        <label>top-k chunks <input type="range" min={1} max={8} value={k} onChange={(e) => setK(+e.target.value)} /> <span className="stat">{k}</span></label>
        <span className="pill">≈ {tokens.toLocaleString()} input tokens</span>
        <span className="spacer" />
        <CopyButton text={`SYSTEM:\n${RAG_SYSTEM}\n\nUSER:\n${user}`} label="Copy prompt" />
      </div>
      <div className="prompt-view">
        <div className="prompt-role">system</div>
        <pre>{RAG_SYSTEM}</pre>
        <div className="prompt-role">user</div>
        <pre>
          {"<sources>\n"}
          {hits.map((c, i) => (
            <span key={c.id} className="prompt-source" style={{ "--hue": (i * 67 + 190) % 360 } as React.CSSProperties}>
              {`<source id="${i + 1}" title="${c.source}">\n${c.text}\n</source>`}
              {i < hits.length - 1 ? "\n\n" : ""}
            </span>
          ))}
          {`\n</sources>\n\nQuestion: ${q}`}
        </pre>
      </div>
      <p className="muted small" style={{ margin: "10px 0 0" }}>
        Numbered sources are what make citations like <code>[1]</code> checkable. More chunks raise recall, but also cost and the chance of a distracting passage. Watch the token count as you change k.
      </p>
    </div>
  );
}
