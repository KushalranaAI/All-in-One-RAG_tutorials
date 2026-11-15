"use client";
// Agent Studio for the RAG course: drag blocks onto a canvas, simulate a thousand requests, read p50/p95/p99, cost and
// correctness, play one typical request through the graph, and export the design as Python. Ported from the AI Engineer
// Path (journeys, live runs and the chat-source hook are left out). The engine lives in lib/studio.
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type FitViewOptions,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Check, Code, Copy, Download, FlaskConical, Gauge, LayoutTemplate, Lightbulb, Pause, Play, Plus, RotateCcw, Share2, Square, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { CATEGORY_LABEL, KINDS, TIERS, type Category } from "@/lib/studio/catalog";
import { toPython } from "@/lib/studio/codegen";
import { PRESETS, dayPath, presetById, type Preset } from "@/lib/studio/presets";
import { poolOf, simulate } from "@/lib/studio/simulate";
import { GPUS, MODELS, replicasFor } from "@/lib/studio/sizing";
import type { NodeKind, NodeParams, SimResult, StudioGraph, Tier } from "@/lib/studio/types";
import { KIND_ICON, edgeTypes, nodeTypes, type RunStatus, type StudioFlowEdge, type StudioFlowNode } from "./canvas";
import "./studio.css";

const SAVE_KEY = "rag-path:studio:v1";
type Tab = "inspect" | "results" | "code";

const fmtMs = (x: number) => (x >= 10000 ? `${(x / 1000).toFixed(0)} s` : x >= 1000 ? `${(x / 1000).toFixed(2)} s` : `${Math.round(x)} ms`);
const pct = (a: number, b: number) => `${Math.round((a / Math.max(1, b)) * 100)}%`;

function toFlow(g: StudioGraph): { nodes: StudioFlowNode[]; edges: StudioFlowEdge[] } {
  const routers = new Set(g.nodes.filter((n) => n.kind === "router").map((n) => n.id));
  return {
    nodes: g.nodes.map((n) => ({ id: n.id, type: "studio", position: { x: n.x, y: n.y }, data: { kind: n.kind, params: { ...n.params } } })),
    edges: g.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: "studio", markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 }, data: { weight: e.weight ?? 1, showWeight: routers.has(e.source) } })),
  };
}
function toGraph(nodes: StudioFlowNode[], edges: StudioFlowEdge[]): StudioGraph {
  return {
    nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, x: Math.round(n.position.x), y: Math.round(n.position.y), params: n.data.params })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, weight: e.data?.weight })),
  };
}
function encodeGraph(g: StudioGraph) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(g))));
}
function decodeGraph(s: string): StudioGraph | null {
  try {
    const g = JSON.parse(decodeURIComponent(escape(atob(s))));
    return Array.isArray(g?.nodes) && Array.isArray(g?.edges) ? g : null;
  } catch {
    return null;
  }
}

const saved0 = () => {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
};
function loadSaved(): { graph: StudioGraph; preset?: string } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** fit the whole graph into the canvas */
const fitOptions = (): FitViewOptions => ({
  padding: 0.08,
  maxZoom: 1,
  // on small screens keep nodes readable and let the learner pan, instead of shrinking the whole graph to fit
  minZoom: typeof window !== "undefined" && window.innerWidth <= 1100 ? 0.6 : 0.2,
});

export default function StudioPage() {
  return (
    <MotionConfig reducedMotion="user">
      <ReactFlowProvider>
        <Studio />
      </ReactFlowProvider>
    </MotionConfig>
  );
}

function Studio() {
  const initial = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    const shared = q.get("g") ? decodeGraph(q.get("g")!) : null;
    if (shared) return { graph: shared, preset: undefined as Preset | undefined };
    const presetParam = q.get("preset");
    const p = presetParam ? presetById(presetParam) : undefined;
    if (p) return { graph: p.graph, preset: p };
    if (!presetParam && saved0()) {
      const saved = loadSaved();
      if (saved?.graph) return { graph: saved.graph, preset: saved.preset ? presetById(saved.preset) : undefined };
    }
    return { graph: PRESETS[0].graph, preset: PRESETS[0] };
  }, []);
  const start = useMemo(() => toFlow(initial.graph), [initial]);
  const [nodes, setNodes, onNodesChange] = useNodesState<StudioFlowNode>(start.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<StudioFlowEdge>(start.edges);
  const [preset, setPreset] = useState<Preset | undefined>(initial.preset);
  const [rps, setRps] = useState(initial.preset?.rps ?? 5);
  const [runs, setRuns] = useState(1000);
  const [result, setResult] = useState<SimResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("inspect");
  const [selected, setSelected] = useState<{ type: "node" | "edge"; id: string } | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [toast, setToast] = useState("");
  const { screenToFlowPosition, fitView } = useReactFlow();
  const graph = useMemo(() => toGraph(nodes, edges), [nodes, edges]);
  const designSig = useMemo(() => JSON.stringify([graph.nodes.map((n) => [n.id, n.kind, n.params]), graph.edges.map((e) => [e.source, e.target, e.weight ?? 1]), rps]), [graph, rps]);
  const simSig = useRef<string | null>(null);
  const stale = result !== null && simSig.current !== null && simSig.current !== designSig;

  // autosave the design
  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ graph, preset: preset?.id }));
    } catch {
      /* not persisted */
    }
  }, [graph, preset]);

  /** fit the graph into the space the floating panel (left) and timeline (bottom) leave free, so nothing hides behind them */
  const fitForOverlays = (duration: number) => {
    fitView({ ...fitOptions(), duration });
    // nodes may not be measured yet on the first pass: fit again once they are
    setTimeout(() => fitView({ ...fitOptions(), duration: 250 }), 260);
  };

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 2200);
  };

  /* ---------- simulation ---------- */
  const runSim = useCallback(() => {
    setBusy(true);
    setTimeout(() => {
      const r = simulate(toGraph(nodes, edges), { runs, rps });
      setResult(r);
      setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, stats: r.perNode[n.id], runs: r.runs, status: "idle", note: undefined } })));
      setEdges((es) =>
        es.map((e) => {
          const t = r.perNode[e.target];
          return { ...e, data: { ...e.data, share: t ? t.visits / r.runs : 0, active: false } };
        }),
      );
      setBusy(false);
      setTab("results");
      simSig.current = JSON.stringify([nodes.map((n) => [n.id, n.data.kind, n.data.params]), edges.map((e) => [e.source, e.target, e.data?.weight ?? 1]), rps]);
    }, 20);
  }, [nodes, edges, runs, rps, setNodes, setEdges]);

  /* ---------- playback of the median request ---------- */
  const [playing, setPlaying] = useState(false);
  const [playT, setPlayT] = useState(0);
  const raf = useRef(0);
  const total = result?.trace.length ? Math.max(...result.trace.map((t) => t.end)) : 0;
  const applyAt = useCallback(
    (t: number) => {
      if (!result) return;
      const status = new Map<string, RunStatus>();
      const notes = new Map<string, string>();
      for (const ev of result.trace) {
        if (ev.start <= t) {
          const live = t <= ev.end && ev.end > ev.start;
          status.set(ev.node, live ? "active" : ev.status === "fail" ? "fail" : ev.status === "blocked" ? "blocked" : ev.status === "hit" ? "hit" : "ok");
          if (ev.note) notes.set(ev.node, ev.note);
        }
      }
      setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, status: status.get(n.id) ?? "idle", note: notes.get(n.id) } })));
      setEdges((es) => es.map((e) => ({ ...e, data: { ...e.data, active: status.get(e.target) === "active" && status.has(e.source) && status.get(e.source) !== "active" } })));
    },
    [result, setNodes, setEdges],
  );
  useEffect(() => {
    if (!playing || !result) return;
    const span = Math.min(9000, Math.max(3500, total / 8)); // real ms of playback
    const t0 = performance.now() - (playT / Math.max(1, total)) * span;
    const tick = (now: number) => {
      const f = Math.min(1, (now - t0) / span);
      const t = f * total;
      setPlayT(t);
      applyAt(t);
      if (f < 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
  const play = () => {
    if (!result) return runSim();
    if (playT >= total) setPlayT(0);
    setPlaying(!playing);
  };
  const stopPlayback = () => {
    setPlaying(false);
    setPlayT(0);
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, status: "idle", note: undefined } })));
    setEdges((es) => es.map((e) => ({ ...e, data: { ...e.data, active: false } })));
  };

  /* ---------- editing ---------- */
  const onConnect = useCallback(
    (c: Connection) => {
      const src = nodes.find((n) => n.id === c.source);
      setEdges((es) => addEdge({ ...c, id: `${c.source}->${c.target}-${Date.now() % 10000}`, type: "studio", markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 }, data: { weight: 1, showWeight: src?.data.kind === "router" } }, es));
    },
    [nodes, setEdges],
  );
  const addNode = (kind: NodeKind, pos?: { x: number; y: number }) => {
    const id = `${kind}-${Math.random().toString(36).slice(2, 7)}`;
    const p = pos ?? screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { id, type: "studio", position: p, selected: true, data: { kind, params: { ...KINDS[kind].defaults } } }]);
    setSelected({ type: "node", id });
    setTab("inspect");
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData("application/x-studio-kind") as NodeKind;
    if (kind && KINDS[kind]) addNode(kind, screenToFlowPosition({ x: e.clientX - 90, y: e.clientY - 30 }));
  };
  const patchNode = (id: string, patch: Partial<NodeParams>) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, params: { ...n.data.params, ...patch } } } : n)));
  const patchEdge = (id: string, weight: number) => setEdges((es) => es.map((e) => (e.id === id ? { ...e, data: { ...e.data, weight } } : e)));
  const removeSelected = () => {
    if (!selected) return;
    if (selected.type === "node") {
      setNodes((ns) => ns.filter((n) => n.id !== selected.id));
      setEdges((es) => es.filter((e) => e.source !== selected.id && e.target !== selected.id));
    } else setEdges((es) => es.filter((e) => e.id !== selected.id));
    setSelected(null);
  };
  const loadPreset = (p: Preset) => {
    const f = toFlow(p.graph);
    setNodes(f.nodes);
    setEdges(f.edges);
    setPreset(p);
    setRps(p.rps ?? 5);
    setResult(null);
    setSelected(null);
    setShowPresets(false);
    setTab("inspect");
    window.history.replaceState(null, "", `${window.location.pathname}?preset=${p.id}`);
    setTimeout(() => fitForOverlays(500), 30);
  };
  const clearAll = () => {
    if (!confirm("Start from an empty canvas? Your current design is replaced.")) return;
    const f = toFlow({ nodes: [{ id: "in", kind: "input", x: 0, y: 120, params: { ...KINDS.input.defaults } }, { id: "out", kind: "output", x: 600, y: 120, params: { ...KINDS.output.defaults } }], edges: [] });
    setNodes(f.nodes);
    setEdges(f.edges);
    setPreset(undefined);
    setResult(null);
    window.history.replaceState(null, "", window.location.pathname);
  };
  const share = async () => {
    const url = `${location.origin}${location.pathname}?g=${encodeGraph(graph)}`;
    try {
      await navigator.clipboard.writeText(url);
      flash("Share link copied");
    } catch {
      prompt("Copy this link", url);
    }
  };

  // keyboard: space plays, delete removes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === " ") {
        e.preventDefault();
        play();
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runSim();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const selNode = selected?.type === "node" ? nodes.find((n) => n.id === selected.id) : undefined;
  const selEdge = selected?.type === "edge" ? edges.find((e) => e.id === selected.id) : undefined;

  return (
    <div className="studio">
      <div className="studio-bar">
        <button className="btn small" onClick={() => setShowPresets(true)}>
          <LayoutTemplate size={14} /> {preset ? preset.title : "Custom design"}
        </button>
        <span className="studio-sep" />
        <label className="studio-ctl" title="Requests per second arriving at the system: drives GPU queueing">
          <Gauge size={14} /> <span>{rps} req/s</span>
          <input type="range" min={0.5} max={30} step={0.5} value={rps} onChange={(e) => setRps(Number(e.target.value))} aria-label="Traffic in requests per second" />
        </label>
        <label className="studio-ctl" title="How many simulated requests">
          <span>{runs.toLocaleString()} runs</span>
          <input type="range" min={100} max={5000} step={100} value={runs} onChange={(e) => setRuns(Number(e.target.value))} aria-label="Number of simulated requests" />
        </label>
        <span className="grow" />
        <button className="btn small primary" onClick={runSim} disabled={busy} title="Simulate (Ctrl+Enter)">
          <FlaskConical size={14} /> {busy ? "Simulating…" : "Simulate"}
        </button>
        <button className="btn small" onClick={play} disabled={!result && busy} title="Play the median request (Space)">
          {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? "Pause" : "Play request"}
        </button>
        {(playing || playT > 0) && <button className="icon-btn sm" onClick={stopPlayback} title="Reset playback" aria-label="Reset playback"><Square size={13} /></button>}
        <span className="studio-sep" />
        <button className="icon-btn" onClick={share} title="Copy a share link"><Share2 size={16} /></button>
        <button className="icon-btn" onClick={clearAll} title="Empty canvas"><RotateCcw size={16} /></button>
      </div>

      <div className="studio-body">
        <aside className="studio-palette">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => (
            <div key={cat} className="pal-group">
              <h4>{CATEGORY_LABEL[cat]}</h4>
              {(Object.keys(KINDS) as NodeKind[])
                .filter((k) => KINDS[k].category === cat)
                .map((k) => {
                  const Icon = KIND_ICON[k];
                  return (
                    <button
                      key={k}
                      className={`pal-item sn-${cat}`}
                      draggable
                      onDragStart={(e) => (e.dataTransfer.setData("application/x-studio-kind", k), (e.dataTransfer.effectAllowed = "move"))}
                      onClick={() => addNode(k)}
                      title={`${KINDS[k].blurb}\n\nDrag onto the canvas, or click to add.`}
                    >
                      <span className="sn-icon"><Icon size={14} /></span>
                      <span>{KINDS[k].label}</span>
                      <Plus size={13} className="pal-plus" />
                    </button>
                  );
                })}
            </div>
          ))}
          <p className="help">Drag from the right edge of a block to the left edge of another to connect them. Backspace deletes.</p>
        </aside>

        <div className="studio-canvas" onDragOver={(e) => (e.preventDefault(), (e.dataTransfer.dropEffect = "move"))} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => (setSelected({ type: "node", id: n.id }), setTab("inspect"))}
            onEdgeClick={(_, e) => (setSelected({ type: "edge", id: e.id }), setTab("inspect"))}
            onPaneClick={() => setSelected(null)}
            fitView
            fitViewOptions={fitOptions()}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
            colorMode="system"
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.3} color="var(--grid)" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="studio-minimap" />
          </ReactFlow>

          {result && result.trace.length > 0 && <Timeline result={result} t={playT} graph={graph} onSeek={(t) => (setPlaying(false), setPlayT(t), applyAt(t))} />}

          <AnimatePresence>{toast && <motion.div className="studio-toast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><Check size={14} /> {toast}</motion.div>}</AnimatePresence>
        </div>

        <aside className="studio-side">
          <div className="segmented small studio-tabs">
            {(["inspect", "results", "code"] as Tab[]).map((t) => (
              <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                {t === "inspect" ? "Inspect" : t === "results" ? "Results" : "Code"}
              </button>
            ))}
          </div>
          <div className="studio-side-body">
            {tab === "inspect" && (selNode ? <NodeInspector node={selNode} rps={rps * (result?.perNode[selNode.id] ? result.perNode[selNode.id].visits / result.runs : 1)} onChange={(p) => patchNode(selNode.id, p)} onDelete={removeSelected} /> : selEdge ? <EdgeInspector edge={selEdge} nodes={nodes} onChange={(w) => patchEdge(selEdge.id, w)} onDelete={removeSelected} /> : <EmptyInspector preset={preset} onSim={runSim} />)}
            {tab === "results" && <Results result={result} graph={graph} rps={rps} stale={stale} onSim={runSim} />}
            {tab === "code" && <CodePanel graph={graph} title={preset?.title} />}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {showPresets && (
          <motion.div className="studio-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPresets(false)}>
            <motion.div className="studio-modal-card card" initial={{ y: 16, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="row between">
                <h2>Pick a real-world RAG system</h2>
                <button className="icon-btn" onClick={() => setShowPresets(false)} aria-label="Close"><X size={16} /></button>
              </div>
              <p className="muted small">Real-world RAG systems, one per project or day of the course. Open one, press Simulate, then change a single setting and watch what moves.</p>
              <div className="preset-grid">
                {PRESETS.map((p, i) => (
                  <motion.button key={p.id} className={`preset-card${preset?.id === p.id ? " on" : ""}`} onClick={() => loadPreset(p)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <span className="tag">{p.days.length === 1 ? "Day" : "Days"} {p.days.join(", ")}</span>
                    <b>{p.title}</b>
                    <span className="muted small">{p.scenario}</span>
                    <span className="preset-kinds">
                      {[...new Set(p.graph.nodes.map((n) => n.kind))].slice(0, 7).map((k) => {
                        const Icon = KIND_ICON[k];
                        return <span key={k} className={`sn-icon sn-${KINDS[k].category}`} title={KINDS[k].label}><Icon size={12} /></span>;
                      })}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- inspector ---------- */
function Num({ label, value, onChange, min, max, step = 1, unit, pctMode }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string; pctMode?: boolean }) {
  return (
    <label className="insp-field">
      <span className="row between">
        <span>{label}</span>
        <b>{pctMode ? `${Math.round(value * 100)}%` : `${value.toLocaleString()}${unit ?? ""}`}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function NodeInspector({ node, rps, onChange, onDelete }: { node: StudioFlowNode; rps: number; onChange: (p: Partial<NodeParams>) => void; onDelete: () => void }) {
  const { kind, params: p } = node.data;
  const info = KINDS[kind];
  const Icon = KIND_ICON[kind];
  const isModel = kind === "llm" || kind === "agent" || kind === "critic" || kind === "parallel";
  return (
    <div className="insp">
      <div className={`insp-head sn-${info.category}`}>
        <span className="sn-icon"><Icon size={16} /></span>
        <div className="grow">
          <span className="tag">{info.label}</span>
          <input className="insp-title" value={p.label} onChange={(e) => onChange({ label: e.target.value })} aria-label="Name" />
        </div>
        {kind !== "input" && <button className="icon-btn sm danger" onClick={onDelete} title="Delete" aria-label="Delete block"><Trash2 size={14} /></button>}
      </div>
      <p className="small muted">{info.blurb}</p>
      <p className="insp-life small"><b>Real life:</b> {info.realLife}</p>

      {isModel && (
        <>
          <label className="insp-field">
            <span>Model tier</span>
            <div className="segmented small">
              {(Object.keys(TIERS) as Tier[]).map((t) => (
                <button key={t} className={(p.tier ?? "medium") === t ? "on" : ""} onClick={() => onChange({ tier: t })} title={`$${TIERS[t].inPrice}/$${TIERS[t].outPrice} per 1M tokens · ~${TIERS[t].ttftMs} ms to first token · ~${TIERS[t].tokPerSec} tok/s · quality ${Math.round(TIERS[t].quality * 100)}%`}>
                  {t}
                </button>
              ))}
            </div>
          </label>
          <p className="help">Example tier: ${TIERS[p.tier ?? "medium"].inPrice} in / ${TIERS[p.tier ?? "medium"].outPrice} out per 1M tokens, ~{TIERS[p.tier ?? "medium"].ttftMs} ms TTFT, ~{TIERS[p.tier ?? "medium"].tokPerSec} tok/s.</p>
          <Num label="Input tokens" value={p.inTokens ?? 1000} min={100} max={32000} step={100} onChange={(v) => onChange({ inTokens: v })} />
          <Num label="Output tokens" value={p.outTokens ?? 200} min={20} max={4000} step={10} onChange={(v) => onChange({ outTokens: v })} />
          {kind === "agent" && <Num label="Average steps" value={p.steps ?? 3} min={1} max={12} onChange={(v) => onChange({ steps: v })} />}
          {kind === "critic" && <Num label="Sent back for revision" value={p.reviseRate ?? 0.3} min={0} max={1} step={0.05} pctMode onChange={(v) => onChange({ reviseRate: v })} />}
          <label className="insp-field">
            <span>System prompt <span className="muted">(used in live runs)</span></span>
            <textarea rows={4} value={p.system ?? ""} onChange={(e) => onChange({ system: e.target.value })} />
          </label>
        </>
      )}
      {(kind === "tool" || kind === "memory" || kind === "retriever" || kind === "reranker" || kind === "guardrail" || kind === "cache" || kind === "router" || kind === "cascade") && (
        <Num label="Latency" value={p.latencyMs ?? 50} min={1} max={5000} step={1} unit=" ms" onChange={(v) => onChange({ latencyMs: v })} />
      )}
      {kind === "tool" && (
        <label className="insp-field">
          <span>Tool type</span>
          <select value={p.toolKind ?? "api"} onChange={(e) => onChange({ toolKind: e.target.value as NodeParams["toolKind"] })}>
            <option value="search">Web search</option>
            <option value="api">External API</option>
            <option value="db">Database</option>
            <option value="code">Code runner</option>
            <option value="calculator">Calculator (real in live runs)</option>
          </select>
        </label>
      )}
      {(kind === "tool" || kind === "memory" || kind === "retriever" || kind === "reranker" || kind === "replicas") && <Num label="Failure rate" value={p.failRate ?? 0} min={0} max={0.5} step={0.005} pctMode onChange={(v) => onChange({ failRate: v })} />}
      {(kind === "tool" || kind === "memory") && <Num label="Retries" value={p.retries ?? 0} min={0} max={4} onChange={(v) => onChange({ retries: v })} />}
      {(kind === "tool" || kind === "reranker" || kind === "guardrail") && <Num label="Cost per call" value={p.costPerCall ?? 0} min={0} max={0.05} step={0.0005} unit=" $" onChange={(v) => onChange({ costPerCall: v })} />}
      {kind === "retriever" && (
        <>
          <Num label="Recall (evidence in top-k)" value={p.recall ?? 0.8} min={0.2} max={1} step={0.01} pctMode onChange={(v) => onChange({ recall: v })} />
          <Num label="Top-k" value={p.topK ?? 5} min={1} max={20} onChange={(v) => onChange({ topK: v })} />
          <label className="insp-field">
            <span>Documents <span className="muted">(live runs; one per paragraph)</span></span>
            <textarea rows={6} value={p.docs ?? ""} onChange={(e) => onChange({ docs: e.target.value })} />
          </label>
        </>
      )}
      {kind === "reranker" && <Num label="Retrieval misses rescued" value={p.lift ?? 0.5} min={0} max={1} step={0.05} pctMode onChange={(v) => onChange({ lift: v })} />}
      {kind === "cascade" && <Num label="Escalated to the 2nd branch" value={p.escalateRate ?? 0.25} min={0} max={1} step={0.01} pctMode onChange={(v) => onChange({ escalateRate: v })} />}
      {kind === "guardrail" && <Num label="Blocked" value={p.blockRate ?? 0} min={0} max={0.5} step={0.005} pctMode onChange={(v) => onChange({ blockRate: v })} />}
      {kind === "human" && (
        <>
          <Num label="Approved" value={p.approveRate ?? 0.9} min={0} max={1} step={0.01} pctMode onChange={(v) => onChange({ approveRate: v })} />
          <Num label="Time to respond" value={Math.round((p.waitMs ?? 30000) / 1000)} min={1} max={600} unit=" s" onChange={(v) => onChange({ waitMs: v * 1000 })} />
        </>
      )}
      {kind === "cache" && <Num label="Hit rate" value={p.hitRate ?? 0.2} min={0} max={0.95} step={0.01} pctMode onChange={(v) => onChange({ hitRate: v })} />}
      {kind === "replicas" && p.model && <SizingCard node={node} rps={rps} onChange={onChange} />}
      {kind === "replicas" && !p.model && (
        <>
          <button className="btn small" onClick={() => onChange({ model: "8b", gpu: "h100", precision: "fp16", kvPrecision: "fp16", maxBatch: 64, inTokens: p.inTokens ?? 1500, outTokens: p.outTokens ?? 300 })}>Size it from a real model and GPU</button>
          <Num label="Replicas" value={p.replicas ?? 2} min={1} max={16} onChange={(v) => onChange({ replicas: v })} />
          <Num label="Service time per request" value={p.serviceMs ?? 900} min={50} max={6000} step={10} unit=" ms" onChange={(v) => onChange({ serviceMs: v })} />
          <p className="help">Capacity ≈ replicas × 1000 ÷ service ms = {(((p.replicas ?? 2) * 1000) / (p.serviceMs ?? 900)).toFixed(1)} req/s. Watch what happens past ~70% of it.</p>
        </>
      )}
      {kind === "input" && (
        <>
          <Num label="Questions that need your own data" value={p.knowledgeShare ?? 0} min={0} max={1} step={0.05} pctMode onChange={(v) => onChange({ knowledgeShare: v })} />
          <p className="help">Policies, orders, internal docs: a model can only answer these correctly if retrieval or a lookup gives it the facts. Without them it guesses, confidently.</p>
        </>
      )}
      {kind === "gateway" && <Num label="Rate limit" value={p.rateLimit ?? 50} min={1} max={500} unit=" req/s" onChange={(v) => onChange({ rateLimit: v })} />}
      {kind === "queue" && (
        <>
          <Num label="Workers" value={p.replicas ?? 4} min={1} max={64} onChange={(v) => onChange({ replicas: v })} />
          <Num label="Time per job" value={p.serviceMs ?? 400} min={10} max={20000} step={10} unit=" ms" onChange={(v) => onChange({ serviceMs: v })} />
        </>
      )}
      {(kind === "embedder" || kind === "database") && (
        <>
          <Num label="Latency" value={p.latencyMs ?? 20} min={1} max={2000} unit=" ms" onChange={(v) => onChange({ latencyMs: v })} />
          <Num label="Failure rate" value={p.failRate ?? 0} min={0} max={0.3} step={0.005} pctMode onChange={(v) => onChange({ failRate: v })} />
        </>
      )}
      {kind === "router" && <p className="help">Click an outgoing edge to set its share of traffic.</p>}
      {kind === "parallel" && <p className="help">Every outgoing branch runs at once; they should meet again at one block (for example a writer), where this supervisor merges them.</p>}
      {kind === "cascade" && <p className="help">The first outgoing edge is the cheap branch, the second the strong one.</p>}
    </div>
  );
}

function EdgeInspector({ edge, nodes, onChange, onDelete }: { edge: StudioFlowEdge; nodes: StudioFlowNode[]; onChange: (w: number) => void; onDelete: () => void }) {
  const a = nodes.find((n) => n.id === edge.source);
  const b = nodes.find((n) => n.id === edge.target);
  return (
    <div className="insp">
      <div className="insp-head">
        <div className="grow">
          <span className="tag">Connection</span>
          <b>{a?.data.params.label} → {b?.data.params.label}</b>
        </div>
        <button className="icon-btn sm danger" onClick={onDelete} title="Delete" aria-label="Delete connection"><Trash2 size={14} /></button>
      </div>
      {a?.data.kind === "router" ? <Num label="Share of traffic (relative weight)" value={edge.data?.weight ?? 1} min={0} max={10} step={0.5} unit="×" onChange={onChange} /> : <p className="small muted">Requests flow along this connection. Weights only matter for edges leaving a Router.</p>}
    </div>
  );
}

function EmptyInspector({ preset, onSim }: { preset?: Preset; onSim: () => void }) {
  return (
    <div className="insp empty">
      {preset && (
        <div className="brief">
          <span className="tag">Scenario</span>
          <b>{preset.title}</b>
          <p className="small">{preset.scenario}</p>
          <h4><Lightbulb size={13} /> Try this</h4>
          <ol className="small">{preset.tryThis.map((t) => <li key={t}>{t}</li>)}</ol>
          <p className="brief-links small">
            Learn it:{" "}
            {preset.days.map((d, i) => (
              <span key={d}>
                {i > 0 && ", "}
                <Link href={dayPath(d)}>Day {String(d).padStart(2, "0")}</Link>
              </span>
            ))}
            {preset.project && (
              <>
                {" "}· Build it: <Link href={`/projects/${preset.project}`}>project {preset.project.slice(0, 2)}</Link>
              </>
            )}
          </p>
        </div>
      )}
      <h3>{preset ? "Then make it yours." : "Build, then measure."}</h3>
      <ol className="small">
        <li>Pick a starting system (top left) or drag blocks from the left.</li>
        <li>Click a block to change it: model tier, recall, retries, replicas…</li>
        <li>Press <b>Simulate</b> to push 1,000 requests through it and see p50/p95/p99, cost and correctness.</li>
        <li>Press <b>Play request</b> to watch one typical request move through.</li>
        <li><b>Code</b> turns your design into a Python program you can run.</li>
      </ol>
      <button className="btn primary small" onClick={onSim}><FlaskConical size={14} /> Simulate now</button>
    </div>
  );
}

/* ---------- results ---------- */
function Histogram({ samples, marks }: { samples: number[]; marks: { label: string; v: number }[] }) {
  if (!samples.length) return null;
  const max = samples[Math.floor(samples.length * 0.995)] || samples[samples.length - 1];
  const bins = 28;
  const counts = Array(bins).fill(0);
  for (const s of samples) counts[Math.min(bins - 1, Math.floor((s / Math.max(1, max)) * bins))]++;
  const top = Math.max(...counts);
  return (
    <svg className="hist" viewBox="0 0 280 90" role="img" aria-label="Latency distribution">
      {counts.map((c, i) => (
        <rect key={i} x={i * 10} y={78 - (c / top) * 70} width={8.5} height={(c / top) * 70} rx={1.5} />
      ))}
      {marks.map((m) => {
        const x = Math.min(278, (m.v / Math.max(1, max)) * 280);
        return (
          <g key={m.label}>
            <line x1={x} x2={x} y1={4} y2={80} className="hist-mark" />
            <text x={Math.min(262, x + 2)} y={10} className="hist-text">{m.label}</text>
          </g>
        );
      })}
      <line x1={0} x2={280} y1={80} y2={80} className="hist-axis" />
      <text x={0} y={89} className="hist-text">0</text>
      <text x={280} y={89} textAnchor="end" className="hist-text">{fmtMs(max)}</text>
    </svg>
  );
}

function Results({ result, graph, rps, stale, onSim }: { result: SimResult | null; graph: StudioGraph; rps: number; stale: boolean; onSim: () => void }) {
  if (!result)
    return (
      <div className="insp empty">
        <p className="muted small">No results yet.</p>
        <button className="btn primary small" onClick={onSim}><FlaskConical size={14} /> Simulate</button>
      </div>
    );
  const r = result;
  const rows = graph.nodes
    .map((n) => ({ n, s: r.perNode[n.id] }))
    .filter((x) => x.s?.visits)
    .sort((a, b) => b.s.meanMs * b.s.visits - a.s.meanMs * a.s.visits);
  const totalMs = rows.reduce((s, x) => s + x.s.meanMs * x.s.visits, 0) || 1;
  return (
    <div className="results">
      {stale && <p className="hint warm">You changed the design since this run. <button className="linkish" onClick={onSim}>Re-run</button></p>}
      <div className="res-grid">
        <div className="res"><span>Answered</span><b>{pct(r.completed, r.runs)}</b><small>{r.blocked ? `${pct(r.blocked, r.runs)} blocked · ` : ""}{pct(r.failed, r.runs)} failed</small></div>
        <div className="res"><span>Correct</span><b className={r.correct / Math.max(1, r.completed) > 0.8 ? "good" : "warm"}>{pct(r.correct, r.completed)}</b></div>
        <div className="res"><span>p50</span><b>{fmtMs(r.latency.p50)}</b></div>
        <div className="res"><span>p99</span><b>{fmtMs(r.latency.p99)}</b></div>
        <div className="res"><span>Cost / 1k req</span><b>${(r.costPerRequest * 1000).toFixed(2)}</b></div>
        <div className="res"><span>Tokens</span><b>{Math.round(r.tokensPerRequest).toLocaleString()}</b><small>per request</small></div>
      </div>
      <Capacity graph={graph} result={r} rps={rps} />
      <h4>Latency distribution</h4>
      <Histogram samples={r.samples} marks={[{ label: "p50", v: r.latency.p50 }, { label: "p95", v: r.latency.p95 }, { label: "p99", v: r.latency.p99 }]} />
      {r.insights.length > 0 && (
        <>
          <h4><Lightbulb size={13} /> What this tells you</h4>
          <ul className="insights">{r.insights.map((t) => <li key={t}>{t}</li>)}</ul>
        </>
      )}
      <h4>Where the time goes</h4>
      <div className="breakdown">
        {rows.map(({ n, s }) => (
          <div key={n.id} className="bd-row">
            <span className="bd-name">{n.params.label}</span>
            <span className="bd-bar"><span style={{ width: `${((s.meanMs * s.visits) / totalMs) * 100}%` }} /></span>
            <span className="bd-val">{fmtMs(s.meanMs)}</span>
          </div>
        ))}
      </div>
      <p className="help">Simulated with example prices and speeds. Use it to compare designs, then measure the real thing.</p>
    </div>
  );
}

function Timeline({ result, t, graph, onSeek }: { result: SimResult; t: number; graph: StudioGraph; onSeek: (t: number) => void }) {
  const end = Math.max(1, ...result.trace.map((e) => e.end));
  const rowsOrder = [...new Set(result.trace.map((e) => e.node))];
  const name = (id: string) => graph.nodes.find((n) => n.id === id)?.params.label ?? id;
  return (
    <div className="timeline card">
      <div className="row between">
        <span className="tag">One typical request (median) · {fmtMs(end)}</span>
        <span className="tag">{fmtMs(t)}</span>
      </div>
      <div
        className="tl-body"
        onClick={(e) => {
          const box = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          onSeek(Math.max(0, Math.min(1, (e.clientX - box.left - 120) / (box.width - 120))) * end);
        }}
      >
        {rowsOrder.map((id) => (
          <div key={id} className="tl-row">
            <span className="tl-name">{name(id)}</span>
            <span className="tl-track">
              {result.trace
                .filter((e) => e.node === id)
                .map((e, i) => (
                  <span key={i} className={`tl-bar ${e.status}${t >= e.start && t <= e.end ? " now" : ""}`} style={{ left: `${(e.start / end) * 100}%`, width: `max(3px, ${((e.end - e.start) / end) * 100}%)` }} title={`${name(id)}: ${fmtMs(e.end - e.start)}${e.note ? ` · ${e.note}` : ""}`} />
                ))}
            </span>
          </div>
        ))}
        <span className="tl-cursor" style={{ left: `calc(120px + (100% - 120px) * ${t / end})` }} />
      </div>
    </div>
  );
}

/* ---------- code ---------- */
function CodePanel({ graph, title }: { graph: StudioGraph; title?: string }) {
  const code = useMemo(() => toPython(graph, title), [graph, title]);
  const [copied, setCopied] = useState(false);
  return (
    <div className="codepanel">
      <p className="small muted">Your design as a plain-Python program: one function per block, simulated parts marked TODO. Implement them and you have built it.</p>
      <div className="row gap">
        <button className="btn small" onClick={() => navigator.clipboard.writeText(code).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}</button>
        <button
          className="btn small"
          onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([code], { type: "text/x-python" }));
            a.download = "app.py";
            a.click();
          }}
        >
          <Download size={14} /> app.py
        </button>
        <span className="muted small"><Code size={13} /> {code.split("\n").length} lines</span>
      </div>
      <pre className="code">{code}</pre>
    </div>
  );
}


/* ---------- GPU sizing ---------- */
const gb = (x: number) => `${x >= 100 ? x.toFixed(0) : x.toFixed(1)} GB`;
function SizingCard({ node, rps, onChange }: { node: StudioFlowNode; rps: number; onChange: (p: Partial<NodeParams>) => void }) {
  const p = node.data.params;
  const pool = poolOf({ id: node.id, kind: "replicas", x: 0, y: 0, params: p }, rps);
  const sz = pool.sizing!;
  const need = sz.ok ? replicasFor(sz, rps) : 0;
  const reps = p.replicas ?? 1;
  const util = sz.ok ? rps / Math.max(1e-9, reps * sz.reqPerSec) : Infinity;
  return (
    <div className="sizing">
      <div className="sizing-grid">
        <label className="insp-field">
          <span>Model</span>
          <select value={p.model} onChange={(e) => onChange({ model: e.target.value })}>{Object.entries(MODELS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</select>
        </label>
        <label className="insp-field">
          <span>GPU</span>
          <select value={p.gpu ?? "h100"} onChange={(e) => onChange({ gpu: e.target.value })}>{Object.entries(GPUS).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}</select>
        </label>
        <div className="insp-field">
          <span>Weights</span>
          <div className="segmented small">{(["fp16", "fp8", "int4"] as const).map((x) => <button key={x} className={(p.precision ?? "fp16") === x ? "on" : ""} onClick={() => onChange({ precision: x })}>{x.toUpperCase()}</button>)}</div>
        </div>
        <div className="insp-field">
          <span>KV cache</span>
          <div className="segmented small">{(["fp16", "fp8"] as const).map((x) => <button key={x} className={(p.kvPrecision ?? "fp16") === x ? "on" : ""} onClick={() => onChange({ kvPrecision: x })}>{x.toUpperCase()}</button>)}</div>
        </div>
      </div>
      <Num label="Prompt tokens per request" value={p.inTokens ?? 1500} min={100} max={32000} step={100} onChange={(v) => onChange({ inTokens: v })} />
      <Num label="Output tokens per request" value={p.outTokens ?? 300} min={20} max={4000} step={10} onChange={(v) => onChange({ outTokens: v })} />
      <Num label="Max concurrent sequences" value={p.maxBatch ?? 64} min={1} max={512} onChange={(v) => onChange({ maxBatch: v })} />
      <Num label="Replicas" value={reps} min={1} max={32} onChange={(v) => onChange({ replicas: v })} />

      {!sz.ok ? (
        <p className="warn-note"><span>{sz.why}</span></p>
      ) : (
        <>
          <h4>One replica, worked out</h4>
          <table className="sizing-table">
            <tbody>
              <tr><th>GPUs per replica</th><td>{sz.tp}{sz.tp > 1 ? " (tensor parallel)" : ""}</td></tr>
              <tr><th>Weights</th><td>{gb(sz.weightsGB)}</td></tr>
              <tr><th>KV cache per token</th><td>{sz.kvPerTokenKB.toFixed(0)} KB</td></tr>
              <tr><th>KV cache per request</th><td>{sz.kvPerRequestMB.toFixed(0)} MB</td></tr>
              <tr><th>Memory left for KV</th><td>{gb(sz.kvBudgetGB)} → {sz.fitSeqs.toLocaleString()} requests fit</td></tr>
              <tr><th>Batch used</th><td>{sz.batch}</td></tr>
              <tr><th>Decode step at that batch</th><td>{sz.stepMs.toFixed(1)} ms · {sz.bound}-bound</td></tr>
              <tr><th>Speed for one user alone</th><td>~{Math.round(sz.tokPerSecPerUser)} tok/s</td></tr>
              <tr><th>Time to first token</th><td>{fmtMs(sz.ttftMs)}</td></tr>
              <tr><th>Full answer at full batch</th><td>{fmtMs(sz.latencyMs)}</td></tr>
              <tr><th>Capacity</th><td>{sz.reqPerSec.toFixed(1)} req/s · {Math.round(sz.tokPerSec).toLocaleString()} tok/s</td></tr>
              <tr><th>Cost</th><td>${sz.pricePerHour.toFixed(2)}/h · ${sz.costPer1MOut.toFixed(2)} per 1M output tokens at capacity</td></tr>
            </tbody>
          </table>
          <div className={`sizing-verdict${util > 0.85 ? " bad" : util > 0.7 ? " warm" : " good"}`}>
            <b>At {rps.toFixed(1)} req/s here: {Number.isFinite(util) ? `${Math.round(util * 100)}% busy` : "overloaded"}</b>
            <span>
              {need} replica{need === 1 ? "" : "s"} ({need * sz.tp} GPU{need * sz.tp === 1 ? "" : "s"}) keep this pool under 70%: about ${(need * sz.pricePerHour * 730).toLocaleString(undefined, { maximumFractionDigits: 0 })}/month.
            </span>
            {need !== reps && <button className="btn small" onClick={() => onChange({ replicas: need })}>Use {need} replica{need === 1 ? "" : "s"}</button>}
          </div>
          <p className="help">Estimates from datasheet bandwidth and compute at realistic efficiency (70% and 45% of peak). Measure your own engine before you buy.</p>
        </>
      )}
    </div>
  );
}

function Capacity({ graph, result, rps }: { graph: StudioGraph; result: SimResult; rps: number }) {
  const pools = graph.nodes.filter((n) => n.kind === "replicas");
  if (!pools.length) return null;
  const rows = pools.map((n) => {
    const share = result.perNode[n.id] ? result.perNode[n.id].visits / result.runs : 0;
    const pl = poolOf(n, rps * share);
    const util = pl.capacityRps > 0 ? (rps * share) / pl.capacityRps : Infinity;
    return { n, pl, util, load: rps * share };
  });
  const gpus = rows.reduce((s, r) => s + r.pl.gpus, 0);
  const hour = rows.reduce((s, r) => s + r.pl.pricePerHour, 0);
  return (
    <>
      <h4>GPU capacity</h4>
      <div className="capacity">
        {rows.map(({ n, pl, util, load }) => (
          <div key={n.id} className="cap-row">
            <span className="cap-name">{n.params.label}</span>
            <span className="bd-bar"><span className={util > 0.85 ? "bad" : util > 0.7 ? "warm" : ""} style={{ width: `${Math.min(100, util * 100)}%` }} /></span>
            <span className="cap-val">{Number.isFinite(util) ? `${Math.round(util * 100)}%` : "—"}</span>
            <small className="muted">{load.toFixed(1)} of {pl.capacityRps.toFixed(1)} req/s · {pl.gpus} GPU{pl.gpus === 1 ? "" : "s"}</small>
          </div>
        ))}
        <p className="cap-total"><b>{gpus} GPUs</b> · ${hour.toFixed(2)}/hour · about ${(hour * 730).toLocaleString(undefined, { maximumFractionDigits: 0 })}/month running 24/7</p>
      </div>
    </>
  );
}
