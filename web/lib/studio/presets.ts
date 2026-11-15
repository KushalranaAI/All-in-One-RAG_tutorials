import { KINDS } from "./catalog";
import type { NodeKind, NodeParams, StudioEdge, StudioGraph, StudioNode } from "./types";

/**
 * Pre-built Studio designs for the RAG course. Twelve model the course's own projects, three model key days.
 * Prices, speeds and rates are example numbers for comparing designs, not quotes: change a block and watch what moves.
 */
export interface Preset {
  id: string;
  title: string;
  /** the real product this models, in one sentence */
  scenario: string;
  /** the course days that teach it (links to /learn/week-N/day-NN-...) */
  days: number[];
  /** the project folder it models, if any (links to /projects/<slug>) */
  project?: string;
  /** things to change and what you should see */
  tryThis: string[];
  rps?: number;
  graph: StudioGraph;
}

/** the 30 day folders, in order: Day 1 is index 0 */
const DAY_SLUGS = [
  "day-01-what-is-rag",
  "day-02-embeddings",
  "day-03-document-loading",
  "day-04-chunking",
  "day-05-vector-databases",
  "day-06-first-rag-pipeline",
  "day-07-prompting-and-citations",
  "day-08-hybrid-search",
  "day-09-reranking",
  "day-10-query-transformation",
  "day-11-metadata-filtering",
  "day-12-parent-document-retrieval",
  "day-13-contextual-retrieval",
  "day-14-evaluation",
  "day-15-tool-use",
  "day-16-agentic-rag",
  "day-17-corrective-rag",
  "day-18-graph-rag",
  "day-19-mcp-fundamentals",
  "day-20-build-mcp-server",
  "day-21-mcp-client",
  "day-22-multi-agent-patterns",
  "day-23-multi-agent-research",
  "day-24-memory-conversational-rag",
  "day-25-multimodal-rag",
  "day-26-structured-data-sql",
  "day-27-serving-api",
  "day-28-cost-latency",
  "day-29-guardrails-security",
  "day-30-deployment",
] as const;

/** the lesson page for a day: weeks hold days 1-7, 8-14, 15-21 and 22-30 */
export function dayPath(day: number): string {
  const week = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
  return `/learn/week-${week}/${DAY_SLUGS[day - 1]}`;
}

/** blocks are 210px wide: positions below are written on a tighter grid and spread out by this factor */
const SPREAD = 1.3;
const node = (id: string, kind: NodeKind, x: number, y: number, params: Partial<NodeParams> = {}): StudioNode => ({
  id,
  kind,
  x: Math.round(x * SPREAD),
  y,
  params: { ...KINDS[kind].defaults, ...params },
});
const edge = (source: string, target: string, weight?: number): StudioEdge => ({ id: `${source}->${target}`, source, target, weight });

export const PRESETS: Preset[] = [
  {
    id: "document-chat",
    title: "Document chat assistant",
    scenario: "A user uploads PDFs and chats with them: the question is embedded, hybrid search finds passages, and the answer streams back with numbered citations.",
    days: [3, 4, 5, 6, 7, 8, 27],
    project: "01-document-chat-assistant",
    tryThis: [
      "Lower the retriever's recall from 0.8 to 0.55 (poor chunking): nothing errors, but 'correct' falls. How would a user notice?",
      "Raise top-k from 5 to 15: the prompt grows, so cost and p50 rise. Does 'correct' rise enough to justify it?",
      "Switch the answer model from Medium to Small: how many correct answers do you lose per dollar saved?",
      "Set 'questions that need your own data' to 100%: the model can no longer answer from memory, so retrieval quality is everything.",
    ],
    graph: {
      nodes: [
        node("in", "input", 0, 130, { label: "Question about my files", knowledgeShare: 0.85 }),
        node("emb", "embedder", 220, 130, { label: "Embed the question" }),
        node("ret", "retriever", 440, 130, { label: "Hybrid search (dense + BM25)", recall: 0.8, topK: 5, latencyMs: 70 }),
        node("llm", "llm", 680, 130, { label: "Answer with numbered citations", tier: "medium", inTokens: 2400, outTokens: 300, system: "Answer only from the numbered sources. Cite them as [1], [2]. If the sources do not contain the answer, say so." }),
        node("out", "output", 920, 130, { label: "Streamed answer + sources" }),
      ],
      edges: [edge("in", "emb"), edge("emb", "ret"), edge("ret", "llm"), edge("llm", "out")],
    },
  },
  {
    id: "codebase-qa-agent",
    title: "Codebase Q&A agent",
    scenario: "A developer asks where something is implemented: an agent searches function-level code chunks, opens the files it needs and answers with path:line references.",
    days: [4, 8, 16, 20],
    project: "03-codebase-qa-agent",
    tryThis: [
      "Raise the agent's steps from 4 to 8: harder questions get answered, but watch p95 and cost climb. Where do you cap it?",
      "Set the file-reader's fail rate to 0.15: the agent retries or guesses. What should it do instead?",
      "Replace the code search with a plain keyword search (recall 0.6): compare 'correct'. This is why code is chunked by function.",
      "Make the agent Small: much cheaper, but count the answers that cite the wrong file.",
    ],
    graph: {
      nodes: [
        node("in", "input", 0, 170, { label: "Where is vector search implemented?", knowledgeShare: 0.9 }),
        node("ag", "agent", 260, 170, { label: "Code agent", tier: "medium", steps: 4, inTokens: 3000, outTokens: 250, system: "Search the code, open only the files you need, and answer with path:line references." }),
        node("sc", "retriever", 560, 20, { label: "search_code (function chunks)", recall: 0.82, latencyMs: 90 }),
        node("rf", "tool", 560, 170, { label: "read_file(path, lines)", toolKind: "code", latencyMs: 25, failRate: 0.01 }),
        node("lf", "tool", 560, 320, { label: "list_files(pattern)", toolKind: "code", latencyMs: 20, failRate: 0 }),
        node("out", "output", 860, 170, { label: "Answer with path:line" }),
      ],
      edges: [edge("in", "ag"), edge("ag", "sc"), edge("ag", "rf"), edge("ag", "lf"), edge("ag", "out")],
    },
  },
  {
    id: "support-reply-copilot",
    title: "Support reply copilot",
    scenario: "A support team pastes a customer email: a cheap model triages it, search and reranking find the right help articles, a strong model drafts the reply, and unsure or angry cases go to a human.",
    days: [8, 9, 11, 17],
    project: "04-support-reply-copilot",
    tryThis: [
      "Shift the confidence router from 8/2 to 6/4: more drafts reach a human. Watch p95 and the human wait dominate.",
      "Remove the reranker: faster and cheaper, but how far does 'correct' fall?",
      "Make the drafting model Medium instead of Large: what does the saving cost you in correct replies?",
      "Set the human's response time to 5 minutes: the average barely moves but p99 does. Why?",
    ],
    graph: {
      nodes: [
        node("in", "input", 0, 170, { label: "Customer email", knowledgeShare: 0.8 }),
        node("tri", "llm", 200, 170, { label: "Triage (intent, urgency, sentiment)", tier: "small", inTokens: 700, outTokens: 120 }),
        node("ret", "retriever", 440, 170, { label: "Hybrid search per query", recall: 0.78 }),
        node("rr", "reranker", 660, 170, { label: "LLM rerank to top 4", lift: 0.5, latencyMs: 400 }),
        node("dr", "llm", 880, 170, { label: "Draft reply (structured)", tier: "large", inTokens: 2800, outTokens: 350 }),
        node("rt", "router", 1100, 170, { label: "Confidence guard", latencyMs: 10 }),
        node("hu", "human", 1340, 300, { label: "Support agent reviews", waitMs: 180000, approveRate: 0.95 }),
        node("out", "output", 1560, 170, { label: "Reply sent" }),
      ],
      edges: [edge("in", "tri"), edge("tri", "ret"), edge("ret", "rr"), edge("rr", "dr"), edge("dr", "rt"), { ...edge("rt", "out"), weight: 8 }, { ...edge("rt", "hu"), weight: 2 }, edge("hu", "out")],
    },
  },
  {
    id: "data-analyst-agent",
    title: "Data analyst agent",
    scenario: "A business analyst asks a question that needs live numbers and company policy: the agent reads the schema, runs read-only SQL, searches the handbook, and a writer turns it into a report.",
    days: [21, 26],
    project: "07-data-analyst-agent",
    tryThis: [
      "Set the SQL database's fail rate to 0.1: the agent retries queries. What should a report say when the data is unavailable?",
      "Raise the agent's steps to 7: it checks its own numbers more, at what cost per report?",
      "Remove the handbook search: numbers are right but policy answers are guesses. Check 'correct' with 'own data' at 90%.",
      "Swap the report writer from Large to Medium: is the report noticeably worse for the simulated correctness?",
    ],
    graph: {
      nodes: [
        node("in", "input", 0, 170, { label: "Why did Q3 churn rise?", knowledgeShare: 0.9 }),
        node("ag", "agent", 240, 170, { label: "Analyst agent", tier: "medium", steps: 5, inTokens: 3200, outTokens: 300, system: "Plan, query the data with read-only SQL, check the result, combine it with company policy, then report." }),
        node("sql", "database", 540, 20, { label: "MCP sql: run_sql (read-only)", latencyMs: 120, failRate: 0.01 }),
        node("sch", "database", 540, 170, { label: "MCP sql: get_schema", latencyMs: 30, failRate: 0 }),
        node("doc", "retriever", 540, 320, { label: "MCP docs: search_docs", recall: 0.85, latencyMs: 80 }),
        node("wr", "llm", 800, 170, { label: "Write report.md with the queries", tier: "large", inTokens: 4000, outTokens: 700 }),
        node("out", "output", 1040, 170, { label: "Report" }),
      ],
      edges: [edge("in", "ag"), edge("ag", "sql"), edge("ag", "sch"), edge("ag", "doc"), edge("ag", "wr"), edge("wr", "out")],
    },
  },
  {
    id: "meeting-intelligence",
    title: "Meeting intelligence",
    scenario: "A weekly folder of transcripts: one cheap extractor agent per meeting runs in parallel to produce structured minutes, and a writer merges them into the weekly digest.",
    days: [12, 22, 24],
    project: "08-meeting-intelligence",
    tryThis: [
      "Make one extractor fail 20% of the time: the digest still arrives, with a gap. Is that acceptable for decisions and owners?",
      "Swap the extractors from Small to Medium: how much do you pay for the same minutes?",
      "Add a fourth transcript by copying an extractor: the digest waits for the slowest branch, not the sum.",
      "Raise the digest writer's input tokens to 12,000 (more meetings): where does cost jump?",
    ],
    graph: {
      nodes: [
        node("in", "input", 0, 190, { label: "This week's transcripts", inTokens: 6000 }),
        node("fan", "parallel", 240, 190, { label: "One extractor per meeting", tier: "small", inTokens: 800, outTokens: 100 }),
        node("m1", "llm", 520, 30, { label: "Extract minutes: Monday sync", tier: "small", inTokens: 6000, outTokens: 500 }),
        node("m2", "llm", 520, 190, { label: "Extract minutes: Product review", tier: "small", inTokens: 6000, outTokens: 500 }),
        node("m3", "llm", 520, 350, { label: "Extract minutes: Customer call", tier: "small", inTokens: 6000, outTokens: 500 }),
        node("dg", "llm", 800, 190, { label: "Weekly digest (decisions, actions)", tier: "medium", inTokens: 4000, outTokens: 700 }),
        node("out", "output", 1040, 190, { label: "Digest + minutes files" }),
      ],
      edges: [edge("in", "fan"), edge("fan", "m1"), edge("fan", "m2"), edge("fan", "m3"), edge("m1", "dg"), edge("m2", "dg"), edge("m3", "dg"), edge("dg", "out")],
    },
  },
  {
    id: "multi-agent-research",
    title: "Multi-agent research team",
    scenario: "A research question is planned, split across parallel researchers that use both internal documents and the live web, written up from their findings and reviewed by a critic.",
    days: [16, 22, 23],
    project: "09-multi-agent-research-team",
    tryThis: [
      "Raise the critic's revise rate to 0.6: quality goes up, so do cost and time. Find the point where it stops paying off.",
      "Make the web search fail 25% of the time: the report is built on less evidence. Does 'correct' notice?",
      "Drop to two researchers: compare correctness per dollar and p95.",
      "Make the planner Medium instead of Large: the plan is the cheapest place to save, or the worst place?",
    ],
    graph: {
      nodes: [
        node("in", "input", 0, 200, { label: "Research question", knowledgeShare: 0.6 }),
        node("plan", "llm", 200, 200, { label: "Planner (sections + questions)", tier: "large", inTokens: 900, outTokens: 300 }),
        node("fan", "parallel", 430, 200, { label: "Dispatch researchers", tier: "small", inTokens: 4000, outTokens: 200 }),
        node("r1", "agent", 700, 40, { label: "Researcher A", tier: "small", steps: 3 }),
        node("r2", "agent", 700, 200, { label: "Researcher B", tier: "small", steps: 3 }),
        node("r3", "agent", 700, 360, { label: "Researcher C", tier: "small", steps: 3 }),
        node("int", "retriever", 980, 40, { label: "Internal knowledge search", recall: 0.82 }),
        node("web", "tool", 980, 360, { label: "Live web search", toolKind: "search", latencyMs: 900, failRate: 0.04 }),
        node("wr", "llm", 980, 200, { label: "Writer (findings only)", tier: "large", inTokens: 6000, outTokens: 900 }),
        node("cr", "critic", 1220, 200, { label: "Critic + editor", tier: "large", reviseRate: 0.35 }),
        node("out", "output", 1440, 200, { label: "Sourced report" }),
      ],
      edges: [edge("in", "plan"), edge("plan", "fan"), edge("fan", "r1"), edge("fan", "r2"), edge("fan", "r3"), edge("r1", "int"), edge("r2", "int"), edge("r2", "web"), edge("r3", "web"), edge("r1", "wr"), edge("r2", "wr"), edge("r3", "wr"), edge("wr", "cr"), edge("cr", "out")],
    },
  },
  {
    id: "contract-review",
    title: "Contract review agents",
    scenario: "A legal team's first pass: clauses are extracted, three reviewers check them in parallel against the company playbook, and a lawyer signs off the redline summary.",
    days: [7, 11, 22],
    project: "10-contract-review-agents",
    tryThis: [
      "Lower the playbook retriever's recall to 0.6: reviews look confident but cite the wrong rule. This is the quiet failure.",
      "Remove the lawyer's sign-off: p95 falls from minutes to seconds. Which clauses should never skip a human?",
      "Make the reviewers Small: cheaper per contract, but check 'correct' on a 'needs your own data' share of 90%.",
      "Set the lawyer's approve rate to 0.7: more contracts bounce back. Is the AI weak, or the lawyer strict?",
    ],
    rps: 2,
    graph: {
      nodes: [
        node("in", "input", 0, 200, { label: "Contract uploaded", inTokens: 8000, knowledgeShare: 0.9 }),
        node("ex", "llm", 200, 200, { label: "Extract clauses (structured)", tier: "medium", inTokens: 9000, outTokens: 700 }),
        node("fan", "parallel", 440, 200, { label: "Review clause groups", tier: "small", inTokens: 1500, outTokens: 150 }),
        node("r1", "agent", 700, 30, { label: "Liability and indemnity reviewer", tier: "medium", steps: 3 }),
        node("r2", "agent", 700, 200, { label: "Payment and term reviewer", tier: "medium", steps: 3 }),
        node("r3", "agent", 700, 370, { label: "IP and confidentiality reviewer", tier: "medium", steps: 3 }),
        node("pb", "retriever", 980, 200, { label: "Playbook: standard, fallback, red lines", recall: 0.85, latencyMs: 80 }),
        node("sm", "llm", 980, 30, { label: "Redline summary", tier: "medium", inTokens: 5000, outTokens: 800 }),
        node("hu", "human", 1220, 30, { label: "Lawyer sign-off", waitMs: 120000, approveRate: 0.95 }),
        node("out", "output", 1440, 30, { label: "Approved review" }),
      ],
      edges: [edge("in", "ex"), edge("ex", "fan"), edge("fan", "r1"), edge("fan", "r2"), edge("fan", "r3"), edge("r1", "pb"), edge("r2", "pb"), edge("r3", "pb"), edge("r1", "sm"), edge("r2", "sm"), edge("r3", "sm"), edge("sm", "hu"), edge("hu", "out")],
    },
  },
  {
    id: "graph-rag-explorer",
    title: "Graph RAG explorer",
    scenario: "Connected questions go to a local entity-neighbourhood search; broad 'what are the main themes?' questions go to a map-reduce over community summaries.",
    days: [18, 20],
    project: "11-graph-rag-explorer",
    tryThis: [
      "Shift the router from 6/4 to 2/8: more broad questions use map-reduce. Compare cost per request: why is global search so much dearer?",
      "Lower the graph retriever's recall to 0.6 (bad entity resolution): local answers get worse without any error.",
      "Remove one map branch: the global answer is cheaper and faster but covers fewer communities.",
      "Make the reduce step Large: where does the cost land: the map or the reduce?",
    ],
    graph: {
      nodes: [
        node("in", "input", 0, 220, { label: "Question about the corpus", knowledgeShare: 0.9 }),
        node("rt", "router", 220, 220, { label: "Local or global?", latencyMs: 30 }),
        node("gr", "retriever", 480, 40, { label: "Entity neighbourhood (1-2 hops)", recall: 0.82, latencyMs: 110 }),
        node("lo", "llm", 740, 40, { label: "Answer from connected facts", tier: "medium", inTokens: 2500, outTokens: 300 }),
        node("mp", "parallel", 480, 300, { label: "Map over community summaries", tier: "small", inTokens: 500, outTokens: 100 }),
        node("m1", "llm", 740, 200, { label: "Partial answer: community A", tier: "small", inTokens: 1800, outTokens: 200 }),
        node("m2", "llm", 740, 340, { label: "Partial answer: community B", tier: "small", inTokens: 1800, outTokens: 200 }),
        node("m3", "llm", 740, 480, { label: "Partial answer: community C", tier: "small", inTokens: 1800, outTokens: 200 }),
        node("rd", "llm", 1000, 340, { label: "Reduce to one answer", tier: "medium", inTokens: 2500, outTokens: 400 }),
        node("out", "output", 1240, 220, { label: "Answer" }),
      ],
      edges: [edge("in", "rt"), { ...edge("rt", "gr"), weight: 6 }, { ...edge("rt", "mp"), weight: 4 }, edge("gr", "lo"), edge("lo", "out"), edge("mp", "m1"), edge("mp", "m2"), edge("mp", "m3"), edge("m1", "rd"), edge("m2", "rd"), edge("m3", "rd"), edge("rd", "out")],
    },
  },
  {
    id: "invoice-intelligence",
    title: "Invoice intelligence (ingest)",
    scenario: "Finance drops invoices (PDFs, scans, photos) into a folder: jobs queue up, a vision model reads each one, a validator rejects malformed records and good ones land in SQLite for the analyst agent to query.",
    days: [25, 26],
    project: "12-invoice-intelligence",
    tryThis: [
      "Cut the workers from 4 to 1 and raise traffic to 4 req/s: the queue grows and p99 explodes while cost stays flat.",
      "Raise the validator's block rate to 0.2 (blurry scans): how many invoices never reach the database?",
      "Make the vision model Small: cheaper per invoice, but does 'correct' fall on messy scans?",
      "There is no retriever here at all: which block is the real cost, the model or the queue?",
    ],
    rps: 2,
    graph: {
      nodes: [
        node("in", "input", 0, 150, { label: "Invoice dropped in the folder" }),
        node("q", "queue", 220, 150, { label: "Extraction job queue", replicas: 4, serviceMs: 2500 }),
        node("vis", "llm", 460, 150, { label: "Read the invoice (vision, structured)", tier: "medium", inTokens: 2200, outTokens: 400 }),
        node("val", "guardrail", 720, 150, { label: "Validate fields and totals", blockRate: 0.05, latencyMs: 20 }),
        node("db", "database", 960, 150, { label: "SQLite: invoices + line items", latencyMs: 30 }),
        node("out", "output", 1200, 150, { label: "Queryable record" }),
      ],
      edges: [edge("in", "q"), edge("q", "vis"), edge("vis", "val"), edge("val", "db"), edge("db", "out")],
    },
  },
  {
    id: "support-agent-team",
    title: "Support agent team over MCP",
    scenario: "A support desk where a triage model routes each message to a billing, technical or account specialist. Each specialist only gets the MCP tools its job needs, and a QA reviewer checks the reply.",
    days: [17, 21, 22, 29],
    project: "13-support-agent-team-mcp",
    tryThis: [
      "Make the ticketing system fail 10% of the time: only the specialists that use it suffer. That is the value of isolated tools.",
      "Change the router from 4/4/2 to 1/1/8: the account specialist becomes the bottleneck. Which agent would you give more steps?",
      "Raise the QA critic's revise rate to 0.5: safer replies, at what latency and cost?",
      "Add a guardrail block rate of 0.1 on the way in: what share of customers do you turn away?",
    ],
    graph: {
      nodes: [
        node("in", "input", 0, 220, { label: "Customer message", knowledgeShare: 0.7 }),
        node("g", "guardrail", 200, 220, { label: "Injection and PII filter", blockRate: 0.03 }),
        node("tri", "llm", 400, 220, { label: "Triage (category, severity)", tier: "small", inTokens: 600, outTokens: 100 }),
        node("rt", "router", 600, 220, { label: "Route to a specialist", latencyMs: 10 }),
        node("bi", "agent", 860, 40, { label: "Billing specialist", tier: "small", steps: 3 }),
        node("te", "agent", 860, 220, { label: "Technical specialist", tier: "medium", steps: 4 }),
        node("ac", "agent", 860, 400, { label: "Account specialist", tier: "small", steps: 3 }),
        node("docs", "retriever", 1140, 40, { label: "MCP docs: search_docs", recall: 0.84 }),
        node("tk", "database", 1140, 220, { label: "MCP tickets: find / list", latencyMs: 60, failRate: 0.01 }),
        node("ct", "tool", 1140, 400, { label: "MCP tickets: create_ticket", toolKind: "api", latencyMs: 250, failRate: 0.02 }),
        node("qa", "critic", 1140, 600, { label: "QA reviewer", tier: "small", reviseRate: 0.25 }),
        node("out", "output", 1400, 220, { label: "Reply" }),
      ],
      edges: [
        edge("in", "g"), edge("g", "tri"), edge("tri", "rt"),
        { ...edge("rt", "bi"), weight: 4 }, { ...edge("rt", "te"), weight: 4 }, { ...edge("rt", "ac"), weight: 2 },
        edge("bi", "docs"), edge("bi", "tk"), edge("te", "docs"), edge("te", "ct"), edge("ac", "tk"), edge("ac", "ct"),
        edge("bi", "qa"), edge("te", "qa"), edge("ac", "qa"), edge("qa", "out"),
      ],
    },
  },
  {
    id: "rag-eval-lab",
    title: "RAG evaluation lab",
    scenario: "A benchmark harness that answers 'which RAG setup is best for my data?': every test question goes through retrieval and an answer model, then an LLM judge scores it. Evaluation can cost more than serving.",
    days: [4, 8, 9, 13, 14],
    project: "14-rag-evaluation-lab",
    tryThis: [
      "Compare cost per request with the Help-centre style serving designs: judging every answer roughly doubles the bill. When is a sample enough?",
      "Make the judge Medium instead of Large: cheaper evals, but how much would you trust a weaker judge?",
      "Remove the reranker: retrieval gets faster and cheaper. Does 'correct' fall by more than the saving is worth?",
      "Raise the judge's revise rate to 0.5 (second opinions on borderline answers): what does the extra rigour cost per 1,000 questions?",
    ],
    graph: {
      nodes: [
        node("in", "input", 0, 130, { label: "Generated test question", knowledgeShare: 0.9 }),
        node("ret", "retriever", 220, 130, { label: "Retriever under test (hybrid, k=5)", recall: 0.8 }),
        node("rr", "reranker", 450, 130, { label: "Reranker under test", lift: 0.5, latencyMs: 300 }),
        node("llm", "llm", 680, 130, { label: "Answer model", tier: "medium", inTokens: 2400, outTokens: 250 }),
        node("jd", "critic", 910, 130, { label: "LLM judge: correct and faithful?", tier: "large", inTokens: 3000, outTokens: 200, reviseRate: 0.2 }),
        node("out", "output", 1140, 130, { label: "Score row in the leaderboard" }),
      ],
      edges: [edge("in", "ret"), edge("ret", "rr"), edge("rr", "llm"), edge("llm", "jd"), edge("jd", "out")],
    },
  },
  {
    id: "enterprise-rag-platform",
    title: "Enterprise RAG platform",
    scenario: "The capstone: a gateway, guardrails, memory and a semantic cache sit in front of a router that sends each question to a docs, data or support agent, then a critic checks the answer.",
    days: [22, 24, 27, 28, 29, 30],
    project: "15-enterprise-rag-platform",
    rps: 6,
    tryThis: [
      "Raise the cache hit rate from 0.2 to 0.5: how much cost and p50 disappear before any agent runs?",
      "Lower the gateway's rate limit to 4 req/s at 6 req/s of traffic: requests are rejected outright. Is that better than slow answers?",
      "Shift the router toward the data agent (6/2/2): the database becomes the busiest block. What would you index first?",
      "Remove the critic: faster and cheaper, but check 'correct'. Which departments could live without it?",
    ],
    graph: {
      nodes: [
        node("in", "input", 0, 240, { label: "Employee or customer question", knowledgeShare: 0.75 }),
        node("gw", "gateway", 190, 240, { label: "API gateway (auth, RBAC)", rateLimit: 40 }),
        node("g1", "guardrail", 370, 240, { label: "Input guardrails", blockRate: 0.03 }),
        node("mem", "memory", 550, 240, { label: "Conversation memory", latencyMs: 20 }),
        node("ca", "cache", 730, 240, { label: "Semantic cache", hitRate: 0.2 }),
        node("rt", "router", 910, 240, { label: "Router (permission-filtered)", latencyMs: 25 }),
        node("da", "agent", 1170, 40, { label: "Docs agent", tier: "small", steps: 3 }),
        node("db", "agent", 1170, 240, { label: "Data agent", tier: "medium", steps: 4 }),
        node("sa", "agent", 1170, 440, { label: "Support agent", tier: "small", steps: 3 }),
        node("rd", "retriever", 1450, 40, { label: "Company docs search", recall: 0.84 }),
        node("sq", "database", 1450, 240, { label: "Read-only SQL", latencyMs: 120, failRate: 0.01 }),
        node("tk", "tool", 1450, 440, { label: "Ticketing API", toolKind: "api", latencyMs: 300, failRate: 0.02 }),
        node("cr", "critic", 1450, 640, { label: "Answer critic", tier: "small", reviseRate: 0.2 }),
        node("out", "output", 1700, 240, { label: "Answer + trace" }),
      ],
      edges: [
        edge("in", "gw"), edge("gw", "g1"), edge("g1", "mem"), edge("mem", "ca"), edge("ca", "rt"),
        { ...edge("rt", "da"), weight: 5 }, { ...edge("rt", "db"), weight: 3 }, { ...edge("rt", "sa"), weight: 2 },
        edge("da", "rd"), edge("db", "sq"), edge("sa", "tk"),
        edge("da", "cr"), edge("db", "cr"), edge("sa", "cr"), edge("cr", "out"),
      ],
    },
  },
  {
    id: "hybrid-search-rerank",
    title: "Hybrid search + reranking",
    scenario: "The Week 2 upgrade to a basic RAG bot: keyword and vector search are fused, then a cross-encoder reranks the shortlist before the answer model sees it.",
    days: [8, 9],
    tryThis: [
      "Set recall to 0.6 and then add the reranker's lift: how much of the missing accuracy does the reranker win back?",
      "Make the reranker slower (latency 600 ms): is the extra accuracy still worth the wait at p95?",
      "Delete the reranker and raise top-k to 12 instead: compare cost and 'correct'. Which is the cheaper way to buy recall?",
      "Add a cache with hit rate 0.3: repeated questions skip everything after it.",
    ],
    graph: {
      nodes: [
        node("in", "input", 0, 120, { label: "Question", knowledgeShare: 0.85 }),
        node("ret", "retriever", 220, 120, { label: "BM25 + vector, fused with RRF", recall: 0.72, topK: 20, latencyMs: 80 }),
        node("rr", "reranker", 450, 120, { label: "Cross-encoder rerank (top 20 to 5)", lift: 0.55, latencyMs: 220 }),
        node("llm", "llm", 680, 120, { label: "Answer with citations", tier: "medium", inTokens: 2200, outTokens: 250 }),
        node("out", "output", 910, 120, { label: "Answer + sources" }),
      ],
      edges: [edge("in", "ret"), edge("ret", "rr"), edge("rr", "llm"), edge("llm", "out")],
    },
  },
  {
    id: "corrective-rag",
    title: "Corrective RAG",
    scenario: "A bot that checks its own evidence: a grader judges the retrieved chunks, weak ones trigger a rewritten query and a second search, and a final check confirms the answer is grounded.",
    days: [10, 17],
    tryThis: [
      "Shift the router from 7/3 to 4/6 (poor first retrieval): more requests take the rewrite path. What does each retry cost in latency?",
      "Make the grader Medium instead of Small: better judgement, but a call on every single request.",
      "Remove the final grounding check: cheaper and faster, but 'correct' falls. How much?",
      "Raise the first retriever's recall to 0.92: the rewrite path is used less, and the grader earns less. When is the grader not worth it?",
    ],
    graph: {
      nodes: [
        node("in", "input", 0, 200, { label: "Question", knowledgeShare: 0.85 }),
        node("r1", "retriever", 200, 200, { label: "First search", recall: 0.7 }),
        node("gr", "llm", 420, 200, { label: "Grade the chunks (yes / no)", tier: "small", inTokens: 1800, outTokens: 30 }),
        node("rt", "router", 640, 200, { label: "Good enough?", latencyMs: 5 }),
        node("rw", "llm", 880, 380, { label: "Rewrite the query", tier: "small", inTokens: 400, outTokens: 60 }),
        node("r2", "retriever", 1100, 380, { label: "Second search", recall: 0.85 }),
        node("an", "llm", 1100, 200, { label: "Answer from the good chunks", tier: "medium", inTokens: 2200, outTokens: 250 }),
        node("ck", "critic", 1340, 200, { label: "Grounding check", tier: "small", reviseRate: 0.15 }),
        node("out", "output", 1560, 200, { label: "Answer or 'I do not know'" }),
      ],
      edges: [edge("in", "r1"), edge("r1", "gr"), edge("gr", "rt"), { ...edge("rt", "an"), weight: 7 }, { ...edge("rt", "rw"), weight: 3 }, edge("rw", "r2"), edge("r2", "an"), edge("an", "ck"), edge("ck", "out")],
    },
  },
  {
    id: "contextual-retrieval-ingest",
    title: "Contextual retrieval (ingest)",
    scenario: "The write side of a smarter index: every chunk gets a one-line context note from a small model (using prompt caching for the shared document), then is embedded and stored, so a bare 'Price: 79' knows which plan it belongs to.",
    days: [4, 13],
    rps: 4,
    tryThis: [
      "Compare with a plain ingest (remove the context model): ingestion is far cheaper, but retrieval later returns ambiguous chunks. This is a cost you pay once, at index time.",
      "Raise the context model's input tokens to 8,000 (whole document in the prompt): where does the cost jump? This is why the course caches the document.",
      "Cut workers from 6 to 2 at 8 req/s: how long before new documents become searchable?",
      "Make the context model Medium: is a better note worth the multiplier across every chunk?",
    ],
    graph: {
      nodes: [
        node("in", "input", 0, 150, { label: "Chunk to index" }),
        node("q", "queue", 210, 150, { label: "Indexing job queue", replicas: 6, serviceMs: 1500 }),
        node("cx", "llm", 440, 150, { label: "Write a one-line context note", tier: "small", inTokens: 2500, outTokens: 60 }),
        node("emb", "embedder", 680, 150, { label: "Embed context + chunk", latencyMs: 90 }),
        node("db", "database", 900, 150, { label: "Vector store + BM25 index", latencyMs: 50 }),
        node("out", "output", 1120, 150, { label: "Indexed" }),
      ],
      edges: [edge("in", "q"), edge("q", "cx"), edge("cx", "emb"), edge("emb", "db"), edge("db", "out")],
    },
  },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id);
