"use client";
// Fifteen projects are too many to scan: filter by level and by the two ideas people come for (MCP, multi-agent).
import Link from "next/link";
import { useState } from "react";
import type { NavProject } from "@/lib/nav";
import { projectId, stepId } from "@/lib/nav";
import { useProgress } from "@/lib/progress";
import Icon from "./ui/Icon";

const LEVELS = ["beginner", "intermediate", "advanced", "capstone"];

export function ProjectCard({ pr }: { pr: NavProject }) {
  const p = useProgress();
  const isDone = !!p.done[projectId(pr.slug)];
  const stepsDone = Array.from({ length: pr.steps }).filter((_, i) => p.done[stepId(pr.slug, i)]).length;
  return (
    <Link href={`/projects/${pr.slug}`} className="card link-card lift">
      <span className="card-foot" style={{ marginTop: 0, paddingTop: 0 }}>
        <span className="muted small">Project {parseInt(pr.slug, 10)}</span>
        <span className={`pill ${pr.level}`}>{pr.level}</span>
        <span className="stars" aria-label={`Difficulty ${pr.stars} of 4`}>{"★".repeat(pr.stars)}</span>
        {isDone && <span className="pill good"><Icon name="check" size={12} /> done</span>}
      </span>
      <b className="card-title">{pr.title}</b>
      <span className="muted small clamp">{pr.summary}</span>
      <span className="card-foot">
        {pr.mcp && <span className="pill accent"><Icon name="plug" size={12} /> MCP</span>}
        {pr.multiAgent && <span className="pill accent"><Icon name="users" size={12} /> multi-agent</span>}
        <span className="muted small">{pr.ideas}</span>
      </span>
      {pr.steps > 0 && <div className="bar" aria-label={`${stepsDone} of ${pr.steps} extensions done`}><div style={{ width: `${(100 * (isDone ? pr.steps : stepsDone)) / pr.steps}%` }} /></div>}
    </Link>
  );
}

export default function ProjectsList({ projects }: { projects: NavProject[] }) {
  const [level, setLevel] = useState<string | null>(null);
  const [mcp, setMcp] = useState(false);
  const [agents, setAgents] = useState(false);
  const shown = projects.filter((p) => (!level || p.level === level) && (!mcp || p.mcp) && (!agents || p.multiAgent));
  return (
    <>
      <div className="filters card">
        <div className="filter-row">
          <span className="filter-label">Level</span>
          <div className="chips">
            <button type="button" className={`filter-chip ${level === null ? "on" : ""}`} aria-pressed={level === null} onClick={() => setLevel(null)}>All</button>
            {LEVELS.filter((l) => projects.some((p) => p.level === l)).map((l) => (
              <button key={l} type="button" className={`filter-chip ${level === l ? "on" : ""}`} aria-pressed={level === l} onClick={() => setLevel(level === l ? null : l)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-label">Uses</span>
          <div className="chips">
            <button type="button" className={`filter-chip ${mcp ? "on" : ""}`} aria-pressed={mcp} onClick={() => setMcp(!mcp)}><Icon name="plug" size={14} /> MCP</button>
            <button type="button" className={`filter-chip ${agents ? "on" : ""}`} aria-pressed={agents} onClick={() => setAgents(!agents)}><Icon name="users" size={14} /> Multi-agent</button>
          </div>
          <span className="spacer" />
          <span className="muted small" role="status">{shown.length} of {projects.length}</span>
        </div>
      </div>
      {shown.length ? (
        <div className="grid projects-grid">{shown.map((pr) => <ProjectCard key={pr.slug} pr={pr} />)}</div>
      ) : (
        <div className="empty card"><Icon name="filter" /><p>No project matches all of those. <button type="button" className="btn ghost sm" onClick={() => { setLevel(null); setMcp(false); setAgents(false); }}>Clear filters</button></p></div>
      )}
    </>
  );
}
