/** Agent Studio: a graph of AI building blocks you can simulate (free, instant) or run live (your AI key). */
export type NodeKind =
  | "input"
  | "llm"
  | "agent"
  | "tool"
  | "retriever"
  | "reranker"
  | "memory"
  | "router"
  | "cascade"
  | "parallel"
  | "guardrail"
  | "human"
  | "cache"
  | "critic"
  | "replicas"
  | "gateway"
  | "balancer"
  | "queue"
  | "embedder"
  | "database"
  | "output";

export type Tier = "small" | "medium" | "large";

export interface NodeParams {
  label: string;
  /** llm, agent, critic, parallel (its merge step) */
  tier?: Tier;
  inTokens?: number;
  outTokens?: number;
  /** system prompt, used in live runs */
  system?: string;
  /** agent: average reasoning/tool steps per request */
  steps?: number;
  /** tool, retriever, reranker, memory, guardrail, cache */
  latencyMs?: number;
  failRate?: number;
  /** dollars per call for non-LLM nodes (search API, reranker, etc.) */
  costPerCall?: number;
  retries?: number;
  toolKind?: "search" | "api" | "code" | "db" | "calculator";
  /** retriever: chance the right evidence is in the top-k */
  recall?: number;
  topK?: number;
  /** retriever: documents used in live runs, one per paragraph */
  docs?: string;
  /** reranker: share of retrieval misses it rescues */
  lift?: number;
  /** cascade: share of requests escalated to the strong model */
  escalateRate?: number;
  /** guardrail: share of requests blocked */
  blockRate?: number;
  /** human: share approved, and how long they take */
  approveRate?: number;
  waitMs?: number;
  /** cache: share of requests answered from cache */
  hitRate?: number;
  /** critic: share of drafts sent back for revision */
  reviseRate?: number;
  /** replicas (GPU pool) / queue workers: count and mean service time per request */
  replicas?: number;
  serviceMs?: number;
  /** GPU pool sizing: when `model` is set, slots and service time come from src/studio/sizing.ts */
  model?: string;
  gpu?: string;
  precision?: "fp16" | "fp8" | "int4";
  kvPrecision?: "fp16" | "fp8";
  maxBatch?: number;
  /** GPUs per replica; 0 or unset = smallest that fits */
  tp?: number;
  /** input: share of questions that need private knowledge (only retrieval can answer them) */
  knowledgeShare?: number;
  /** gateway: requests per second allowed before rate limiting */
  rateLimit?: number;
}

export interface StudioNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  params: NodeParams;
}

export interface StudioEdge {
  id: string;
  source: string;
  target: string;
  /** router: relative share of traffic down this edge */
  weight?: number;
}

export interface StudioGraph {
  nodes: StudioNode[];
  edges: StudioEdge[];
}

export interface TraceEvent {
  node: string;
  start: number;
  end: number;
  status: "ok" | "fail" | "blocked" | "hit" | "retry";
  note?: string;
}

export interface NodeStats {
  visits: number;
  /** mean time spent in this node per request that visited it */
  meanMs: number;
  /** total dollars across all runs */
  cost: number;
  failures: number;
}

export interface SimResult {
  runs: number;
  completed: number;
  correct: number;
  blocked: number;
  failed: number;
  latency: { mean: number; p50: number; p95: number; p99: number };
  /** latency of every completed request, for the histogram */
  samples: number[];
  costPerRequest: number;
  tokensPerRequest: number;
  perNode: Record<string, NodeStats>;
  /** the run closest to the median latency, for playback */
  trace: TraceEvent[];
  insights: string[];
}
