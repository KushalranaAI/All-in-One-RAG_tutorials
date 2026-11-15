import { TOOL_KINDS } from "./catalog";
import type { StudioGraph, StudioNode } from "./types";

/**
 * Turn a Studio graph into a plain-Python asyncio program (OpenAI-compatible client), so a design becomes code you run
 * and extend. No framework: each node is one function, which makes the control flow easy to read and to port to
 * LangGraph or another framework later.
 */
const py = (s: string) => JSON.stringify(s ?? "");
const fn = (n: StudioNode) => `node_${n.id.replace(/[^a-zA-Z0-9_]/g, "_")}`;

export function toPython(graph: StudioGraph, title = "My AI system"): string {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const outs = (id: string) => graph.edges.filter((e) => e.source === id && byId.has(e.target));
  const isTool = (from: StudioNode, toId: string) => from.kind === "agent" && TOOL_KINDS.includes(byId.get(toId)!.kind);
  const start = graph.nodes.find((n) => n.kind === "input");

  const L: string[] = [];
  L.push(`"""${title} - exported from AI Engineer Path, Agent Studio.`);
  L.push("");
  L.push("Run:  pip install openai   then   OPENAI_API_KEY=... python app.py");
  L.push("Any OpenAI-compatible endpoint works (set base_url). Model names below are examples: pick your own.");
  L.push('TODO markers show where the simulated parts (tools, retrieval, approval) need real implementations."""');
  L.push("import asyncio, os, random, re");
  L.push("from openai import AsyncOpenAI");
  L.push("");
  L.push('client = AsyncOpenAI(base_url=os.getenv("OPENAI_BASE_URL"))');
  L.push('MODELS = {"small": "gpt-4o-mini", "medium": "gpt-4o", "large": "gpt-4.1"}  # examples - choose current models');
  L.push("");
  L.push("async def llm(tier: str, system: str, user: str, max_tokens: int = 700) -> str:");
  L.push('    r = await client.chat.completions.create(model=MODELS[tier], max_tokens=max_tokens, messages=[{"role": "system", "content": system}, {"role": "user", "content": user}])');
  L.push('    return r.choices[0].message.content or ""');
  L.push("");
  L.push("def prompt(s: dict) -> str:");
  L.push('    parts = [f"Question: {s[\'question\']}"]');
  L.push('    if s["context"]: parts.append("Context:\\n" + "\\n".join(f"[{i+1}] {c}" for i, c in enumerate(s["context"])))');
  L.push('    if s["draft"]: parts.append("Work so far:\\n" + s["draft"])');
  L.push('    return "\\n\\n".join(parts)');
  L.push("");
  L.push("class Stop(Exception):");
  L.push('    """Raised when a guardrail blocks, a reviewer rejects, or a cache answers."""');
  L.push("");

  // tools
  for (const n of graph.nodes.filter((x) => TOOL_KINDS.includes(x.kind))) {
    L.push(`async def tool_${n.id.replace(/\W/g, "_")}(query: str) -> str:`);
    L.push(`    """${n.params.label}"""`);
    if (n.kind === "retriever") {
      L.push(`    DOCS = ${py(n.params.docs ?? "")}.split("\\n\\n")`);
      L.push("    # TODO: replace keyword overlap with embeddings + a vector store (Level 4)");
      L.push("    words = set(re.findall(r'[a-z0-9]{3,}', query.lower()))");
      L.push("    scored = sorted(DOCS, key=lambda d: -len(words & set(re.findall(r'[a-z0-9]{3,}', d.lower()))))");
      L.push(`    return "\\n---\\n".join(scored[:${n.params.topK ?? 3}])`);
    } else if (n.params.toolKind === "calculator") {
      L.push('    if not re.fullmatch(r"[\\d+\\-*/(). ]+", query): return "arithmetic only"');
      L.push("    return str(eval(query, {'__builtins__': {}}))  # arithmetic only, checked above");
    } else {
      L.push(`    # TODO: call the real ${n.params.toolKind ?? n.kind} here; add a timeout (~${Math.round((n.params.latencyMs ?? 500) * 3)} ms) and ${n.params.retries ?? 0} retr${(n.params.retries ?? 0) === 1 ? "y" : "ies"}`);
      L.push(`    return f"(placeholder result from ${n.params.label} for {query!r})"`);
    }
    L.push("");
  }

  for (const n of graph.nodes) {
    const o = outs(n.id);
    const chain = (edges = o) => edges.map((e) => `    s = await ${fn(byId.get(e.target)!)}(s, stop)`);
    L.push(`async def ${fn(n)}(s: dict, stop: str | None = None) -> dict:`);
    L.push(`    """${KIND_DOC[n.kind]}: ${n.params.label}"""`);
    L.push(`    if stop == ${py(n.id)}: return s`);
    switch (n.kind) {
      case "input":
        L.push(...chain());
        break;
      case "output":
        L.push('    s["final"] = s["draft"]');
        break;
      case "llm":
        L.push(`    s["draft"] = await llm(${py(n.params.tier ?? "medium")}, ${py(n.params.system ?? "")}, prompt(s), ${n.params.outTokens ?? 400})`);
        L.push(...chain());
        break;
      case "critic":
        L.push(`    verdict = await llm(${py(n.params.tier ?? "small")}, ${py(n.params.system ?? "Reply APPROVE or list fixes.")}, prompt(s), 300)`);
        L.push('    if not verdict.strip().upper().startswith("APPROVE"):');
        L.push(`        s["draft"] = await llm(${py(n.params.tier ?? "small")}, "Revise the draft using the feedback. Return only the answer.", prompt(s) + "\\n\\nFeedback:\\n" + verdict)`);
        L.push(...chain());
        break;
      case "agent": {
        const tools = o.filter((e) => isTool(n, e.target)).map((e) => byId.get(e.target)!);
        const rest = o.filter((e) => !isTool(n, e.target));
        L.push(`    tools = {${tools.map((t) => `${py(t.params.label)}: tool_${t.id.replace(/\W/g, "_")}`).join(", ")}}`);
        L.push(`    system = ${py(n.params.system ?? "You are an agent.")} + "\\nTools: " + ", ".join(tools) + "\\nReply with one line: TOOL: <name> | <input>  or  FINAL: <answer>"`);
        L.push("    steps = []");
        L.push(`    for _ in range(${Math.max(2, Math.round((n.params.steps ?? 3) * 1.5))}):  # a step cap stops runaway loops`);
        L.push(`        reply = await llm(${py(n.params.tier ?? "medium")}, system, prompt(s) + "\\n\\nSteps so far:\\n" + "\\n".join(steps), 400)`);
        L.push('        m = re.match(r"\\s*TOOL:\\s*([^|]+)\\|\\s*(.*)", reply)');
        L.push("        if m and m.group(1).strip() in tools:");
        L.push("            result = await tools[m.group(1).strip()](m.group(2).strip())");
        L.push('            steps.append(f"{m.group(1).strip()}({m.group(2).strip()}) -> {result[:500]}")');
        L.push("            continue");
        L.push('        s["draft"] = re.sub(r"^\\s*FINAL:\\s*", "", reply)');
        L.push("        break");
        L.push(...chain(rest));
        break;
      }
      case "tool":
      case "memory":
      case "retriever":
        L.push(`    result = await tool_${n.id.replace(/\W/g, "_")}(s["question"])`);
        L.push(n.kind === "retriever" ? '    s["context"] += result.split("\\n---\\n")' : `    s["draft"] += "\\n${n.params.label}: " + result`);
        L.push(...chain());
        break;
      case "reranker":
        L.push('    s["context"] = s["context"][:3]  # TODO: score (question, passage) pairs with a cross-encoder and keep the best');
        L.push(...chain());
        break;
      case "router": {
        L.push(`    routes = [${o.map((e) => `(${py(byId.get(e.target)!.params.label)}, ${fn(byId.get(e.target)!)}, ${e.weight ?? 1})`).join(", ")}]`);
        L.push("    # TODO: replace the weighted coin with a classifier or a small-model routing call");
        L.push("    _, nxt, _ = random.choices(routes, weights=[w for *_, w in routes])[0]");
        L.push("    s = await nxt(s, stop)");
        break;
      }
      case "cascade": {
        const [a, b] = o;
        L.push(a ? `    s = await ${fn(byId.get(a.target)!)}(s, ${py(joinHint(graph, o.map((e) => e.target)))})` : "    pass");
        if (b) {
          L.push('    if re.search(r"not sure|don.?t know|cannot|unclear", s["draft"], re.I) or len(s["draft"]) < 25:  # TODO: a real confidence signal');
          L.push(`        s = await ${fn(byId.get(b.target)!)}(s, ${py(joinHint(graph, o.map((e) => e.target)))})`);
        }
        const j = joinHint(graph, o.map((e) => e.target));
        if (j) L.push(`    s = await ${fn(byId.get(j)!)}(s, stop)`);
        break;
      }
      case "parallel": {
        const j = joinHint(graph, o.map((e) => e.target));
        L.push(`    branches = await asyncio.gather(${o.map((e) => `${fn(byId.get(e.target)!)}({**s, "context": list(s["context"]), "draft": ""}, ${py(j)})`).join(", ")})`);
        L.push('    findings = "\\n\\n".join(b["draft"] for b in branches)');
        L.push(`    s["draft"] = await llm(${py(n.params.tier ?? "medium")}, ${py(n.params.system ?? "Merge the findings.")}, prompt({**s, "draft": ""}) + "\\n\\nFindings:\\n" + findings)`);
        if (j) L.push(`    s = await ${fn(byId.get(j)!)}(s, stop)`);
        break;
      }
      case "guardrail":
        L.push('    text = s["draft"] or s["question"]');
        L.push('    if re.search(r"ignore (all|previous|prior) instructions|reveal (your|the) system prompt", text, re.I) or re.search(r"[\\w.+-]+@[\\w-]+\\.\\w+", text):');
        L.push(`        raise Stop("Blocked by ${n.params.label}")  # TODO: use a classifier / moderation API too`);
        L.push(...chain());
        break;
      case "human":
        L.push(`    if input(f"Approve? ${n.params.label}\\n{s['draft'][:400]}\\n[y/N] ").strip().lower() != "y":`);
        L.push(`        raise Stop("Rejected at ${n.params.label}")  # TODO: a real approval queue in production`);
        L.push(...chain());
        break;
      case "cache":
        L.push('    key = s["question"].strip().lower()');
        L.push('    if key in CACHE: s["final"] = CACHE[key]; raise Stop(CACHE[key])');
        L.push(...chain());
        L.push('    if s.get("final"): CACHE[key] = s["final"]  # TODO: semantic match with embeddings, plus a TTL');
        break;
      case "replicas":
        L.push(`    # served by ${n.params.replicas ?? 1} replica(s): in production this is your vLLM/SGLang endpoint behind the gateway`);
        L.push(...chain());
        break;
      case "gateway":
        L.push(`    # TODO: authenticate the caller and enforce ~${n.params.rateLimit ?? 50} req/s per key (e.g. a token bucket in Redis)`);
        L.push(...chain());
        break;
      case "balancer":
        L.push(`    nxt = random.choice([${o.map((e) => fn(byId.get(e.target)!)).join(", ")}])  # in production: your load balancer / k8s Service`);
        L.push("    s = await nxt(s, stop)");
        break;
      case "queue":
        L.push(`    # TODO: enqueue the job (Redis/RQ, Celery, SQS) for ${n.params.replicas ?? 1} workers; here we run it inline`);
        L.push(...chain());
        break;
      case "embedder":
        L.push('    # TODO: s["vector"] = (await client.embeddings.create(model="text-embedding-3-small", input=s["question"])).data[0].embedding')
        L.push(...chain());
        break;
      case "database":
        L.push(`    # TODO: query ${n.params.label} with a parameterised, read-only SQL statement`);
        L.push(...chain());
        break;
    }
    L.push("    return s");
    L.push("");
  }

  L.push("CACHE: dict[str, str] = {}");
  L.push("");
  L.push("async def main(question: str) -> str:");
  L.push('    s = {"question": question, "context": [], "draft": "", "final": ""}');
  L.push("    try:");
  L.push(start ? `        s = await ${fn(start)}(s)` : "        pass  # add a User request node");
  L.push("    except Stop as e:");
  L.push("        return str(e)");
  L.push('    return s["final"] or s["draft"]');
  L.push("");
  L.push('if __name__ == "__main__":');
  L.push('    print(asyncio.run(main(input("Question: "))))');
  return L.join("\n");
}

const KIND_DOC: Record<StudioNode["kind"], string> = {
  input: "Entry point",
  output: "Final answer",
  llm: "LLM call",
  agent: "Agent loop with tools",
  tool: "Tool",
  retriever: "Retriever",
  reranker: "Reranker",
  memory: "Memory",
  router: "Router",
  cascade: "Cascade (cheap first, escalate when unsure)",
  parallel: "Fan-out, then merge",
  guardrail: "Guardrail",
  human: "Human approval",
  cache: "Cache",
  critic: "Critic with one revision",
  replicas: "GPU replica pool",
  gateway: "API gateway",
  balancer: "Load balancer",
  queue: "Queue and workers",
  embedder: "Embedding model",
  database: "Database",
};

/** where branches starting at `ids` meet again (ignores an agent's tools) */
function joinHint(graph: StudioGraph, ids: string[]): string {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const reach = (from: string) => {
    const order: string[] = [];
    const seen = new Set<string>();
    const q = [from];
    while (q.length) {
      const id = q.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      order.push(id);
      const n = byId.get(id);
      for (const e of graph.edges.filter((x) => x.source === id)) if (!(n?.kind === "agent" && TOOL_KINDS.includes(byId.get(e.target)?.kind ?? "input"))) q.push(e.target);
    }
    return { order, seen };
  };
  const rs = ids.map(reach);
  return rs[0]?.order.find((x) => rs.every((r) => r.seen.has(x))) ?? "";
}
