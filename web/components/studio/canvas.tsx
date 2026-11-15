"use client";
import { BaseEdge, EdgeLabelRenderer, Handle, Position, getBezierPath, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import { Binary, Bot, CircleCheck, Cpu, Database, DoorOpen, GitFork, Layers, ListOrdered, MessageSquare, Network, Rows3, Scale, Search, ShieldCheck, Sparkles, SpellCheck, Table2, UserCheck, Wrench, Zap, type LucideIcon } from "lucide-react";
import { poolOf } from "@/lib/studio/simulate";
import { memo } from "react";
import { KINDS, TIERS } from "@/lib/studio/catalog";
import type { NodeKind, NodeParams, NodeStats } from "@/lib/studio/types";

export const KIND_ICON: Record<NodeKind, LucideIcon> = {
  input: MessageSquare,
  output: CircleCheck,
  llm: Sparkles,
  agent: Bot,
  tool: Wrench,
  retriever: Search,
  reranker: ListOrdered,
  memory: Database,
  router: GitFork,
  cascade: Layers,
  parallel: Network,
  guardrail: ShieldCheck,
  human: UserCheck,
  cache: Zap,
  critic: SpellCheck,
  replicas: Cpu,
  gateway: DoorOpen,
  balancer: Scale,
  queue: Rows3,
  embedder: Binary,
  database: Table2,
};

export type RunStatus = "idle" | "active" | "ok" | "fail" | "blocked" | "hit";

export interface NodeData extends Record<string, unknown> {
  kind: NodeKind;
  params: NodeParams;
  stats?: NodeStats;
  runs?: number;
  status?: RunStatus;
  note?: string;
}
export type StudioFlowNode = Node<NodeData, "studio">;

export interface EdgeData extends Record<string, unknown> {
  weight?: number;
  showWeight?: boolean;
  active?: boolean;
  share?: number;
}
export type StudioFlowEdge = Edge<EdgeData, "studio">;

const ms = (x: number) => (x >= 10000 ? `${(x / 1000).toFixed(0)} s` : x >= 1000 ? `${(x / 1000).toFixed(1)} s` : `${Math.round(x)} ms`);

/** a one-line summary of the settings that matter for this kind */
export function summary(kind: NodeKind, p: NodeParams): string {
  switch (kind) {
    case "llm":
    case "critic":
    case "parallel":
      return `${TIERS[p.tier ?? "medium"].label.split(" ")[0]} · ${p.outTokens ?? 0} out tok${kind === "critic" ? ` · revise ${Math.round((p.reviseRate ?? 0) * 100)}%` : ""}`;
    case "agent":
      return `${TIERS[p.tier ?? "medium"].label.split(" ")[0]} · ~${p.steps ?? 3} steps`;
    case "tool":
      return `${p.toolKind ?? "api"} · ${ms(p.latencyMs ?? 0)} · fails ${Math.round((p.failRate ?? 0) * 100)}%`;
    case "retriever":
      return `recall ${Math.round((p.recall ?? 0) * 100)}% · top ${p.topK ?? 5}`;
    case "reranker":
      return `rescues ${Math.round((p.lift ?? 0) * 100)}% of misses`;
    case "cascade":
      return `escalates ${Math.round((p.escalateRate ?? 0) * 100)}%`;
    case "guardrail":
      return `blocks ${Math.round((p.blockRate ?? 0) * 100)}% · ${ms(p.latencyMs ?? 0)}`;
    case "human":
      return `approves ${Math.round((p.approveRate ?? 0) * 100)}% · ~${ms(p.waitMs ?? 0)}`;
    case "cache":
      return `hit rate ${Math.round((p.hitRate ?? 0) * 100)}%`;
    case "replicas": {
      const pool = poolOf({ id: "", kind, x: 0, y: 0, params: p });
      if (pool.sizing) return pool.sizing.ok ? `${p.replicas ?? 1} × ${pool.sizing.tp} GPU · batch ${pool.sizing.batch} · ${pool.sizing.reqPerSec.toFixed(1)} req/s each` : "doesn't fit: open to resize";
      return `${p.replicas ?? 1} replica${(p.replicas ?? 1) === 1 ? "" : "s"} · ${ms(p.serviceMs ?? 0)}/req`;
    }
    case "queue":
      return `${p.replicas ?? 1} workers · ${ms(p.serviceMs ?? 0)}/job`;
    case "gateway":
      return `limit ${p.rateLimit ?? "∞"} req/s · ${ms(p.latencyMs ?? 0)}`;
    case "embedder":
    case "database":
      return `${ms(p.latencyMs ?? 0)} · fails ${Math.round((p.failRate ?? 0) * 1000) / 10}%`;
    case "input":
      return p.knowledgeShare ? `${Math.round(p.knowledgeShare * 100)}% need your data` : "general questions";
    case "memory":
      return ms(p.latencyMs ?? 0);
    default:
      return KINDS[kind].label;
  }
}

export const StudioNodeView = memo(function StudioNodeView({ data, selected }: NodeProps<StudioFlowNode>) {
  const Icon = KIND_ICON[data.kind];
  const info = KINDS[data.kind];
  const s = data.stats;
  const share = s && data.runs ? s.visits / data.runs : 0;
  return (
    <div className={`sn sn-${info.category} sn-${data.status ?? "idle"}${selected ? " sel" : ""}`}>
      {data.kind !== "input" && <Handle type="target" position={Position.Left} className="sn-handle" />}
      <div className="sn-top">
        <span className="sn-icon"><Icon size={15} /></span>
        <span className="sn-kind">{info.label}</span>
        {data.status === "active" && <span className="sn-pulse" aria-label="running" />}
      </div>
      <div className="sn-label">{data.params.label}</div>
      <div className="sn-sum">{summary(data.kind, data.params)}</div>
      {s && s.visits > 0 && (
        <div className="sn-stats">
          <span title="Mean time in this step">{ms(s.meanMs)}</span>
          {s.cost > 0 && <span title="Spend per 1,000 requests">${((s.cost / (data.runs ?? 1)) * 1000).toFixed(2)}/1k</span>}
          <span title="Share of requests reaching this step">{Math.round(share * 100)}%</span>
          {s.failures > 0 && <span className="bad" title="Requests that failed here">{s.failures} fail</span>}
        </div>
      )}
      {data.note && <div className="sn-note">{data.note}</div>}
      {data.kind !== "output" && <Handle type="source" position={Position.Right} className="sn-handle" />}
    </div>
  );
});

export function StudioEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd }: EdgeProps<StudioFlowEdge>) {
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const width = data?.share ? 1.5 + Math.min(4, data.share * 4) : 1.5;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={`se${data?.active ? " active" : ""}${selected ? " sel" : ""}`} style={{ strokeWidth: width }} />
      {data?.active && (
        <circle r={5} className="se-packet">
          <animateMotion dur="0.7s" repeatCount="indefinite" path={path} />
        </circle>
      )}
      {data?.showWeight && (
        <EdgeLabelRenderer>
          <div className="se-label nodrag nopan" style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}>
            {data.weight ?? 1}×
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const nodeTypes = { studio: StudioNodeView };
export const edgeTypes = { studio: StudioEdgeView };
