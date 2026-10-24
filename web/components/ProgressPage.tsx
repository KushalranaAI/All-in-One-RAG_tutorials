"use client";
import Link from "next/link";
import { useMemo, useRef } from "react";
import { type Nav, allLessons, projectId } from "@/lib/nav";
import { dayKey, importProgress, progressStore, resetProgress, streak, useProgress } from "@/lib/progress";
import { toast } from "@/lib/toast";
import Icon, { type IconName, sectionIcon } from "./ui/Icon";
import Ring from "./ui/Ring";

const WEEKS = 18;

function Heatmap({ days }: { days: Record<string, number> }) {
  const cells = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - (WEEKS * 7 - 1) - end.getDay()); // begin on a Sunday
    const out: { key: string; level: number; future: boolean }[][] = [];
    const d = new Date(start);
    for (let w = 0; w <= WEEKS; w++) {
      const col: { key: string; level: number; future: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const key = dayKey(d);
        const n = days[key] ?? 0;
        col.push({ key, level: n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4, future: d > end });
        d.setDate(d.getDate() + 1);
      }
      out.push(col);
    }
    return out;
  }, [days]);
  return (
    <div className="heatmap" role="img" aria-label="Activity over the last months">
      {cells.map((col, i) => (
        <div key={i} className="heat-col">
          {col.map((c) => (
            <span key={c.key} className={`heat l${c.level} ${c.future ? "future" : ""}`} title={c.future ? "" : `${c.key}: ${days[c.key] ?? 0 ? "active" : "no activity"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ProgressPage({ nav }: { nav: Nav }) {
  const p = useProgress();
  const file = useRef<HTMLInputElement>(null);
  const lessons = useMemo(() => allLessons(nav), [nav]);
  const done = lessons.filter((l) => p.done[l.id]);
  const minutes = done.reduce((n, l) => n + l.minutes, 0);
  const s = streak(p);
  const activeDays = Object.values(p.days).filter((n) => n > 0).length;
  const projectsDone = nav.projects.filter((x) => p.done[projectId(x.slug)]).length;
  const partsDone = nav.sections.filter((x) => x.lessons.length && x.lessons.every((l) => p.done[`${x.slug}/${l.slug}`])).length;
  const quizzes = Object.entries(p.quiz);
  const notes = Object.entries(p.notes);

  const milestones: { icon: IconName; title: string; desc: string; got: boolean }[] = [
    { icon: "play", title: "First retrieval", desc: "Finish your first day", got: done.length >= 1 },
    { icon: "flame", title: "On a roll", desc: "Reach a 3-day streak", got: s.longest >= 3 },
    { icon: "layers", title: "Week complete", desc: "Finish every day of one week", got: partsDone >= 1 },
    { icon: "target", title: "Self-tester", desc: "Score full marks on a quiz", got: quizzes.some(([, q]) => q.score === q.total) },
    { icon: "checklist", title: "Hands on", desc: "Tick off 10 exercises", got: Object.keys(p.done).filter((k) => k.includes("/ex/")).length >= 10 },
    { icon: "pen", title: "Note taker", desc: "Write notes for 3 days", got: notes.length >= 3 },
    { icon: "rocket", title: "Builder", desc: "Finish a project", got: projectsDone >= 1 },
    { icon: "bookmark", title: "Portfolio", desc: "Finish three projects", got: projectsDone >= 3 },
    { icon: "trophy", title: "Halfway", desc: "Complete 15 days", got: done.length >= lessons.length / 2 && lessons.length > 0 },
    { icon: "zap", title: "30 for 30", desc: "Complete all 30 days", got: lessons.length > 0 && done.length === lessons.length },
  ];

  const titleOf = (id: string) => lessons.find((l) => l.id === id);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(progressStore.get(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rag-in-30-days-progress-${dayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <article>
      <header className="page-head">
        <div className="eyebrow"><Icon name="trophy" size={14} /> My progress</div>
        <h1>Your learning, at a glance</h1>
        <p className="lead">Saved in this browser only. Export a backup any time.</p>
      </header>

      <section className="stats">
        <div className="stat-card card"><Ring value={lessons.length ? done.length / lessons.length : 0} size={56} stroke={6} /><div><div className="stat-value">{done.length}<small> / {lessons.length}</small></div><div className="muted small">days completed</div></div></div>
        <div className="stat-card card"><span className="stat-icon"><Icon name="clock" size={18} /></span><div><div className="stat-value">{minutes >= 60 ? `${(minutes / 60).toFixed(1)} h` : `${minutes} min`}</div><div className="muted small">of lessons finished (estimated)</div></div></div>
        <div className="stat-card card"><span className="stat-icon"><Icon name="flame" size={18} /></span><div><div className="stat-value">{s.current}<small> days</small></div><div className="muted small">current streak · best {s.longest}</div></div></div>
        <div className="stat-card card"><span className="stat-icon"><Icon name="chart" size={18} /></span><div><div className="stat-value">{activeDays}</div><div className="muted small">active days</div></div></div>
      </section>

      <section className="card">
        <div className="section-head"><h2>Activity</h2><span className="muted small">last {WEEKS} weeks</span></div>
        <Heatmap days={p.days} />
        <div className="heat-legend muted small">Less <span className="heat l0" /><span className="heat l1" /><span className="heat l2" /><span className="heat l3" /><span className="heat l4" /> More</div>
      </section>

      <section>
        <div className="section-head"><h2>By week</h2></div>
        <div className="part-bars">
          {nav.sections.map((sec) => {
            const d = sec.lessons.filter((l) => p.done[`${sec.slug}/${l.slug}`]).length;
            const pct = sec.lessons.length ? (100 * d) / sec.lessons.length : 0;
            return (
              <Link key={sec.slug} href={`/learn/${sec.slug}`} className="part-bar">
                <Icon name={sectionIcon(sec.slug)} size={18} />
                <span className="part-bar-title">Week {sec.order} · {sec.title}</span>
                <div className="bar"><div style={{ width: `${pct}%` }} /></div>
                <span className="muted small">{d}/{sec.lessons.length}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="section-head"><h2>Milestones</h2><span className="muted small">{milestones.filter((m) => m.got).length} / {milestones.length}</span></div>
        <div className="milestones">
          {milestones.map((m) => (
            <div key={m.title} className={`milestone card ${m.got ? "got" : ""}`}>
              <span className="stat-icon"><Icon name={m.icon} size={18} /></span>
              <b>{m.title}</b>
              <span className="muted small">{m.desc}</span>
              <span className="sr-only">{m.got ? "Unlocked" : "Locked"}</span>
            </div>
          ))}
        </div>
      </section>

      {quizzes.length > 0 && (
        <section>
          <div className="section-head"><h2>Quiz scores</h2></div>
          <div className="card list">
            {quizzes.sort((a, b) => b[1].at - a[1].at).map(([id, q]) => {
              const l = titleOf(id);
              return (
                <Link key={id} href={l?.href ?? "/"} className="list-row">
                  <b>{l?.title ?? id}</b>
                  <span className={`pill ${q.score === q.total ? "good" : ""}`}>{q.score} / {q.total}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {notes.length > 0 && (
        <section>
          <div className="section-head"><h2>Your notes</h2></div>
          <div className="card list">
            {notes.map(([id, text]) => {
              const l = titleOf(id);
              return (
                <Link key={id} href={`${l?.href ?? "/"}#notes`} className="list-row">
                  <b>{l?.title ?? id}</b>
                  <span className="muted small clamp">{text.replace(/\s+/g, " ").slice(0, 120)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="card">
        <div className="section-head"><h2>Your data</h2></div>
        <p className="muted">Progress, notes, quiz scores and AI chats live in this browser. Moving to another computer or clearing browser data? Export first, import later.</p>
        <div className="row">
          <button type="button" className="btn" onClick={exportJson}><Icon name="download" size={16} /> Export progress</button>
          <button type="button" className="btn" onClick={() => file.current?.click()}><Icon name="upload" size={16} /> Import progress</button>
          <input
            ref={file}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (importProgress(await f.text())) toast("Progress imported.");
              else toast("That file isn't a progress export.", { tone: "bad" });
            }}
          />
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (confirm("Reset all progress, notes and quiz scores in this browser? This can't be undone.")) {
                resetProgress();
                toast("Progress reset.", { tone: "info" });
              }
            }}
          >
            <Icon name="trash" size={16} /> Reset
          </button>
        </div>
      </section>
    </article>
  );
}
