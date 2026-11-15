import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getSections } from "../content";
import { dayPath, PRESETS, presetById } from "./presets";
import { erlangC, percentile, queueWaitMs, simulate } from "./simulate";
import { toPython } from "./codegen";
import type { StudioGraph } from "./types";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const clone = (g: StudioGraph): StudioGraph => structuredClone(g);
const param = (g: StudioGraph, id: string, patch: object) => {
  const n = g.nodes.find((x) => x.id === id)!;
  n.params = { ...n.params, ...patch };
  return g;
};

describe("queueing maths", () => {
  it("matches known Erlang C values", () => {
    expect(erlangC(1, 0.5)).toBeCloseTo(0.5, 6);
    expect(erlangC(2, 1)).toBeCloseTo(1 / 3, 6);
    const q = queueWaitMs(1, 1000, 0.5);
    expect(q.meanWait).toBeCloseTo(1000, 3);
    expect(queueWaitMs(2, 1000, 3).rho).toBeGreaterThan(1);
  });
  it("takes nearest-rank percentiles", () => {
    const xs = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(xs, 50)).toBe(50);
    expect(percentile(xs, 99)).toBe(99);
  });
});

describe("RAG Studio presets", () => {
  it("has 12 to 15 designs with unique ids", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(12);
    expect(PRESETS.length).toBeLessThanOrEqual(15);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  });

  it("is well formed: one input, one output, no dangling edges, nothing unreachable", () => {
    for (const p of PRESETS) {
      const ids = p.graph.nodes.map((n) => n.id);
      expect(new Set(ids).size, `${p.id} node ids`).toBe(ids.length);
      expect(p.graph.nodes.filter((n) => n.kind === "input").length, `${p.id} inputs`).toBe(1);
      expect(p.graph.nodes.filter((n) => n.kind === "output").length, `${p.id} outputs`).toBe(1);
      for (const e of p.graph.edges) {
        expect(ids, `${p.id} edge source ${e.source}`).toContain(e.source);
        expect(ids, `${p.id} edge target ${e.target}`).toContain(e.target);
      }
      // every block can be reached from the input by following edges
      const start = p.graph.nodes.find((n) => n.kind === "input")!.id;
      const seen = new Set([start]);
      for (let grew = true; grew; ) {
        grew = false;
        for (const e of p.graph.edges) if (seen.has(e.source) && !seen.has(e.target)) (seen.add(e.target), (grew = true));
      }
      expect([...ids].filter((i) => !seen.has(i)), `${p.id} unreachable blocks`).toEqual([]);
      expect(p.tryThis.length, `${p.id} tryThis`).toBeGreaterThanOrEqual(3);
      expect(p.scenario.length, `${p.id} scenario`).toBeGreaterThan(40);
    }
  });

  it("lays blocks out without overlapping (a block is about 210 x 84 px)", () => {
    for (const p of PRESETS) {
      const ns = p.graph.nodes;
      for (let i = 0; i < ns.length; i++)
        for (let j = i + 1; j < ns.length; j++) {
          const overlap = Math.abs(ns[i].x - ns[j].x) < 225 && Math.abs(ns[i].y - ns[j].y) < 88;
          expect(overlap, `${p.id}: ${ns[i].id} and ${ns[j].id} overlap`).toBe(false);
        }
    }
  });

  it("runs every design to completion with sensible numbers", () => {
    for (const p of PRESETS) {
      const r = simulate(p.graph, { runs: 300, rps: p.rps ?? 5 });
      expect(r.completed + r.blocked + r.failed, p.id).toBe(300);
      expect(r.completed, p.id).toBeGreaterThan(150);
      expect(r.latency.p50, p.id).toBeGreaterThan(0);
      expect(r.latency.p99, p.id).toBeGreaterThanOrEqual(r.latency.p95);
      expect(r.latency.p95, p.id).toBeGreaterThanOrEqual(r.latency.p50);
      expect(r.trace.length, p.id).toBeGreaterThan(1);
    }
  });

  it("exports every design as Python", () => {
    for (const p of PRESETS) expect(toPython(p.graph, p.title), p.id).toContain("def ");
  });

  it("links to days and projects that exist", () => {
    const lessons = getSections().flatMap((s) => s.lessons.map((l) => `/learn/${s.slug}/${l.slug}`));
    for (const p of PRESETS) {
      expect(p.days.length, p.id).toBeGreaterThan(0);
      for (const d of p.days) expect(lessons, `${p.id} day ${d}`).toContain(dayPath(d));
      if (p.project) expect(fs.existsSync(path.join(ROOT, "projects", p.project)), `${p.id} project ${p.project}`).toBe(true);
    }
    expect(PRESETS.filter((p) => p.project).length).toBeGreaterThanOrEqual(10);
  });
});

describe("simulate", () => {
  it("is deterministic for a seed", () => {
    const g = presetById("document-chat")!.graph;
    expect(simulate(g, { seed: 3 }).latency).toEqual(simulate(g, { seed: 3 }).latency);
  });

  it("gets more answers right when retrieval recall improves", () => {
    const g = presetById("document-chat")!.graph;
    const low = simulate(param(clone(g), "ret", { recall: 0.4 }), { runs: 800 });
    const high = simulate(param(clone(g), "ret", { recall: 0.95 }), { runs: 800 });
    expect(high.correct).toBeGreaterThan(low.correct);
  });

  it("makes the reranker pay off: a design with it answers more correctly than one without", () => {
    const g = presetById("hybrid-search-rerank")!.graph;
    const withRr = simulate(g, { runs: 900 });
    const noRr = simulate(param(clone(g), "rr", { lift: 0 }), { runs: 900 });
    expect(withRr.correct).toBeGreaterThan(noRr.correct);
  });

  it("sends more traffic down the rewrite path when the router weight changes (corrective RAG)", () => {
    const g = presetById("corrective-rag")!.graph;
    const base = simulate(g, { runs: 600 });
    const more = clone(g);
    more.edges = more.edges.map((e) => (e.id === "rt->an" ? { ...e, weight: 2 } : e.id === "rt->rw" ? { ...e, weight: 8 } : e));
    const heavy = simulate(more, { runs: 600 });
    expect(heavy.perNode.rw.visits).toBeGreaterThan(base.perNode.rw.visits);
    expect(heavy.latency.p50).toBeGreaterThan(base.latency.p50);
  });

  it("lets the queue pile up when there are too few workers", () => {
    const g = presetById("invoice-intelligence")!.graph;
    const calm = simulate(param(clone(g), "q", { replicas: 8 }), { runs: 600, rps: 2 });
    const slammed = simulate(param(clone(g), "q", { replicas: 1 }), { runs: 600, rps: 4 });
    expect(slammed.latency.p99).toBeGreaterThan(calm.latency.p99 * 1.5);
  });

  it("waits for the slowest parallel branch, not the sum of them", () => {
    const g = presetById("meeting-intelligence")!.graph;
    const r = simulate(g, { runs: 200 });
    expect(r.perNode.dg.visits).toBe(r.perNode.fan.visits);
  });

  it("explains a graph with no start node", () => {
    expect(simulate({ nodes: [], edges: [] }).insights[0]).toMatch(/User request/);
  });
});
