"use client";
// Personal notes for a lesson, saved in this browser. Markdown + math work here too (AI answers can be saved in).
import { useEffect, useRef, useState } from "react";
import { progressStore, setNote } from "@/lib/progress";
import Markdown from "../Markdown";
import Icon from "../ui/Icon";

export default function Notes({ id }: { id: string }) {
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef({ id, text: "", dirty: false });

  // pick up the stored note (and any "saved from AI" additions made while this tab was closed)
  useEffect(() => {
    const t = progressStore.get().notes[id] ?? "";
    setText(t);
    latest.current = { id, text: t, dirty: false };
    setLoaded(true);
    const unsub = progressStore.subscribe(() => {
      const fresh = progressStore.get().notes[id] ?? "";
      if (!latest.current.dirty && fresh !== latest.current.text) {
        latest.current.text = fresh;
        setText(fresh);
      }
    });
    return () => {
      unsub();
      clearTimeout(timer.current);
      if (latest.current.dirty) setNote(latest.current.id, latest.current.text);
    };
  }, [id]);

  const change = (v: string) => {
    setText(v);
    setSaved(false);
    latest.current = { id, text: v, dirty: true };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setNote(id, v);
      latest.current.dirty = false;
      setSaved(true);
    }, 500);
  };

  return (
    <div className="notes">
      <div className="notes-bar">
        <p className="muted small" style={{ margin: 0 }}>
          Your own words stick better than anyone else&apos;s. Notes are saved in this browser. Supports Markdown and <code>$math$</code>.
        </p>
        <div className="segmented" role="group" aria-label="Notes mode">
          <button type="button" className={!preview ? "on" : ""} onClick={() => setPreview(false)}><Icon name="pen" size={14} /> Write</button>
          <button type="button" className={preview ? "on" : ""} onClick={() => setPreview(true)}><Icon name="eye" size={14} /> Preview</button>
        </div>
      </div>
      {preview ? (
        <div className="card notes-preview">{text.trim() ? <Markdown askable={false}>{text}</Markdown> : <p className="muted">Nothing here yet.</p>}</div>
      ) : (
        <textarea
          className="notes-input"
          value={text}
          disabled={!loaded}
          onChange={(e) => change(e.target.value)}
          placeholder={"What clicked? What's still fuzzy?\n\n- One-sentence summary in my words\n- A question to come back to"}
          aria-label="Lesson notes"
        />
      )}
      <div className="muted small">{saved ? (text ? "Saved" : "") : "Saving…"}</div>
    </div>
  );
}
