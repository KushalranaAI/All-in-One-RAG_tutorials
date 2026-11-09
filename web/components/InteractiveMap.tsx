"use client";
// The technique map: pick an architecture from the select, then click any box to learn what it is, how it works,
// why it exists and how to change it. Boxes are real buttons (keyboard: Tab, Enter/Space); the diagram data lives in
// lib/diagrams.ts and the layout here is a plain grid, so adding a box never means hand-placing coordinates.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Nav, allLessons, dayLabel } from "@/lib/nav";
import { useProgress } from "@/lib/progress";
import { type DEdge, type DNode, DIAGRAMS, KINDS, type Diagram } from "@/lib/diagrams";
import AskButton from "./ai/AskButton";
import Icon from "./ui/Icon";

const NODE_W = 144;
const NODE_H = 58;
const X0 = 10;
const COL = 200;
const ROW = 100;
const VIEW_W = 970;

type Pt = { x: number; y: number };
const box = (n: DNode, y0: number) => ({ x: X0 + n.c * COL, y: y0 + n.r * ROW });

function edgeGeometry(a: DNode, b: DNode, y0: number, route?: "above" | "below", lift = 62) {
  const A = box(a, y0);
  const B = box(b, y0);
  let p1: Pt, p2: Pt, c1: Pt, c2: Pt, vertical = false;
  if (route === "above" || route === "below") {
    const s = route === "above" ? -1 : 1;
    p1 = { x: A.x + NODE_W / 2, y: A.y + (s < 0 ? 0 : NODE_H) };
    p2 = { x: B.x + NODE_W / 2, y: B.y + (s < 0 ? 0 : NODE_H) };
    c1 = { x: p1.x, y: p1.y + s * lift };
    c2 = { x: p2.x, y: p2.y + s * lift };
  } else if (a.c !== b.c) {
    const right = b.c > a.c;
    p1 = { x: A.x + (right ? NODE_W : 0), y: A.y + NODE_H / 2 };
    p2 = { x: B.x + (right ? 0 : NODE_W), y: B.y + NODE_H / 2 };
    const h = Math.max(24, Math.abs(p2.x - p1.x) * 0.45);
    c1 = { x: p1.x + (right ? h : -h), y: p1.y };
    c2 = { x: p2.x + (right ? -h : h), y: p2.y };
  } else {
    vertical = true;
    const down = b.r > a.r;
    p1 = { x: A.x + NODE_W / 2, y: A.y + (down ? NODE_H : 0) };
    p2 = { x: B.x + NODE_W / 2, y: B.y + (down ? 0 : NODE_H) };
    const h = Math.max(20, Math.abs(p2.y - p1.y) * 0.4);
    c1 = { x: p1.x, y: p1.y + (down ? h : -h) };
    c2 = { x: p2.x, y: p2.y + (down ? -h : h) };
  }
  const d = `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  const mid = { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 };
  return { d, mid, vertical };
}

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    setR(mq.matches);
    const on = () => setR(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return r;
}

export default function InteractiveMap({ nav }: { nav: Nav }) {
  const [did, setDid] = useState(DIAGRAMS[0].id);
  const [sel, setSel] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const lessons = useMemo(() => allLessons(nav), [nav]);
  const p = useProgress();
  const panel = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  const diagram: Diagram = DIAGRAMS.find((d) => d.id === did) ?? DIAGRAMS[0];
  const byId = useMemo(() => new Map(diagram.nodes.map((n) => [n.id, n])), [diagram]);
  const node = sel ? byId.get(sel) ?? null : null;

  // deep links: /map#agentic/grade
  useEffect(() => {
    const [d, n] = location.hash.slice(1).split("/");
    if (d && DIAGRAMS.some((x) => x.id === d)) {
      setDid(d);
      if (n) setSel(n);
    }
    setReady(true); // only after this render may the hash be written back
  }, []);
  useEffect(() => {
    if (!ready) return;
    history.replaceState(null, "", `#${did}${sel ? `/${sel}` : ""}`);
  }, [did, sel, ready]);

  const choose = (id: string) => {
    setDid(id);
    setSel(null);
  };
  const pick = (id: string) => {
    setSel(id);
    // on narrow screens the panel is below the diagram: bring it into view
    if (window.innerWidth < 1280) requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  // room for loop-back arcs: an arc peaks at 0.75 x its lift beyond the box edge it leaves
  const arcSpace = (side: "above" | "below") =>
    Math.max(16, ...diagram.edges.filter((e) => e.route === side).map((e) => {
      const r = byId.get(e.from)!.r;
      const rowsBeyond = side === "above" ? r : diagram.rows - 1 - r;
      return Math.round(0.75 * (e.lift ?? 62)) + 20 - rowsBeyond * ROW;
    }));
  const Y0 = arcSpace("above");
  const H = Y0 + (diagram.rows - 1) * ROW + NODE_H + arcSpace("below");
  const lookup = (d: number) => lessons.find((x) => x.order === d);
  const inbound = node ? diagram.edges.filter((e) => e.to === node.id) : [];
  const outbound = node ? diagram.edges.filter((e) => e.from === node.id) : [];
  const connected = new Set(node ? [node.id, ...inbound.map((e) => e.from), ...outbound.map((e) => e.to)] : []);

  const edgeOn = (e: DEdge) => !!node && (e.from === node.id || e.to === node.id);

  return (
    <section className="imap" aria-label="Interactive RAG technique diagrams">
      <div className="imap-bar card">
        <label className="imap-select">
          <span className="eyebrow" style={{ margin: 0 }}>Architecture</span>
          <select value={did} onChange={(e) => choose(e.target.value)} aria-label="Choose a diagram">
            {DIAGRAMS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <p className="imap-blurb">{diagram.blurb}</p>
        <ul className="imap-legend" aria-label="Legend">
          {(Object.keys(KINDS) as (keyof typeof KINDS)[]).filter((k) => diagram.nodes.some((n) => n.kind === k)).map((k) => (
            <li key={k}><i style={{ background: KINDS[k].color }} />{KINDS[k].label}</li>
          ))}
        </ul>
      </div>

      <div className="imap-body">
        <div className="imap-canvas card">
          <div className="imap-scroll">
            <svg viewBox={`0 0 ${VIEW_W} ${H}`} className="imap-svg" role="group" aria-label={`${diagram.name} diagram`} style={{ minWidth: 900 }}>
              <defs>
                <marker id="imap-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,1 L9,5 L0,9 z" fill="var(--wire-live)" />
                </marker>
                <marker id="imap-arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,1 L9,5 L0,9 z" fill="var(--accent-strong)" />
                </marker>
              </defs>

              {diagram.edges.map((e, i) => {
                const a = byId.get(e.from);
                const b = byId.get(e.to);
                if (!a || !b) return null;
                const g = edgeGeometry(a, b, Y0, e.route, e.lift);
                const on = edgeOn(e);
                const dim = !!node && !on;
                return (
                  <g key={i} className={`imap-edge${on ? " on" : ""}${e.dashed ? " dashed" : ""}`} opacity={dim ? 0.28 : 1}>
                    <path d={g.d} fill="none" markerEnd={`url(#${on ? "imap-arrow-on" : "imap-arrow"})`} />
                    {!reduced && !e.dashed && [0, 1].map((k) => (
                      <circle key={k} r="2.6" className="imap-dot">
                        <animateMotion dur="2.8s" repeatCount="indefinite" begin={`${-k * 1.4 - (i % 5) * 0.3}s`} path={g.d} />
                      </circle>
                    ))}
                    {e.label && (
                      <text x={g.mid.x + (g.vertical ? 8 : 0)} y={g.mid.y + (g.vertical ? 4 : -7)} textAnchor={g.vertical ? "start" : "middle"} className="imap-elabel">{e.label}</text>
                    )}
                  </g>
                );
              })}

              {diagram.nodes.map((n) => {
                const { x, y } = box(n, Y0);
                const color = KINDS[n.kind].color;
                const on = sel === n.id;
                const dim = !!node && !connected.has(n.id);
                return (
                  <g
                    key={n.id}
                    transform={`translate(${x},${y})`}
                    className={`imap-node${on ? " sel" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={on}
                    aria-label={`${n.label}${n.sub ? `, ${n.sub}` : ""}. Press to learn about it.`}
                    opacity={dim ? 0.4 : 1}
                    onClick={() => (on ? setSel(null) : pick(n.id))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        on ? setSel(null) : pick(n.id);
                      }
                      if (e.key === "Escape") setSel(null);
                    }}
                    style={{ "--kind": color } as React.CSSProperties}
                  >
                    <rect className="imap-box" width={NODE_W} height={NODE_H} rx={n.kind === "decision" ? NODE_H / 2 : 12} />
                    <rect className="imap-stripe" x={6} y={12} width={3} height={NODE_H - 24} rx={1.5} />
                    <text x={n.kind === "decision" ? 22 : 18} y={n.sub ? 25 : 34} className="imap-label">{n.label}</text>
                    {n.sub && <text x={n.kind === "decision" ? 22 : 18} y={43} className="imap-sub">{n.sub}</text>}
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="imap-hint muted small"><Icon name="lightbulb" size={14} /> {node ? "Click the box again (or press Esc) to go back to the overview." : "Click any box to see what it is, how it works, why it exists and how to change it."}</p>
        </div>

        <aside className="imap-panel card" ref={panel} aria-live="polite" aria-label="Explanation">
          {node ? (
            <NodeDetail node={node} diagram={diagram} inbound={inbound} outbound={outbound} byId={byId} onPick={pick} onClose={() => setSel(null)} lookup={lookup} done={(id) => !!p.done[id]} />
          ) : (
            <Overview diagram={diagram} nav={nav} lookup={lookup} done={(id) => !!p.done[id]} />
          )}
        </aside>
      </div>
    </section>
  );
}

function DayLinks({ days, lookup, done }: { days: number[]; lookup: (d: number) => ReturnType<typeof allLessons>[number] | undefined; done: (id: string) => boolean }) {
  const items = days.map((d) => ({ d, l: lookup(d) })).filter((x) => x.l);
  if (!items.length) return null;
  return (
    <span className="chips">
      {items.map(({ d, l }) => (
        <Link key={d} href={l!.href} className={`pill ${done(l!.id) ? "good" : "accent"}`} title={l!.title}>
          {done(l!.id) && <Icon name="check" size={12} />}{dayLabel(d)} · {l!.title.length > 30 ? l!.title.slice(0, 28) + "…" : l!.title}
        </Link>
      ))}
    </span>
  );
}

function Overview({ diagram, nav, lookup, done }: { diagram: Diagram; nav: Nav; lookup: (d: number) => ReturnType<typeof allLessons>[number] | undefined; done: (id: string) => boolean }) {
  const projects = diagram.projects.map((s) => nav.projects.find((p) => p.slug === s)).filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <div className="imap-detail">
      <p className="eyebrow" style={{ margin: 0 }}>Overview</p>
      <h3>{diagram.name}</h3>
      <section><h4>When to use it</h4><p>{diagram.when}</p></section>
      <section><h4>The trade-off</h4><p>{diagram.tradeoff}</p></section>
      <section>
        <h4>How to explore</h4>
        <ol className="imap-steps">
          <li>Follow the arrows from the start to the answer. Dots show data flowing.</li>
          <li>Click a box to see what it does, why it is there and what you can change.</li>
          <li>Use the <b>comes from</b> and <b>goes to</b> chips to walk the pipeline.</li>
        </ol>
      </section>
      <section><h4><Icon name="book" size={13} /> Learn it</h4><DayLinks days={diagram.days} lookup={lookup} done={done} /></section>
      {projects.length > 0 && (
        <section>
          <h4><Icon name="rocket" size={13} /> Build it</h4>
          <ul className="imap-projects">
            {projects.map((pr) => (
              <li key={pr.slug}><Link href={`/projects/${pr.slug}`}><b>{pr.title}</b></Link><span className="muted small clamp">{pr.summary}</span></li>
            ))}
          </ul>
        </section>
      )}
      <AskButton label="Explain this architecture" prompt={`Explain the "${diagram.name}" RAG architecture step by step: ${diagram.nodes.map((n) => n.label).join(", ")}. When should I use it and what are its trade-offs?`} />
    </div>
  );
}

function NodeDetail({ node, diagram, inbound, outbound, byId, onPick, onClose, lookup, done }: {
  node: DNode; diagram: Diagram; inbound: DEdge[]; outbound: DEdge[]; byId: Map<string, DNode>;
  onPick: (id: string) => void; onClose: () => void;
  lookup: (d: number) => ReturnType<typeof allLessons>[number] | undefined; done: (id: string) => boolean;
}) {
  const k = KINDS[node.kind];
  return (
    <div className="imap-detail">
      <div className="imap-detail-head">
        <span className="pill" style={{ color: k.color, borderColor: `color-mix(in srgb, ${k.color} 40%, transparent)` }}>{k.label}</span>
        <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Back to overview"><Icon name="x" size={16} /></button>
      </div>
      <h3>{node.label}</h3>
      {node.sub && <p className="muted small" style={{ marginTop: -6 }}>{node.sub} · in {diagram.name}</p>}
      <section><h4>What it is</h4><p>{node.what}</p></section>
      <section><h4>How it works</h4><p>{node.how}</p></section>
      <section><h4>Why it exists</h4><p>{node.why}</p></section>
      <section>
        <h4>How to change or update it</h4>
        <ul className="imap-tune">{node.tune.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>
      {node.watch && <section className="imap-watch"><h4><Icon name="alert" size={13} /> Watch out for</h4><p>{node.watch}</p></section>}
      {(inbound.length > 0 || outbound.length > 0) && (
        <section>
          <h4>Walk the pipeline</h4>
          {inbound.length > 0 && (
            <p className="imap-walk"><span className="muted small">Comes from</span>{" "}
              {inbound.map((e) => <button key={e.from + e.to} type="button" className="chip-btn" onClick={() => onPick(e.from)}>{byId.get(e.from)?.label}</button>)}
            </p>
          )}
          {outbound.length > 0 && (
            <p className="imap-walk"><span className="muted small">Goes to</span>{" "}
              {outbound.map((e) => <button key={e.from + e.to} type="button" className="chip-btn" onClick={() => onPick(e.to)}>{byId.get(e.to)?.label}</button>)}
            </p>
          )}
        </section>
      )}
      {node.days && node.days.length > 0 && <section><h4><Icon name="book" size={13} /> Learn it</h4><DayLinks days={node.days} lookup={lookup} done={done} /></section>}
      <AskButton label="Explain this step" quote={`${node.label}: ${node.what} ${node.how}`} prompt={`In the "${diagram.name}" RAG architecture, explain the "${node.label}" step in more depth: how it works, why it is needed, and what I should change first when it performs badly.`} />
    </div>
  );
}
