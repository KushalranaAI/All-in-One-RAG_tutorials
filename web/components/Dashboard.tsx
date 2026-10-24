"use client";
import Link from "next/link";
import { useMemo } from "react";
import { type Nav, allLessons, dayLabel, projectId } from "@/lib/nav";
import { streak, useProgress } from "@/lib/progress";
import { useConnection } from "@/lib/ai/settings";
import { useAI } from "./ai/AIProvider";
import Mermaid from "./Mermaid";
import { ProjectCard } from "./ProjectsList";
import Icon, { type IconName, sectionIcon } from "./ui/Icon";
import Ring from "./ui/Ring";

const PIPELINE = `flowchart LR
  subgraph Indexing [Indexing - once, or when docs change]
    A[Load documents] --> B[Chunk] --> C[Embed] --> D[(Vector + BM25 index)]
  end
  subgraph Query [Answering - every question]
    Q[Question] --> R[Retrieve: hybrid + rerank] --> P[Prompt with numbered sources] --> L[Claude] --> O[Answer with citations]
  end
  D --> R
  O -. measure with an eval set .-> R`;

function Stat({ icon, label, value, hint }: { icon: IconName; label: string; value: string; hint?: string }) {
  return (
    <div className="stat-card card">
      <span className="stat-icon"><Icon name={icon} size={18} /></span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="muted small">{label}</div>
        {hint && <div className="muted small">{hint}</div>}
      </div>
    </div>
  );
}

export default function Dashboard({ nav }: { nav: Nav }) {
  const p = useProgress();
  const ai = useAI();
  const { ready } = useConnection();
  const lessons = useMemo(() => allLessons(nav), [nav]);
  const done = lessons.filter((l) => p.done[l.id]);
  const total = lessons.length;
  const minutes = done.reduce((n, l) => n + l.minutes, 0);
  const s = streak(p);
  const projectsDone = nav.projects.filter((x) => p.done[projectId(x.slug)]).length;
  // Starter projects first; once you've finished some, the next unfinished ones.
  const projects = nav.projects.filter((x) => !p.done[projectId(x.slug)]).slice(0, 3);

  // "Up next": the first unfinished lessons at/after the one you touched last (so it follows you through the course)
  const lastIdx = p.last ? lessons.findIndex((l) => l.id === p.last!.id) : -1;
  const upNext = useMemo(() => {
    const order = [...lessons.slice(Math.max(lastIdx, 0)), ...lessons.slice(0, Math.max(lastIdx, 0))];
    return order.filter((l) => !p.done[l.id]).slice(0, 3);
  }, [lessons, lastIdx, p.done]);
  const resume = p.last && !p.done[p.last.id] ? p.last : null;
  const first = upNext[0];
  const started = done.length > 0 || !!p.last;
  const pct = total ? done.length / total : 0;

  return (
    <div className="dashboard">
      <section className="hero card">
        <div className="hero-text">
          <span className="eyebrow">{started ? "Welcome back" : "30 days · 15 projects · Claude + MCP"}</span>
          <h1>{started ? (pct >= 1 ? "You finished all 30 days." : "Pick up where you left off.") : "Learn RAG by building it, one day at a time."}</h1>
          <p className="lead">
            {started
              ? `${done.length} of ${total} days done. ${s.current > 1 ? `${s.current}-day streak, keep it going.` : "One lesson a day gets you there in a month."}`
              : "From your first embedding to multi-agent systems on the Model Context Protocol. Each day is a short lesson, runnable Python and one exercise: about an hour or two."}
          </p>
          <div className="hero-actions">
            {resume ? (
              <Link href={resume.href} className="btn primary lg"><Icon name="play" size={18} /> Continue: {resume.title}</Link>
            ) : first ? (
              <Link href={first.href} className="btn primary lg"><Icon name="play" size={18} /> {started ? "Next lesson" : "Start with"}: {first.title}</Link>
            ) : null}
            <Link href="/map" className="btn lg"><Icon name="compass" size={18} /> My RAG is failing. What fixes it?</Link>
          </div>
        </div>
        <div className="hero-ring">
          <Ring value={pct} size={150} stroke={12}>
            <span className="ring-big">{Math.round(pct * 100)}<small>%</small></span>
          </Ring>
          <span className="muted small">{done.length} / {total} days</span>
        </div>
      </section>

      <section className="stats" aria-label="Your stats">
        <Stat icon="circle-check" label="Days completed" value={`${done.length}`} />
        <Stat icon="clock" label="Time invested" value={minutes >= 60 ? `${(minutes / 60).toFixed(1)} h` : `${minutes} min`} />
        <Stat icon="flame" label="Day streak" value={`${s.current}`} hint={s.longest > s.current ? `Best: ${s.longest}` : undefined} />
        <Stat icon="rocket" label="Projects finished" value={`${projectsDone} / ${nav.projects.length}`} />
      </section>

      {!ready && (
        <section className="ai-promo card">
          <span className="stat-icon accent"><Icon name="sparkles" size={20} /></span>
          <div>
            <b>Add an AI tutor in one minute</b>
            <p className="muted" style={{ margin: "2px 0 0" }}>
              Highlight any sentence, code block or output and ask about it. The ANTHROPIC_API_KEY in your .env works automatically on this computer, or use a free local model (Ollama) or another provider's key.
            </p>
          </div>
          <button type="button" className="btn primary" onClick={() => ai.openPanel("settings")}><Icon name="key" size={16} /> Connect AI</button>
        </section>
      )}

      {upNext.length > 0 && (
        <section>
          <div className="section-head"><h2>Up next</h2></div>
          <div className="grid">
            {upNext.map((l) => (
              <Link key={l.id} href={l.href} className="card link-card lift">
                <span className="muted small">{dayLabel(l.order)} · {l.sectionTitle}</span>
                <b className="card-title">{l.title}</b>
                <span className="muted small clamp">{l.summary}</span>
                <span className="card-foot">
                  <span className={`pill ${l.level}`}>{l.level}</span>
                  <span className="muted small"><Icon name="clock" size={12} /> ~{l.minutes} min</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-head"><h2>Your roadmap</h2><span className="muted small">{nav.sections.length} weeks, from embeddings to production</span></div>
        <div className="grid roadmap">
          {nav.sections.map((s) => {
            const d = s.lessons.filter((l) => p.done[`${s.slug}/${l.slug}`]).length;
            return (
              <Link key={s.slug} href={`/learn/${s.slug}`} className="card link-card lift part-card">
                <div className="part-top">
                  <Ring value={s.lessons.length ? d / s.lessons.length : 0} size={46} stroke={4}>
                    <Icon name={sectionIcon(s.slug)} size={18} />
                  </Ring>
                  <span className="muted small">Week {s.order}</span>
                </div>
                <b className="card-title">{s.title}</b>
                <span className="muted small clamp">{s.description}</span>
                <span className="card-foot"><span className="pill">{d}/{s.lessons.length} days</span><span className="muted small">Days {s.lessons[0]?.order}–{s.lessons[s.lessons.length - 1]?.order}</span></span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="section-head"><h2>Build real things</h2><Link href="/projects" className="small">All {nav.projects.length} projects <Icon name="arrow-right" size={14} /></Link></div>
        <div className="grid">
          {projects.map((pr) => <ProjectCard key={pr.slug} pr={pr} />)}
        </div>
      </section>

      <section>
        <div className="section-head"><h2>How to learn here</h2></div>
        <ol className="how">
          {[
            { icon: "book" as const, t: "Read", d: "A short lesson: the problem, the idea, and how the code does it." },
            { icon: "sliders" as const, t: "Try it", d: "Chunk, search, fuse and evaluate the sample handbook right in the browser." },
            { icon: "play" as const, t: "Run it", d: "Run the day's script on your machine, then change the question or the code." },
            { icon: "checklist" as const, t: "Do one exercise", d: "Change one thing and measure it. Quiz yourself and keep notes in your own words." },
          ].map((x) => (
            <li key={x.t} className="card">
              <span className="stat-icon"><Icon name={x.icon} size={18} /></span>
              <b>{x.t}</b>
              <span className="muted small">{x.d}</span>
            </li>
          ))}
        </ol>
        <details className="pipeline">
          <summary>The RAG pipeline you will build, piece by piece <Icon name="chevron-down" size={14} /></summary>
          <Mermaid chart={PIPELINE} />
        </details>
      </section>
    </div>
  );
}
