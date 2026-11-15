import type { NodeKind, NodeParams, Tier } from "./types";

/**
 * Illustrative model tiers. Prices are dollars per 1M tokens; they are round example numbers in the range of 2026 small /
 * mid / frontier models, not any vendor's price list. Tune them in the inspector to match your provider.
 */
export const TIERS: Record<Tier, { label: string; inPrice: number; outPrice: number; ttftMs: number; tokPerSec: number; quality: number; errorRate: number }> = {
  small: { label: "Small (fast, cheap)", inPrice: 0.15, outPrice: 0.6, ttftMs: 250, tokPerSec: 140, quality: 0.72, errorRate: 0.004 },
  medium: { label: "Medium", inPrice: 1, outPrice: 4, ttftMs: 450, tokPerSec: 90, quality: 0.84, errorRate: 0.004 },
  large: { label: "Large (frontier)", inPrice: 3, outPrice: 15, ttftMs: 800, tokPerSec: 55, quality: 0.92, errorRate: 0.006 },
};

export type Category = "io" | "model" | "knowledge" | "control" | "safety" | "infra";

export interface KindInfo {
  label: string;
  category: Category;
  /** what it does, one sentence */
  blurb: string;
  /** an everyday picture */
  realLife: string;
  defaults: NodeParams;
}

export const KINDS: Record<NodeKind, KindInfo> = {
  input: { label: "User request", category: "io", blurb: "Where a request enters the system. Set how many questions need your private data: only retrieval (or a tool) can answer those correctly.", realLife: "A customer walking up to the counter.", defaults: { label: "User request", inTokens: 60, knowledgeShare: 0 } },
  output: { label: "Answer", category: "io", blurb: "Where the response leaves the system.", realLife: "The order handed over the counter.", defaults: { label: "Answer" } },
  llm: {
    label: "LLM call",
    category: "model",
    blurb: "One model call: prompt in, text out. Latency = time to first token + output tokens ÷ speed.",
    realLife: "Asking one expert a single question and waiting for the full reply.",
    defaults: { label: "LLM", tier: "medium", inTokens: 1500, outTokens: 300, system: "You are a helpful assistant. Answer concisely." },
  },
  agent: {
    label: "Agent",
    category: "model",
    blurb: "A model in a loop: think, call a connected tool, read the result, repeat until done. More steps = more latency, cost and chances to fail.",
    realLife: "A travel agent who phones the airline, then the hotel, then calls you back.",
    defaults: { label: "Agent", tier: "medium", inTokens: 2500, outTokens: 250, steps: 3, system: "You are an agent. Think step by step, use tools when needed, then answer." },
  },
  tool: {
    label: "Tool",
    category: "knowledge",
    blurb: "An API, search, code runner or database the agent can call. Real tools are slow and sometimes fail.",
    realLife: "A phone call to another office that might be busy.",
    defaults: { label: "Web search", toolKind: "search", latencyMs: 700, failRate: 0.03, costPerCall: 0.005, retries: 1 },
  },
  retriever: {
    label: "Retriever",
    category: "knowledge",
    blurb: "Finds the top-k chunks for the question. Recall = how often the right evidence is among them.",
    realLife: "A librarian pulling the five most likely books off the shelf.",
    defaults: {
      label: "Vector search",
      latencyMs: 60,
      failRate: 0.001,
      recall: 0.8,
      topK: 5,
      docs: "Refunds are issued within 7 days of a return being received.\n\nOrders over 2,000 rupees ship free.\n\nYou can change the delivery address until the order is packed.",
    },
  },
  reranker: {
    label: "Reranker",
    category: "knowledge",
    blurb: "Re-scores a wider set of retrieved chunks and keeps the best. Rescues some retrieval misses for extra latency.",
    realLife: "A second librarian who skims the pile and puts the best book on top.",
    defaults: { label: "Reranker", latencyMs: 120, failRate: 0.002, lift: 0.5, costPerCall: 0.001 },
  },
  memory: {
    label: "Memory",
    category: "knowledge",
    blurb: "Reads or writes long-term facts about the user or task.",
    realLife: "The notebook a doctor checks before your appointment.",
    defaults: { label: "User memory", latencyMs: 25, failRate: 0.001 },
  },
  router: {
    label: "Router",
    category: "control",
    blurb: "Sends each request down one branch. Set each outgoing edge's share of traffic.",
    realLife: "The hospital triage desk sending you to the right department.",
    defaults: { label: "Intent router", latencyMs: 15 },
  },
  cascade: {
    label: "Cascade",
    category: "control",
    blurb: "Tries the first branch (cheap); escalates a share of requests to the second (strong).",
    realLife: "A junior support agent who escalates the hard tickets to a senior.",
    defaults: { label: "Cascade", escalateRate: 0.25, latencyMs: 5 },
  },
  parallel: {
    label: "Supervisor / fan-out",
    category: "control",
    blurb: "Runs all outgoing branches at once, waits for the slowest, then merges with one model call.",
    realLife: "A wedding planner who sends the caterer, florist and DJ off at once, then puts the day together.",
    defaults: { label: "Supervisor", tier: "medium", inTokens: 3000, outTokens: 400, system: "You coordinate specialists and merge their findings into one answer." },
  },
  guardrail: {
    label: "Guardrail",
    category: "safety",
    blurb: "Checks input or output (injection, PII, policy) and blocks a share of requests.",
    realLife: "Airport security: quick for most, but some bags get pulled aside.",
    defaults: { label: "Input guardrail", latencyMs: 80, blockRate: 0.03, failRate: 0 },
  },
  human: {
    label: "Human approval",
    category: "safety",
    blurb: "Pauses for a person to approve risky actions. Safe, but slow.",
    realLife: "A manager signing off on a large refund.",
    defaults: { label: "Manager approval", waitMs: 45000, approveRate: 0.9 },
  },
  cache: {
    label: "Cache",
    category: "infra",
    blurb: "Answers repeated or similar requests instantly. On a miss the request continues.",
    realLife: "The barista who already has the morning's most common order ready.",
    defaults: { label: "Semantic cache", latencyMs: 20, hitRate: 0.2 },
  },
  critic: {
    label: "Critic",
    category: "model",
    blurb: "Reviews a draft and sends a share back for one revision. Improves quality, adds a call.",
    realLife: "An editor who returns some articles to the reporter for another pass.",
    defaults: { label: "Critic", tier: "small", inTokens: 1500, outTokens: 150, reviseRate: 0.3, system: "Review the draft. Reply APPROVE or list the fixes needed." },
  },
  replicas: {
    label: "GPU model servers",
    category: "infra",
    blurb: "A pool of self-hosted model replicas (vLLM / SGLang). Pick a model, GPU and precision and it works out memory, batch size, speed, capacity and cost. Above ~70% utilisation the queue, and the tail, grow fast.",
    realLife: "Checkout counters at a supermarket: add customers faster than counters can serve and the line explodes.",
    defaults: { label: "vLLM pool", replicas: 2, serviceMs: 900, failRate: 0.001, model: "8b", gpu: "h100", precision: "fp16", kvPrecision: "fp16", maxBatch: 64, inTokens: 1500, outTokens: 300 },
  },
  gateway: {
    label: "API gateway",
    category: "infra",
    blurb: "The front door: auth, per-key rate limits, request logging. Above the rate limit, requests are rejected with 429.",
    realLife: "The security desk in an office lobby that checks badges and lets a limited number of visitors up at once.",
    defaults: { label: "API gateway", latencyMs: 8, rateLimit: 50, failRate: 0 },
  },
  balancer: {
    label: "Load balancer",
    category: "infra",
    blurb: "Spreads requests evenly across everything connected after it.",
    realLife: "The person at a bank who sends the next customer to whichever counter is free.",
    defaults: { label: "Load balancer", latencyMs: 2 },
  },
  queue: {
    label: "Queue + workers",
    category: "infra",
    blurb: "Buffers work for a pool of workers. Smooths spikes, but every request waits its turn when workers are busy.",
    realLife: "A token system at a passport office: you get a number and wait for a free counter.",
    defaults: { label: "Job queue", replicas: 4, serviceMs: 400, failRate: 0 },
  },
  embedder: {
    label: "Embedding model",
    category: "knowledge",
    blurb: "Turns the query (or documents, at ingestion) into a vector. Fast and cheap next to an LLM call.",
    realLife: "Writing a book's shelf code so it can be filed next to books on the same subject.",
    defaults: { label: "Embed query", latencyMs: 35, failRate: 0.002, costPerCall: 0.000004 },
  },
  database: {
    label: "Database",
    category: "knowledge",
    blurb: "Ordinary data: orders, users, inventory. Often the fastest, most reliable source of truth an agent can use.",
    realLife: "The ledger the shopkeeper checks before telling you if your parcel shipped.",
    defaults: { label: "Orders DB", latencyMs: 15, failRate: 0.002, retries: 1 },
  },
};

export const CATEGORY_LABEL: Record<Category, string> = {
  io: "Start & end",
  model: "Models",
  knowledge: "Knowledge & tools",
  control: "Control flow",
  safety: "Safety",
  infra: "Infrastructure",
};

/** nodes an agent treats as its tools (called inside its loop) rather than the next step in the chain */
export const TOOL_KINDS: NodeKind[] = ["tool", "retriever", "memory", "database"];
