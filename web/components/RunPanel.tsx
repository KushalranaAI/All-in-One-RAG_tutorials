"use client";
import { useRef, useState } from "react";
import AskButton from "./ai/AskButton";
import { CopyButton } from "./Markdown";
import Icon from "./ui/Icon";

type Line = { kind: "out" | "err" | "info"; text: string };

const REPO = process.env.NEXT_PUBLIC_REPO_URL;

/** Quote an argument the way you'd type it in a terminal. */
const quote = (a: string) => (/[\s"'$`\\]/.test(a) ? `"${a.replace(/(["\\$`])/g, "\\$1")}"` : a);

/** The inverse of `quote` for the editable argument box: "a b" c → ["a b", "c"]. */
function splitArgs(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g)) out.push(m[1]?.replace(/\\(.)/g, "$1") ?? m[2] ?? m[3]);
  return out;
}

/** The hosted (GitHub Pages) copy has no server, so scripts can't run there: show the command to copy instead. */
function RunLocally({ script, args, note }: { script: string; args: string[]; note?: string }) {
  const command = `python ${script} ${args.map(quote).join(" ")}`.trim();
  return (
    <div className="run-panel card">
      {note && <p className="muted small run-note">{note.replace(/^\w/, (c) => c.toUpperCase())}</p>}
      <div className="run-cmdline">
        <span className="run-prompt" aria-hidden="true">$</span>
        <code className="run-script">{command}</code>
        <span className="spacer" />
        <CopyButton text={command} />
      </div>
      <p className="muted small" style={{ margin: "8px 0 0" }}>
        Run it in a terminal from the repository root, or <a href={REPO} target="_blank" rel="noreferrer">clone the repo</a> and start <code>python start.py</code> for Run buttons.
      </p>
    </div>
  );
}

export default function RunPanel(props: { script: string; args?: string[]; note?: string; label?: string }) {
  return process.env.NEXT_PUBLIC_STATIC_EXPORT === "1" ? <RunLocally script={props.script} args={props.args ?? []} note={props.note} /> : <LiveRunPanel {...props} />;
}

/** Runs a course script with the learner's local Python (from the repository root, like the README) and streams its output. */
function LiveRunPanel({ script, args = [], note, label = "Run" }: { script: string; args?: string[]; note?: string; label?: string }) {
  const initial = args.map(quote).join(" ");
  const [argText, setArgText] = useState(initial);
  const [lines, setLines] = useState<Line[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "ok" | "failed" | "stopped">("idle");
  const [seconds, setSeconds] = useState(0);
  const termRef = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  async function run() {
    setLines([]);
    setStatus("running");
    const started = Date.now();
    const tick = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 500);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script, args: splitArgs(argText) }), signal: ctrl.signal });
      if (!res.ok || !res.body) {
        setLines([{ kind: "err", text: await res.text() }]);
        setStatus("failed");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part) continue;
          const msg = JSON.parse(part);
          if (msg.type === "out" || msg.type === "err" || msg.type === "info") {
            setLines((prev) => [...prev, { kind: msg.type, text: msg.text }]);
            requestAnimationFrame(() => termRef.current?.scrollTo({ top: termRef.current.scrollHeight }));
          } else if (msg.type === "exit") setStatus(msg.code === 0 ? "ok" : "failed");
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") setStatus("stopped");
      else {
        setLines((prev) => [...prev, { kind: "err", text: String(e) }]);
        setStatus("failed");
      }
    } finally {
      clearInterval(tick);
    }
  }

  const file = script.split("/").pop();
  const output = lines.filter((l) => l.kind !== "info").map((l) => l.text).join("");
  return (
    <div className="run-panel card">
      {note && <p className="muted small run-note">{note.replace(/^\w/, (c) => c.toUpperCase())}</p>}
      <div className="run-cmdline">
        <span className="run-prompt" aria-hidden="true">$</span>
        <code className="run-script">python {script}</code>
        <input
          className="run-args"
          value={argText}
          onChange={(e) => setArgText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && status !== "running" && run()}
          placeholder="arguments (optional)"
          aria-label={`Arguments for ${file}`}
          spellCheck={false}
        />
        {argText !== initial && (
          <button type="button" className="icon-btn sm" onClick={() => setArgText(initial)} title="Reset to the README's arguments" aria-label="Reset arguments">
            <Icon name="refresh" size={14} />
          </button>
        )}
      </div>
      <div className="run-bar">
        {status === "running" ? (
          <button type="button" className="btn" onClick={() => abort.current?.abort()}>
            <Icon name="stop" size={16} /> Stop · {seconds}s
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={run}>
            <Icon name="play" size={16} /> {label}
          </button>
        )}
        {status === "ok" && <span className="status-text good"><Icon name="circle-check" size={16} /> finished in {seconds}s</span>}
        {status === "failed" && <span className="status-text bad"><Icon name="alert" size={16} /> failed, see the output</span>}
        {status === "stopped" && <span className="status-text muted">stopped</span>}
        {(status === "ok" || status === "failed") && output && (
          <AskButton
            label={status === "failed" ? "Help me fix this" : "Explain the output"}
            quote={output.slice(-4000)}
            prompt={status === "failed" ? `Running \`python ${script} ${argText}\` failed. What went wrong and how do I fix it?` : `Explain what this output of ${file} shows and what I should learn from it.`}
          />
        )}
      </div>
      {lines.length > 0 && (
        <div className="terminal" ref={termRef} tabIndex={0} aria-label="Script output" aria-live="polite">
          {lines.map((l, i) => <span key={i} className={l.kind}>{l.text}</span>)}
        </div>
      )}
    </div>
  );
}
