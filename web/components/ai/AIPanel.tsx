"use client";
// The AI tutor: a panel docked beside the lesson. Knows which page/step you are on and can be asked about a
// selection, a code block, a visual or a whole lesson.
import { useEffect, useRef, useState } from "react";
import { type Msg, saveThread, chatStore } from "@/lib/ai/chats";
import { AIError, streamChat } from "@/lib/ai/client";
import { buildSystem, buildUserTurn, quickPrompts } from "@/lib/ai/prompts";
import { contextBudget, useConnection } from "@/lib/ai/settings";
import { providerById } from "@/lib/ai/providers";
import { setNote, progressStore } from "@/lib/progress";
import { toast } from "@/lib/toast";
import Markdown, { CopyButton } from "../Markdown";
import Icon from "../ui/Icon";
import { DEFAULT_WIDTH, EXPANDED_WIDTH, MAX_WIDTH, MIN_WIDTH, useAI } from "./AIProvider";
import AISettings from "./AISettings";
import UnlockCard from "./UnlockCard";

export default function AIPanel() {
  const ai = useAI();
  const { settings, connection, ready, status } = useConnection();
  const provider = providerById(settings.provider);
  const key = ai.page.key;
  const keyRef = useRef(key);
  keyRef.current = key;

  const [messages, setMessages] = useState<Msg[]>([]);
  const messagesRef = useRef<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [quote, setQuote] = useState<string | undefined>();
  const abort = useRef<AbortController | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const handled = useRef(0);
  const stick = useRef(true);

  const commit = (next: Msg[]) => {
    messagesRef.current = next;
    setMessages(next);
  };

  // each page keeps its own conversation
  useEffect(() => {
    abort.current?.abort();
    commit(chatStore.get().threads[key] ?? []);
    setError(null);
    setQuote(undefined);
    setStreaming(false);
  }, [key]);

  // keep the newest text in view unless the learner scrolled up to read
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, error]);

  async function send(text: string, q: string | undefined = quote) {
    text = text.trim() || (q ? "Explain this." : "");
    if (!text || streaming) return;
    if (!ready) {
      ai.setView("settings");
      return;
    }
    const user: Msg = { role: "user", content: text, quote: q };
    const base = [...messagesRef.current, user];
    commit([...base, { role: "assistant", content: "" }]);
    setDraft("");
    setQuote(undefined);
    setError(null);
    setStreaming(true);
    stick.current = true;

    const ctrl = new AbortController();
    abort.current = ctrl;
    const threadKey = key;
    const system = buildSystem(ai.page, settings.shareContext, contextBudget(settings));
    const api = base.slice(-12).map((m) => ({ role: m.role, content: m.role === "user" ? buildUserTurn(m.content, m.quote) : m.content }));

    let acc = "";
    let frame = 0;
    const onSamePage = () => threadKey === keyRef.current;
    const flush = () => {
      frame = 0;
      if (onSamePage()) commit([...base, { role: "assistant", content: acc }]);
    };
    try {
      await streamChat(connection, system, api, {
        signal: ctrl.signal,
        onToken: (t) => {
          acc += t;
          if (!frame) frame = requestAnimationFrame(flush);
        },
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        const err = e as AIError;
        setError({ message: err.message || "Something went wrong.", hint: err.hint });
      }
    } finally {
      if (frame) cancelAnimationFrame(frame);
      if (abort.current === ctrl) setStreaming(false);
      const final = acc ? [...base, { role: "assistant" as const, content: acc }] : base;
      saveThread(threadKey, final);
      if (onSamePage()) commit(final);
    }
  }
  const sendRef = useRef(send);
  sendRef.current = send;

  // requests from "Ask AI" buttons, text selection, code blocks …
  useEffect(() => {
    const r = ai.request;
    if (!r || r.id === handled.current) return;
    handled.current = r.id;
    if (r.quote !== undefined) setQuote(r.quote);
    if (r.send && r.prompt) void sendRef.current(r.prompt, r.quote);
    else {
      setDraft(r.prompt ?? "");
      requestAnimationFrame(() => composer.current?.focus());
    }
  }, [ai.request]);

  useEffect(() => {
    if (ai.open && ai.view === "chat") requestAnimationFrame(() => composer.current?.focus());
  }, [ai.open, ai.view]);

  useEffect(() => {
    const el = composer.current;
    if (!el || !ai.open) return; // a hidden panel measures 0
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 24), 160)}px`;
  }, [draft, ai.open, ai.view]);

  const stop = () => abort.current?.abort();
  const clear = () => {
    abort.current?.abort();
    commit([]);
    setError(null);
    setQuote(undefined);
    saveThread(key, []);
  };
  const regenerate = () => {
    const last = [...messagesRef.current].reverse().find((m) => m.role === "user");
    if (!last) return;
    const idx = messagesRef.current.lastIndexOf(last);
    commit(messagesRef.current.slice(0, idx));
    void send(last.content, last.quote);
  };
  const saveToNotes = (content: string) => {
    if (!ai.page.noteId) return;
    const existing = progressStore.get().notes[ai.page.noteId] ?? "";
    setNote(ai.page.noteId, `${existing}${existing ? "\n\n" : ""}**AI tutor:**\n${content}`);
    toast("Saved to your notes for this lesson", { tone: "info" });
  };

  const suggestions = quickPrompts(ai.page);
  const lastAssistant = messages.length - 1;

  return (
    <aside className="ai-panel" aria-label="AI tutor" hidden={!ai.open}>
      <div
        className="ai-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the AI tutor. Drag, or use the left and right arrow keys; double-click to reset."
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={ai.expanded ? EXPANDED_WIDTH : ai.width}
        tabIndex={0}
        onDoubleClick={() => ai.setWidth(DEFAULT_WIDTH)}
        onKeyDown={(e) => {
          const cur = ai.expanded ? EXPANDED_WIDTH : ai.width;
          if (e.key === "ArrowLeft") { e.preventDefault(); ai.setWidth(cur + 32); }
          if (e.key === "ArrowRight") { e.preventDefault(); ai.setWidth(cur - 32); }
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startW = ai.expanded ? EXPANDED_WIDTH : ai.width;
          const el = e.currentTarget;
          el.setPointerCapture(e.pointerId);
          document.body.classList.add("resizing");
          const move = (ev: PointerEvent) => ai.setWidth(startW + (startX - ev.clientX)); // dragging left makes it wider
          const up = () => {
            el.removeEventListener("pointermove", move);
            el.removeEventListener("pointerup", up);
            el.removeEventListener("pointercancel", up);
            document.body.classList.remove("resizing");
          };
          el.addEventListener("pointermove", move);
          el.addEventListener("pointerup", up);
          el.addEventListener("pointercancel", up);
        }}
      />
      <header className="ai-head">
        <div className="ai-title">
          <Icon name="sparkles" size={18} />
          <div>
            <b>AI tutor</b>
            <button type="button" className="ai-model" onClick={() => ai.setView(ai.view === "settings" ? "chat" : "settings")} title="AI settings">
              {ready ? `${provider.label} · ${connection.model}` : "Not connected"}
            </button>
          </div>
        </div>
        <div className="ai-head-actions">
          {ai.view === "chat" && messages.length > 0 && (
            <button type="button" className="icon-btn" onClick={clear} aria-label="Clear this conversation" title="Clear conversation">
              <Icon name="trash" />
            </button>
          )}
          <button type="button" className={`icon-btn ${ai.expanded ? "on" : ""}`} onClick={ai.toggleExpanded} aria-pressed={ai.expanded} aria-label={ai.expanded ? "Make the AI tutor narrower" : "Expand the AI tutor"} title={ai.expanded ? "Narrower" : "Expand for tables and code"}>
            <Icon name="expand" />
          </button>
          <button type="button" className={`icon-btn ${ai.view === "settings" ? "on" : ""}`} onClick={() => ai.setView(ai.view === "settings" ? "chat" : "settings")} aria-label="AI settings" title="AI settings">
            <Icon name="sliders" />
          </button>
          <button type="button" className="icon-btn" onClick={ai.closePanel} aria-label="Close AI tutor" title="Close (Ctrl+/)">
            <Icon name="x" />
          </button>
        </div>
      </header>

      {ai.view === "settings" ? (
        <div className="ai-body">
          <AISettings onDone={() => ai.setView("chat")} />
        </div>
      ) : (
        <>
          <div
            className="ai-body ai-messages"
            ref={scroller}
            onScroll={(e) => {
              const el = e.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
          >
            {status === "locked" && <UnlockCard />}
            {!ready && status !== "locked" && (
              <div className="ai-empty card">
                <div className="ai-empty-icon"><Icon name="sparkles" size={22} /></div>
                <h3>Connect an AI to get a tutor</h3>
                <p className="muted">
                  Use a free model running on your own computer (Ollama), or add a Claude, OpenAI or Gemini key. Everything stays in this browser.
                </p>
                <button type="button" className="btn primary" onClick={() => ai.setView("settings")}>
                  <Icon name="key" size={16} /> Set up AI
                </button>
              </div>
            )}

            {ready && messages.length === 0 && (
              <div className="ai-intro">
                <h3>{ai.page.kind === "general" ? "Ask me anything about RAG, agents and MCP" : `Ask about “${ai.page.title}”`}</h3>
                <p className="muted small">
                  Highlight any text, press <b>Explain</b> on a code block, or just type. {settings.shareContext && ai.page.kind !== "general" ? "I can see this page." : "I can’t see the page (turned off in Settings)."}
                </p>
                <div className="suggestions">
                  {suggestions.map((s) => (
                    <button key={s.label} type="button" className="suggestion" onClick={() => send(s.prompt)}>
                      <Icon name="lightbulb" size={14} /> {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role === "user" ? (
                  <div className="bubble">
                    {m.quote && <blockquote className="quote-chip">{m.quote.length > 220 ? m.quote.slice(0, 220) + "…" : m.quote}</blockquote>}
                    {m.content}
                  </div>
                ) : (
                  <div className="answer">
                    {m.content ? <Markdown askable={false}>{m.content}</Markdown> : <span className="typing" aria-label="Thinking"><i /><i /><i /></span>}
                    {m.content && !(streaming && i === lastAssistant) && (
                      <div className="msg-actions">
                        <CopyButton text={m.content} />
                        {ai.page.noteId && (
                          <button type="button" className="chip-btn" onClick={() => saveToNotes(m.content)}>
                            <Icon name="pen" size={14} /> Save to notes
                          </button>
                        )}
                        {i === lastAssistant && (
                          <button type="button" className="chip-btn" onClick={regenerate}>
                            <Icon name="refresh" size={14} /> Retry
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {error && (
              <div className="notice bad" role="alert">
                <Icon name="alert" size={16} />
                <div>
                  <b>{error.message}</b>
                  {error.hint && <div className="small">{error.hint}</div>}
                  <div className="row" style={{ marginTop: 8 }}>
                    <button type="button" className="chip-btn" onClick={regenerate}><Icon name="refresh" size={14} /> Try again</button>
                    <button type="button" className="chip-btn" onClick={() => ai.setView("settings")}><Icon name="sliders" size={14} /> Settings</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form
            className="ai-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            {quote && (
              <div className="quote-bar">
                <Icon name="quote" size={14} />
                <span>{quote.length > 160 ? quote.slice(0, 160) + "…" : quote}</span>
                <button type="button" className="icon-btn sm" onClick={() => setQuote(undefined)} aria-label="Remove quoted text">
                  <Icon name="x" size={14} />
                </button>
              </div>
            )}
            <div className="composer-row">
              <textarea
                ref={composer}
                value={draft}
                rows={1}
                placeholder={ready ? (quote ? "Ask about the selected text…" : "Ask a question…") : "Connect an AI first"}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(draft);
                  }
                  if (e.key === "Escape") ai.closePanel();
                }}
                aria-label="Message to the AI tutor"
              />
              {streaming ? (
                <button type="button" className="btn primary round" onClick={stop} aria-label="Stop generating">
                  <Icon name="stop" size={16} />
                </button>
              ) : (
                <button type="submit" className="btn primary round" disabled={!draft.trim() && !quote} aria-label="Send">
                  <Icon name="send" size={16} />
                </button>
              )}
            </div>
            <div className="composer-foot muted small">
              <span>Enter to send · Shift+Enter for a new line</span>
              <span>{settings.shareContext && ai.page.kind !== "general" ? "Page shared" : "Page not shared"} · AI can make mistakes</span>
            </div>
          </form>
        </>
      )}
    </aside>
  );
}
