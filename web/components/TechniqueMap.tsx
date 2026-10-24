"use client";
// Filterable "symptom → technique → day" cards. Recognition beats recall: find your problem, not the jargon for it.
import Link from "next/link";
import { useMemo, useState } from "react";
import { type Nav, allLessons, dayLabel } from "@/lib/nav";
import { useProgress } from "@/lib/progress";
import { STAGES, type Stage, TECHNIQUES } from "@/lib/techniques";
import Icon from "./ui/Icon";

const COST = ["", "no extra LLM calls", "one extra LLM call", "several LLM calls"];

export default function TechniqueMap({ nav }: { nav: Nav }) {
  const lessons = useMemo(() => allLessons(nav), [nav]);
  const p = useProgress();
  const [stage, setStage] = useState<Stage | null>(null);
  const [q, setQ] = useState("");
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = TECHNIQUES.filter((t) => (!stage || t.stage === stage) && tokens.every((w) => `${t.symptom} ${t.name} ${t.idea}`.toLowerCase().includes(w)));

  return (
    <>
      <div className="filters card">
        <div className="filter-row">
          <div className="lab-search wide">
            <Icon name="search" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Describe the problem: “wrong customer”, “slow”, “PDF”…" aria-label="Filter techniques" />
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-label">Stage</span>
          <div className="chips">
            <button type="button" className={`filter-chip ${stage === null ? "on" : ""}`} aria-pressed={stage === null} onClick={() => setStage(null)}>All</button>
            {STAGES.map((s) => (
              <button key={s} type="button" className={`filter-chip ${stage === s ? "on" : ""}`} aria-pressed={stage === s} onClick={() => setStage(stage === s ? null : s)}>{s}</button>
            ))}
          </div>
          <span className="spacer" />
          <span className="muted small" role="status">{shown.length} of {TECHNIQUES.length}</span>
        </div>
      </div>
      {shown.length === 0 && <div className="empty card"><Icon name="compass" /><p>Nothing matches. Try fewer words, or ask the AI tutor about your problem.</p></div>}
      <div className="algo-grid">
        {shown.map((t) => (
          <section key={t.name} className="card algo">
            <header>
              <span className="muted small"><Icon name="alert" size={13} /> {t.symptom}</span>
              <span className="algo-name">{t.name}</span>
            </header>
            <p className="algo-idea">{t.idea}</p>
            <footer>
              <span className="chips">
                <span className="pill">{t.stage}</span>
                <span className="meter" title={`Cost: ${COST[t.cost]}`} aria-label={`Cost: ${COST[t.cost]}`}>{[1, 2, 3].map((n) => <i key={n} className={n <= t.cost ? "on" : ""} />)}</span>
              </span>
              <span className="chips">
                {t.days.map((d) => {
                  const l = lessons.find((x) => x.order === d);
                  if (!l) return null;
                  return (
                    <Link key={d} href={l.href} className={`pill ${p.done[l.id] ? "good" : "accent"}`} title={l.title}>
                      {p.done[l.id] && <Icon name="check" size={12} />}{dayLabel(d)}
                    </Link>
                  );
                })}
              </span>
            </footer>
          </section>
        ))}
      </div>
    </>
  );
}
