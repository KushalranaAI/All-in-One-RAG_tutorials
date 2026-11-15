import { KINDS, TIERS, TOOL_KINDS } from "./catalog";
import { sizeReplica, type SizingResult } from "./sizing";
import type { NodeStats, SimResult, StudioEdge, StudioGraph, StudioNode, TraceEvent } from "./types";

/* ---------- small, deterministic randomness ---------- */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rand = () => number;
/** a positive duration with a long right tail, mean ≈ `mean` (lognormal, σ = spread) */
function dur(r: Rand, mean: number, spread = 0.35): number {
  if (mean <= 0) return 0;
  const u = Math.max(1e-9, r());
  const v = r();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean * Math.exp(spread * z - (spread * spread) / 2);
}

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

/* ---------- queueing for GPU replica pools (M/M/c, Erlang C) ---------- */
export function erlangC(c: number, a: number): number {
  // a = offered load λ/μ; probability an arrival has to wait
  if (a >= c) return 1;
  let sum = 0;
  let term = 1;
  for (let k = 0; k < c; k++) {
    if (k > 0) term *= a / k;
    sum += term;
  }
  const last = (term * a) / c; // a^c / c!
  const top = last * (c / (c - a));
  return top / (sum + top);
}

/** mean queueing delay (ms) for c servers with mean service `serviceMs` at `rps` arrivals per second */
export function queueWaitMs(c: number, serviceMs: number, rps: number): { rho: number; waitProb: number; meanWait: number } {
  const mu = 1000 / Math.max(1, serviceMs);
  const lambda = Math.max(0, rps);
  const rho = lambda / (c * mu);
  if (rho >= 1) return { rho, waitProb: 1, meanWait: Infinity };
  const pw = erlangC(c, lambda / mu);
  return { rho, waitProb: pw, meanWait: (pw / (c * mu - lambda)) * 1000 };
}

/* ---------- graph helpers ---------- */
function index(g: StudioGraph) {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const out = new Map<string, StudioEdge[]>();
  for (const e of g.edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    out.set(e.source, [...(out.get(e.source) ?? []), e]);
  }
  return { byId, out };
}

/** first node reachable from every branch: where a fan-out joins again */
function joinPoint(starts: string[], g: ReturnType<typeof index>): string | undefined {
  const reach = starts.map((s) => {
    const order: string[] = [];
    const seen = new Set<string>();
    const q = [s];
    while (q.length) {
      const n = q.shift()!;
      if (seen.has(n)) continue;
      seen.add(n);
      order.push(n);
      const from = g.byId.get(n);
      for (const e of g.out.get(n) ?? []) {
        // an agent's tools run inside its loop; they are not where branches meet again
        if (from?.kind === "agent" && TOOL_KINDS.includes(g.byId.get(e.target)!.kind)) continue;
        q.push(e.target);
      }
    }
    return { order, seen };
  });
  return reach[0]?.order.find((n) => reach.every((r) => r.seen.has(n)));
}

/* ---------- one request ---------- */
interface Ctx {
  r: Rand;
  t: number;
  cost: number;
  tokens: number;
  correct: boolean;
  usesRetrieval: boolean;
  evidence: boolean;
  /** knowledge mode: the input says what share of questions need private data */
  knowledgeMode: boolean;
  needsKnowledge: boolean;
  rps: number;
  status: "ok" | "failed" | "blocked";
  trace: TraceEvent[];
  visits: Map<string, number>;
  perNode: Map<string, { ms: number; cost: number; fail: boolean }>;
  queue: Map<string, { waitProb: number; meanWait: number; overloaded: number; arrivalRps: number; serviceMs: number }>;
  done: boolean;
}

function note(ctx: Ctx, n: StudioNode, start: number, end: number, cost: number, status: TraceEvent["status"], text?: string) {
  ctx.trace.push({ node: n.id, start, end, status, note: text });
  const p = ctx.perNode.get(n.id) ?? { ms: 0, cost: 0, fail: false };
  p.ms += end - start;
  p.cost += cost;
  if (status === "fail") p.fail = true;
  ctx.perNode.set(n.id, p);
}

function llmCall(ctx: Ctx, n: StudioNode, inTok?: number, outTok?: number): { ms: number; cost: number; ok: boolean } {
  const tier = TIERS[n.params.tier ?? "medium"];
  const i = inTok ?? n.params.inTokens ?? 1000;
  const o = outTok ?? n.params.outTokens ?? 200;
  let ms = 0;
  let cost = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    ms += dur(ctx.r, tier.ttftMs, 0.4) + (o / tier.tokPerSec) * 1000 * dur(ctx.r, 1, 0.15);
    cost += (i * tier.inPrice + o * tier.outPrice) / 1e6;
    ctx.tokens += i + o;
    if (ctx.r() >= tier.errorRate) return { ms, cost, ok: true };
    ms += 400; // backoff before the retry
  }
  return { ms, cost, ok: false };
}

/** draw whether an answering model got it right, given retrieval */
/** example answer quality by self-hosted model size; heavier quantization costs a little (measure on your evals) */
const POOL_QUALITY: Record<string, number> = { "3b": 0.68, "8b": 0.78, "14b": 0.83, "32b": 0.88, "70b": 0.92, "moe-30b": 0.82, "moe-120b": 0.88 };
const QUANT_COST: Record<string, number> = { fp16: 0, fp8: 0.005, int4: 0.03 };
function poolQuality(n: StudioNode): number {
  return Math.max(0.3, (POOL_QUALITY[n.params.model ?? ""] ?? 0.75) - (QUANT_COST[n.params.precision ?? "fp16"] ?? 0));
}

function answerQuality(ctx: Ctx, n: StudioNode) {
  const q = n.kind === "replicas" && n.params.model ? poolQuality(n) : TIERS[n.params.tier ?? "medium"].quality;
  const missing = ctx.knowledgeMode ? ctx.needsKnowledge && !ctx.evidence : ctx.usesRetrieval && !ctx.evidence;
  const base = missing ? 0.15 : q; // a question that needs your data, answered without it → mostly a confident guess
  ctx.correct = ctx.r() < base;
}

function simpleCall(ctx: Ctx, n: StudioNode): { ms: number; cost: number; ok: boolean; tries: number } {
  const tries = 1 + Math.max(0, n.params.retries ?? 0);
  let ms = 0;
  let cost = 0;
  for (let k = 0; k < tries; k++) {
    ms += dur(ctx.r, n.params.latencyMs ?? 50);
    cost += n.params.costPerCall ?? 0;
    if (ctx.r() >= (n.params.failRate ?? 0)) return { ms, cost, ok: true, tries: k + 1 };
    ms += 200 * 2 ** k;
  }
  return { ms, cost, ok: false, tries };
}

function run(id: string, g: ReturnType<typeof index>, ctx: Ctx, stop?: string) {
  if (ctx.done || id === stop) return;
  const n = g.byId.get(id);
  if (!n) return;
  const v = (ctx.visits.get(id) ?? 0) + 1;
  ctx.visits.set(id, v);
  if (v > 6) return; // a loop without an exit: stop rather than spin
  const outs = g.out.get(id) ?? [];
  const start = ctx.t;
  const next = (edges: StudioEdge[] = outs) => {
    for (const e of edges) {
      if (ctx.done) return;
      run(e.target, g, ctx, stop);
    }
  };
  const fail = (why: string, cost = 0) => {
    note(ctx, n, start, ctx.t, cost, "fail", why);
    ctx.status = "failed";
    ctx.done = true;
  };

  switch (n.kind) {
    case "input":
      ctx.tokens += n.params.inTokens ?? 0;
      ctx.knowledgeMode = (n.params.knowledgeShare ?? 0) > 0;
      ctx.needsKnowledge = ctx.r() < (n.params.knowledgeShare ?? 0);
      note(ctx, n, start, start, 0, "ok");
      return next();
    case "output":
      note(ctx, n, start, start, 0, "ok");
      ctx.done = true;
      return;
    case "llm": {
      const c = llmCall(ctx, n);
      ctx.t += c.ms;
      ctx.cost += c.cost;
      if (!c.ok) return fail("provider error after retry", c.cost);
      answerQuality(ctx, n);
      note(ctx, n, start, ctx.t, c.cost, "ok");
      return next();
    }
    case "agent": {
      const tools = outs.filter((e) => TOOL_KINDS.includes(g.byId.get(e.target)!.kind));
      const rest = outs.filter((e) => !tools.includes(e));
      const mean = Math.max(1, n.params.steps ?? 3);
      // steps: 1 + a geometric-ish spread around the mean, capped so a runaway loop is visible but bounded
      let steps = 1;
      while (steps < mean * 3 && ctx.r() < 1 - 1 / mean) steps++;
      let cost = 0;
      for (let s = 0; s < steps; s++) {
        const c = llmCall(ctx, n, (n.params.inTokens ?? 2000) + s * 400, n.params.outTokens);
        ctx.t += c.ms;
        cost += c.cost;
        if (!c.ok) {
          ctx.cost += cost;
          return fail(`model error on step ${s + 1}`, cost);
        }
        if (tools.length && s < steps - 1) {
          const tool = g.byId.get(tools[Math.floor(ctx.r() * tools.length)].target)!;
          const ts = ctx.t;
          if (tool.kind === "retriever") {
            ctx.usesRetrieval = true;
            const rc = simpleCall(ctx, tool);
            ctx.t += rc.ms;
            ctx.evidence = ctx.evidence || ctx.r() < (tool.params.recall ?? 0.8);
            note(ctx, tool, ts, ctx.t, rc.cost, rc.ok ? "ok" : "fail");
            cost += rc.cost;
          } else {
            const tc = simpleCall(ctx, tool);
            ctx.t += tc.ms;
            cost += tc.cost;
            if (tc.ok && (tool.kind === "database" || (tool.kind === "tool" && ctx.r() < 0.5))) ctx.evidence = true; // a lookup can supply the facts too
            note(ctx, tool, ts, ctx.t, tc.cost, tc.ok ? (tc.tries > 1 ? "retry" : "ok") : "fail", tc.ok ? undefined : "tool failed; agent continues without it");
          }
        }
      }
      ctx.cost += cost;
      answerQuality(ctx, n);
      note(ctx, n, start, ctx.t, cost, "ok", `${steps} step${steps === 1 ? "" : "s"}`);
      return next(rest);
    }
    case "tool":
    case "memory":
    case "database":
    case "embedder": {
      const c = simpleCall(ctx, n);
      ctx.t += c.ms;
      ctx.cost += c.cost;
      if (!c.ok) return fail("call failed after retries", c.cost);
      if (n.kind === "database") ctx.evidence = true;
      note(ctx, n, start, ctx.t, c.cost, c.tries > 1 ? "retry" : "ok");
      return next();
    }
    case "retriever": {
      const c = simpleCall(ctx, n);
      ctx.t += c.ms;
      ctx.cost += c.cost;
      if (!c.ok) return fail("index unavailable", c.cost);
      ctx.usesRetrieval = true;
      ctx.evidence = ctx.r() < (n.params.recall ?? 0.8);
      note(ctx, n, start, ctx.t, c.cost, "ok", ctx.evidence ? "found the evidence" : "missed the evidence");
      return next();
    }
    case "reranker": {
      const c = simpleCall(ctx, n);
      ctx.t += c.ms;
      ctx.cost += c.cost;
      if (!c.ok) return fail("reranker failed", c.cost);
      const rescued = ctx.usesRetrieval && !ctx.evidence && ctx.r() < (n.params.lift ?? 0.5);
      if (rescued) ctx.evidence = true;
      note(ctx, n, start, ctx.t, c.cost, "ok", rescued ? "rescued a miss" : undefined);
      return next();
    }
    case "router": {
      ctx.t += dur(ctx.r, n.params.latencyMs ?? 10);
      note(ctx, n, start, ctx.t, 0, "ok");
      if (!outs.length) return;
      const total = outs.reduce((s, e) => s + Math.max(0, e.weight ?? 1), 0) || 1;
      let x = ctx.r() * total;
      const pick = outs.find((e) => (x -= Math.max(0, e.weight ?? 1)) < 0) ?? outs[outs.length - 1];
      return next([pick]);
    }
    case "cascade": {
      ctx.t += dur(ctx.r, n.params.latencyMs ?? 5);
      note(ctx, n, start, ctx.t, 0, "ok");
      if (!outs.length) return;
      const [first, second] = outs;
      const join = second ? joinPoint([first.target, second.target], g) : undefined;
      run(first.target, g, ctx, join);
      if (ctx.done) return;
      if (second && ctx.r() < (n.params.escalateRate ?? 0.25)) {
        ctx.trace.push({ node: n.id, start: ctx.t, end: ctx.t, status: "retry", note: "escalated" });
        run(second.target, g, ctx, join);
        if (ctx.done) return;
      }
      if (join) run(join, g, ctx, stop);
      return;
    }
    case "parallel": {
      if (!outs.length) return;
      const join = joinPoint(outs.map((e) => e.target), g);
      const t0 = ctx.t;
      let latest = t0;
      let allOk = true;
      let anyEvidence = ctx.evidence;
      for (const e of outs) {
        ctx.t = t0;
        run(e.target, g, ctx, join);
        latest = Math.max(latest, ctx.t);
        anyEvidence = anyEvidence || ctx.evidence;
        if (ctx.status === "failed") allOk = false;
        if (ctx.status !== "blocked") {
          ctx.done = false;
          ctx.status = "ok";
        }
      }
      ctx.t = latest;
      ctx.evidence = anyEvidence;
      const ms0 = ctx.t;
      const c = llmCall(ctx, n);
      ctx.t += c.ms;
      ctx.cost += c.cost;
      if (!c.ok) return fail("merge step failed", c.cost);
      // one failed branch: the merge still answers, with less to go on
      if (!allOk && ctx.r() < 0.5) ctx.correct = false;
      else answerQuality(ctx, n);
      note(ctx, n, ms0, ctx.t, c.cost, "ok", allOk ? "merged all branches" : "merged without a failed branch");
      if (join) run(join, g, ctx, stop);
      return;
    }
    case "guardrail": {
      ctx.t += dur(ctx.r, n.params.latencyMs ?? 60);
      if (ctx.r() < (n.params.blockRate ?? 0)) {
        note(ctx, n, start, ctx.t, n.params.costPerCall ?? 0, "blocked", "blocked by policy");
        ctx.status = "blocked";
        ctx.done = true;
        return;
      }
      note(ctx, n, start, ctx.t, n.params.costPerCall ?? 0, "ok");
      ctx.cost += n.params.costPerCall ?? 0;
      return next();
    }
    case "human": {
      ctx.t += dur(ctx.r, n.params.waitMs ?? 30000, 0.8);
      if (ctx.r() > (n.params.approveRate ?? 0.9)) {
        note(ctx, n, start, ctx.t, 0, "blocked", "rejected by reviewer");
        ctx.status = "blocked";
        ctx.done = true;
        return;
      }
      note(ctx, n, start, ctx.t, 0, "ok", "approved");
      return next();
    }
    case "cache": {
      ctx.t += dur(ctx.r, n.params.latencyMs ?? 20);
      if (ctx.r() < (n.params.hitRate ?? 0)) {
        note(ctx, n, start, ctx.t, 0, "hit", "cache hit");
        ctx.correct = true;
        ctx.done = true;
        return;
      }
      note(ctx, n, start, ctx.t, 0, "ok", "miss");
      return next();
    }
    case "critic": {
      const c = llmCall(ctx, n);
      ctx.t += c.ms;
      let cost = c.cost;
      if (!c.ok) return fail("critic failed", c.cost);
      let revised = false;
      if (ctx.r() < (n.params.reviseRate ?? 0.3)) {
        // one more drafting pass at the critic's tier; a wrong draft has an even chance of being fixed
        const again = llmCall(ctx, n, (n.params.inTokens ?? 1500) + 600, 400);
        ctx.t += again.ms;
        cost += again.cost;
        revised = true;
        if (!ctx.correct) ctx.correct = ctx.r() < 0.5;
      }
      ctx.cost += cost;
      note(ctx, n, start, ctx.t, cost, revised ? "retry" : "ok", revised ? "sent back for one revision" : "approved the draft");
      return next();
    }
    case "gateway": {
      ctx.t += dur(ctx.r, n.params.latencyMs ?? 8);
      const limit = n.params.rateLimit ?? Infinity;
      if (ctx.rps > limit && ctx.r() < 1 - limit / ctx.rps) {
        note(ctx, n, start, ctx.t, 0, "blocked", "rate limited (429)");
        ctx.status = "blocked";
        ctx.done = true;
        return;
      }
      note(ctx, n, start, ctx.t, 0, "ok");
      return next();
    }
    case "balancer": {
      ctx.t += dur(ctx.r, n.params.latencyMs ?? 2);
      note(ctx, n, start, ctx.t, 0, "ok");
      if (!outs.length) return;
      return next([outs[Math.floor(ctx.r() * outs.length)]]);
    }
    case "queue":
    case "replicas": {
      const q = ctx.queue.get(n.id);
      let wait = 0;
      if (q) {
        if (q.overloaded > 0 && ctx.r() < q.overloaded) {
          ctx.t += 30000;
          return fail("timed out in the queue (pool overloaded)");
        }
        if (ctx.r() < q.waitProb) wait = -Math.log(Math.max(1e-9, ctx.r())) * (Number.isFinite(q.meanWait) ? q.meanWait / Math.max(1e-6, q.waitProb) : 30000);
      }
      ctx.t += wait + dur(ctx.r, q?.serviceMs ?? poolOf(n).serviceMs, 0.3);
      if (ctx.r() < (n.params.failRate ?? 0)) return fail(n.kind === "queue" ? "job failed" : "replica error");
      // GPUs cost money whether busy or idle: charge this request its share of the pool's hourly bill at the current load
      const pool = poolOf(n);
      const gpuCost = q && pool.pricePerHour > 0 && q.arrivalRps > 0 ? pool.pricePerHour / 3600 / q.arrivalRps : 0;
      ctx.cost += gpuCost;
      if (n.kind === "replicas" && n.params.model) answerQuality(ctx, n);
      note(ctx, n, start, ctx.t, gpuCost, "ok", wait > 50 ? `waited ${Math.round(wait)} ms in queue` : undefined);
      return next();
    }
  }
}

/**
 * How many requests a pool serves at once, and how long each takes. A GPU pool with a model picked uses the sizing maths
 * (slots = replicas × batch that fits; service = prefill + output tokens × decode step). A queue uses its workers.
 */
export function poolOf(n: StudioNode, rpsAtNode?: number): { slots: number; serviceMs: number; sizing?: SizingResult; gpus: number; pricePerHour: number; capacityRps: number } {
  const reps = Math.max(1, n.params.replicas ?? 1);
  if (n.kind === "replicas" && n.params.model) {
    const sz = sizeReplica({
      model: n.params.model,
      gpu: n.params.gpu ?? "h100",
      precision: n.params.precision ?? "fp16",
      kvPrecision: n.params.kvPrecision ?? "fp16",
      inTokens: n.params.inTokens ?? 1500,
      outTokens: n.params.outTokens ?? 300,
      maxBatch: n.params.maxBatch ?? 64,
      tp: n.params.tp,
    }, rpsAtNode !== undefined ? rpsAtNode / reps : undefined);
    // service time is the latency at the operating batch (fast when quiet); queueing uses the full slot count
    if (sz.ok) return { slots: reps * sz.batch, serviceMs: rpsAtNode !== undefined ? sz.opLatencyMs : sz.latencyMs, sizing: sz, gpus: reps * sz.tp, pricePerHour: reps * sz.pricePerHour, capacityRps: reps * sz.reqPerSec };
    return { slots: 1, serviceMs: 60000, sizing: sz, gpus: reps * sz.tp, pricePerHour: reps * sz.pricePerHour, capacityRps: 0 };
  }
  const svc = Math.max(1, n.params.serviceMs ?? 900);
  return { slots: reps, serviceMs: svc, gpus: n.kind === "replicas" ? reps : 0, pricePerHour: 0, capacityRps: (reps * 1000) / svc };
}

export interface SimOptions {
  runs?: number;
  /** requests per second arriving at the system (drives GPU queueing) */
  rps?: number;
  seed?: number;
}

export function simulate(graph: StudioGraph, opts: SimOptions = {}): SimResult {
  const runs = opts.runs ?? 500;
  const rps = opts.rps ?? 5;
  const g = index(graph);
  const start = graph.nodes.find((n) => n.kind === "input");
  const empty: SimResult = { runs, completed: 0, correct: 0, blocked: 0, failed: 0, latency: { mean: 0, p50: 0, p95: 0, p99: 0 }, samples: [], costPerRequest: 0, tokensPerRequest: 0, perNode: {}, trace: [], insights: [] };
  if (!start) return { ...empty, insights: ["Add a User request node: every simulation starts there."] };

  const pass = (queue: Ctx["queue"], seed: number) => {
    const r = rng(seed);
    return Array.from({ length: runs }, () => {
      const ctx: Ctx = { r, t: 0, cost: 0, tokens: 0, correct: false, usesRetrieval: false, evidence: false, knowledgeMode: false, needsKnowledge: false, rps, status: "ok", trace: [], visits: new Map(), perNode: new Map(), queue, done: false };
      run(start.id, g, ctx);
      return ctx;
    });
  };

  // pass 1 counts how much traffic reaches each GPU pool; pass 2 applies queueing at that load
  const replicaNodes = graph.nodes.filter((n) => n.kind === "replicas" || n.kind === "queue");
  const queue: Ctx["queue"] = new Map();
  if (replicaNodes.length) {
    const first = pass(new Map(), (opts.seed ?? 7) + 1);
    for (const n of replicaNodes) {
      const share = first.filter((c) => c.visits.has(n.id)).length / runs;
      const pool = poolOf(n, rps * share);
      // the queue's threshold comes from full-batch latency; each request then takes the load-dependent latency
      const cap = pool.sizing?.ok ? pool.sizing.latencyMs : pool.serviceMs;
      const q = queueWaitMs(pool.slots, cap, rps * share);
      queue.set(n.id, { waitProb: q.waitProb, meanWait: q.meanWait, overloaded: q.rho >= 1 ? 1 - 1 / q.rho : 0, arrivalRps: rps * share, serviceMs: pool.serviceMs });
    }
  }
  const ctxs = pass(queue, opts.seed ?? 7);

  const done = ctxs.filter((c) => c.status === "ok");
  const lat = done.map((c) => c.t).sort((a, b) => a - b);
  const perNode: Record<string, NodeStats> = {};
  for (const n of graph.nodes) {
    const hits = ctxs.map((c) => c.perNode.get(n.id)).filter((x): x is NonNullable<typeof x> => !!x);
    perNode[n.id] = {
      visits: hits.length,
      meanMs: hits.length ? hits.reduce((s, x) => s + x.ms, 0) / hits.length : 0,
      cost: hits.reduce((s, x) => s + x.cost, 0),
      failures: hits.filter((x) => x.fail).length,
    };
  }
  const p50 = percentile(lat, 50);
  const median = done.reduce<Ctx | undefined>((best, c) => (!best || Math.abs(c.t - p50) < Math.abs(best.t - p50) ? c : best), undefined) ?? ctxs[0];
  const res: SimResult = {
    runs,
    completed: done.length,
    correct: done.filter((c) => c.correct).length,
    blocked: ctxs.filter((c) => c.status === "blocked").length,
    failed: ctxs.filter((c) => c.status === "failed").length,
    latency: { mean: lat.reduce((s, x) => s + x, 0) / Math.max(1, lat.length), p50, p95: percentile(lat, 95), p99: percentile(lat, 99) },
    samples: lat,
    costPerRequest: ctxs.reduce((s, c) => s + c.cost, 0) / runs,
    tokensPerRequest: ctxs.reduce((s, c) => s + c.tokens, 0) / runs,
    perNode,
    trace: [...(median?.trace ?? [])].sort((a, b) => a.start - b.start),
    insights: [],
  };
  res.insights = insights(graph, res, queue, rps);
  return res;
}

/** plain-language observations about a result, most important first */
export function insights(graph: StudioGraph, r: SimResult, queue: Map<string, { waitProb: number; overloaded: number }>, rps: number): string[] {
  const out: string[] = [];
  const name = (id: string) => graph.nodes.find((n) => n.id === id)?.params.label ?? id;
  const outputs = graph.nodes.filter((n) => n.kind === "output");
  if (!outputs.length) out.push("There's no Answer node, so requests never finish. Connect the last step to an Answer.");
  for (const [id, q] of queue) {
    if (q.overloaded > 0) out.push(`${name(id)} is overloaded at ${rps} req/s: about ${Math.round(q.overloaded * 100)}% of requests time out. Add replicas, cache more, or route some traffic elsewhere.`);
    else if (q.waitProb > 0.5) out.push(`${name(id)} is running hot: ${Math.round(q.waitProb * 100)}% of requests wait in the queue. This is where p99 comes from. Autoscale on queue depth before it tips over.`);
  }
  if (r.latency.p99 > r.latency.p50 * 3 && r.completed > 20) out.push(`The tail is long: p99 is ${(r.latency.p99 / Math.max(1, r.latency.p50)).toFixed(1)}× the median. Averages would hide this; users feel it.`);
  const slow = Object.entries(r.perNode)
    .filter(([, s]) => s.visits)
    .map(([id, s]) => ({ id, total: s.meanMs * s.visits }))
    .sort((a, b) => b.total - a.total)[0];
  if (slow && r.completed) out.push(`Most of the time goes to ${name(slow.id)}. Speed that up first.`);
  const dear = Object.entries(r.perNode).sort((a, b) => b[1].cost - a[1].cost)[0];
  if (dear && dear[1].cost > 0) out.push(`${name(dear[0])} accounts for ${Math.round((dear[1].cost / Math.max(1e-9, r.costPerRequest * r.runs)) * 100)}% of the spend.`);
  if (r.failed / Math.max(1, r.runs) > 0.05) out.push(`${Math.round((r.failed / r.runs) * 100)}% of requests fail. Add retries, a fallback, or make the agent continue without a broken tool.`);
  const retr = graph.nodes.find((n) => n.kind === "retriever");
  if (retr && (retr.params.recall ?? 1) < 0.85 && !graph.nodes.some((n) => n.kind === "reranker")) out.push("Retrieval misses the evidence often, and a model without evidence mostly guesses. Try a reranker or better chunking before a bigger model.");
  if (graph.nodes.some((n) => n.kind === "human")) out.push("Human approval keeps risky actions safe but dominates latency. Gate only the actions that need it.");
  const agents = graph.nodes.filter((n) => n.kind === "agent");
  if (agents.some((a) => (a.params.steps ?? 0) >= 6)) out.push("Agents with many steps multiply cost and failure chances. Each extra step is another model call.");
  return out.slice(0, 5);
}

export const KIND_LABEL = (k: StudioNode["kind"]) => KINDS[k].label;
