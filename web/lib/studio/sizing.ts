/**
 * GPU capacity planning for one model-server replica, from first principles.
 *
 *   weights      = params × bytes/param
 *   KV / token   = 2 (K and V) × layers × kv_heads × head_dim × bytes/value
 *   fits         = (GPU memory × 0.9 − weights − runtime overhead) ÷ (KV / token × tokens per request)
 *   decode step  = max( bytes read ÷ bandwidth , FLOPs ÷ compute )      ← usually memory-bound
 *   prefill      = 2 × active params × prompt tokens ÷ compute          ← compute-bound
 *
 * Hardware figures and prices are rounded, illustrative numbers (datasheet-level peaks, typical on-demand cloud prices
 * in 2026). Real engines reach 50-80% of peak; measure your own.
 */
export interface ModelSpec {
  label: string;
  /** total parameters (billions) */
  params: number;
  /** parameters used per token (billions): equals params for dense models, less for MoE */
  active: number;
  layers: number;
  kvHeads: number;
  headDim: number;
}
export interface GpuSpec {
  label: string;
  memGB: number;
  /** HBM bandwidth, GB/s */
  bwGBs: number;
  /** dense BF16 TFLOP/s */
  tflops: number;
  /** example on-demand $ per GPU-hour */
  pricePerHour: number;
}

export const MODELS: Record<string, ModelSpec> = {
  "3b": { label: "3B dense (small)", params: 3.2, active: 3.2, layers: 28, kvHeads: 8, headDim: 128 },
  "8b": { label: "8B dense (Llama-3.1-8B-class)", params: 8, active: 8, layers: 32, kvHeads: 8, headDim: 128 },
  "14b": { label: "14B dense", params: 14, active: 14, layers: 40, kvHeads: 8, headDim: 128 },
  "32b": { label: "32B dense", params: 32, active: 32, layers: 64, kvHeads: 8, headDim: 128 },
  "70b": { label: "70B dense (Llama-3.1-70B-class)", params: 70, active: 70, layers: 80, kvHeads: 8, headDim: 128 },
  "moe-30b": { label: "30B MoE, 3B active", params: 30, active: 3, layers: 48, kvHeads: 4, headDim: 128 },
  "moe-120b": { label: "120B MoE, ~5B active", params: 117, active: 5.1, layers: 36, kvHeads: 8, headDim: 64 },
};

export const GPUS: Record<string, GpuSpec> = {
  l4: { label: "NVIDIA L4 · 24 GB", memGB: 24, bwGBs: 300, tflops: 121, pricePerHour: 0.8 },
  a10g: { label: "NVIDIA A10G · 24 GB", memGB: 24, bwGBs: 600, tflops: 125, pricePerHour: 1.0 },
  a100: { label: "NVIDIA A100 · 80 GB", memGB: 80, bwGBs: 2039, tflops: 312, pricePerHour: 1.8 },
  h100: { label: "NVIDIA H100 SXM · 80 GB", memGB: 80, bwGBs: 3350, tflops: 990, pricePerHour: 3.0 },
  h200: { label: "NVIDIA H200 · 141 GB", memGB: 141, bwGBs: 4800, tflops: 990, pricePerHour: 4.0 },
};

export type Precision = "fp16" | "fp8" | "int4";
export const BYTES: Record<Precision, number> = { fp16: 2, fp8: 1, int4: 0.55 /* 4-bit weights + scales */ };

export interface SizingInput {
  model: string;
  gpu: string;
  precision: Precision;
  kvPrecision: "fp16" | "fp8";
  /** prompt tokens and output tokens per request */
  inTokens: number;
  outTokens: number;
  /** upper bound on concurrent sequences the engine will run (max-num-seqs) */
  maxBatch: number;
  /** GPUs per replica (tensor parallel); 0 = smallest that fits */
  tp?: number;
}

export interface SizingResult {
  ok: boolean;
  why?: string;
  tp: number;
  weightsGB: number;
  kvPerTokenKB: number;
  kvPerRequestMB: number;
  kvBudgetGB: number;
  /** sequences that fit in memory, and the batch actually used */
  fitSeqs: number;
  batch: number;
  /** decode step time at that batch, ms; and whether memory or compute limits it */
  stepMs: number;
  bound: "memory" | "compute";
  prefillMs: number;
  /** time to first token and full request latency with no queueing, ms */
  ttftMs: number;
  latencyMs: number;
  /** per-user streaming speed and replica-wide output throughput */
  tokPerSecPerUser: number;
  tokPerSec: number;
  /** requests per second one replica sustains at that batch */
  reqPerSec: number;
  pricePerHour: number;
  /** $ per 1M output tokens when the replica runs at capacity */
  costPer1MOut: number;
  /** at the offered load (if given): requests in flight per replica, the latency they see, and utilisation */
  opBatch: number;
  opLatencyMs: number;
  utilization: number;
}

const EFF_BW = 0.7; // fraction of peak bandwidth real engines reach
const EFF_FLOPS = 0.45; // fraction of peak compute in practice
const OVERHEAD_GB = 2; // CUDA context, activations, cuda graphs, per GPU

export function kvBytesPerToken(m: ModelSpec, kvBytes: number) {
  return 2 * m.layers * m.kvHeads * m.headDim * kvBytes;
}

/** decode step and full-request latency at a given batch (requests in flight on one replica) */
function timing(m: ModelSpec, inp: SizingInput, tp: number, g: GpuSpec, kvTok: number, batch: number) {
  const bw = tp * g.bwGBs * 1e9 * EFF_BW;
  const flops = tp * g.tflops * 1e12 * EFF_FLOPS;
  // one decode step reads the active weights once plus every running sequence's KV cache (output half-written on average)
  const activeBytes = m.active * 1e9 * BYTES[inp.precision];
  const kvRead = batch * kvTok * (inp.inTokens + inp.outTokens / 2);
  const memMs = ((activeBytes + kvRead) / bw) * 1000;
  const compMs = ((2 * m.active * 1e9 * batch) / flops) * 1000;
  const stepMs = Math.max(memMs, compMs);
  const prefillMs = ((2 * m.active * 1e9 * inp.inTokens) / flops) * 1000;
  return { stepMs, prefillMs, latencyMs: prefillMs + inp.outTokens * stepMs, bound: (memMs >= compMs ? "memory" : "compute") as "memory" | "compute" };
}

/**
 * Size one replica. With `loadRps` (requests/s reaching ONE replica), also find the operating point: by Little's law
 * the requests in flight are arrival rate x latency, and latency grows with the batch, so iterate to a fixed point.
 */
export function sizeReplica(inp: SizingInput, loadRps?: number): SizingResult {
  const m = MODELS[inp.model] ?? MODELS["8b"];
  const g = GPUS[inp.gpu] ?? GPUS.h100;
  const wBytes = m.params * 1e9 * BYTES[inp.precision] * 1.03;
  const kvTok = kvBytesPerToken(m, inp.kvPrecision === "fp8" ? 1 : 2);
  const ctx = Math.max(1, inp.inTokens + inp.outTokens);
  const usable = (tp: number) => tp * (g.memGB * 0.9 - OVERHEAD_GB) * 1e9 - wBytes;
  let tp = inp.tp && inp.tp > 0 ? inp.tp : 1;
  if (!inp.tp) while (tp < 8 && usable(tp) < kvTok * ctx * 4) tp *= 2; // room for at least 4 requests
  const kvBudget = usable(tp);
  const base = { tp, weightsGB: wBytes / 1e9, kvPerTokenKB: kvTok / 1024, kvPerRequestMB: (kvTok * ctx) / 2 ** 20, kvBudgetGB: Math.max(0, kvBudget) / 1e9, pricePerHour: tp * g.pricePerHour };
  if (kvBudget < kvTok * ctx) {
    return { ...base, ok: false, why: `The weights (${(wBytes / 1e9).toFixed(0)} GB) leave no room for even one ${ctx.toLocaleString()}-token request on ${tp} × ${g.memGB} GB. Use more GPUs, a smaller precision, or a shorter context.`, fitSeqs: 0, batch: 0, stepMs: 0, bound: "memory", prefillMs: 0, ttftMs: 0, latencyMs: 0, tokPerSecPerUser: 0, tokPerSec: 0, reqPerSec: 0, costPer1MOut: 0, opBatch: 0, opLatencyMs: 0, utilization: Infinity };
  }
  const fitSeqs = Math.floor(kvBudget / (kvTok * ctx));
  const batch = Math.max(1, Math.min(fitSeqs, inp.maxBatch));
  const { stepMs, prefillMs, latencyMs, bound } = timing(m, inp, tp, g, kvTok, batch);
  // at capacity `batch` requests are in flight; each occupies a slot for `latencyMs`
  const reqPerSec = batch / (latencyMs / 1000);
  const tokPerSec = reqPerSec * inp.outTokens;
  const solo = timing(m, inp, tp, g, kvTok, 1);
  let opBatch = 1;
  let opLatencyMs = solo.latencyMs;
  if (loadRps !== undefined && loadRps > 0) {
    for (let k = 0; k < 30; k++) {
      opBatch = Math.min(batch, Math.max(1, (loadRps * opLatencyMs) / 1000));
      opLatencyMs = timing(m, inp, tp, g, kvTok, opBatch).latencyMs;
    }
  }
  return {
    ...base,
    ok: true,
    fitSeqs,
    batch,
    stepMs,
    bound,
    prefillMs,
    ttftMs: prefillMs + stepMs,
    latencyMs,
    tokPerSecPerUser: 1000 / solo.stepMs,
    tokPerSec,
    reqPerSec,
    costPer1MOut: tokPerSec > 0 ? (base.pricePerHour / (tokPerSec * 3600)) * 1e6 : 0,
    opBatch,
    opLatencyMs,
    utilization: loadRps !== undefined ? loadRps / reqPerSec : 0,
  };
}

/** replicas needed to serve `rps` while keeping each one at or below `targetUtil` */
export function replicasFor(r: SizingResult, rps: number, targetUtil = 0.7) {
  if (!r.ok || r.reqPerSec <= 0) return 0;
  return Math.max(1, Math.ceil(rps / (r.reqPerSec * targetUtil)));
}
