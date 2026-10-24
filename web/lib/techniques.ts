// The technique map: "my RAG system does X wrong" → the technique that fixes it → the day that teaches it.
// Used by /map and the command palette. Days refer to the lesson numbers in days/.

export type Stage = "Ingest" | "Retrieve" | "Generate" | "Agents" | "Production";

export type Technique = {
  symptom: string;
  name: string;
  stage: Stage;
  days: number[];
  idea: string;
  cost: 1 | 2 | 3; // extra latency / spend: 1 = none or offline, 3 = several LLM calls per question
};

export const STAGES: Stage[] = ["Ingest", "Retrieve", "Generate", "Agents", "Production"];

export const TECHNIQUES: Technique[] = [
  { stage: "Ingest", symptom: "Garbage text from PDFs or web pages", name: "Loading and cleaning", days: [3], idea: "Extract per page, strip boilerplate, keep metadata (source, page, hash) on every document.", cost: 1 },
  { stage: "Ingest", symptom: "Chunks cut mid-sentence or split tables", name: "Chunking strategies", days: [4], idea: "Recursive or heading-aware splits on natural boundaries, with overlap where it helps.", cost: 1 },
  { stage: "Ingest", symptom: "Chunks lose their meaning out of context (“it”, “this plan”)", name: "Contextual retrieval", days: [13], idea: "Have Claude write a one-line context for each chunk before embedding; prompt caching keeps it cheap.", cost: 2 },
  { stage: "Ingest", symptom: "Answers live in charts, scans or images", name: "Multimodal RAG", days: [25], idea: "Caption images then embed the captions, or send the PDF to Claude natively.", cost: 2 },
  { stage: "Retrieve", symptom: "Paraphrased questions find nothing", name: "Semantic embeddings", days: [2, 5], idea: "Embed with a real sentence model so “money back” lands near “refund”.", cost: 1 },
  { stage: "Retrieve", symptom: "Misses exact terms: error codes, SKUs, names", name: "Hybrid search (BM25 + vectors + RRF)", days: [8], idea: "Run keyword and vector search and fuse the ranks with Reciprocal Rank Fusion.", cost: 1 },
  { stage: "Retrieve", symptom: "The right chunk is retrieved but ranked too low", name: "Reranking", days: [9], idea: "Fetch 20-50 candidates cheaply, then reorder them with a cross-encoder or an LLM.", cost: 2 },
  { stage: "Retrieve", symptom: "Questions are vague, short or several questions in one", name: "Query transformation", days: [10], idea: "Multi-query, HyDE and decomposition, fused with RRF.", cost: 2 },
  { stage: "Retrieve", symptom: "Results from the wrong product, date or customer", name: "Metadata filtering / self-query", days: [11], idea: "Filter on structured fields; let the LLM write the filter from the question.", cost: 2 },
  { stage: "Retrieve", symptom: "Chunks too small to answer from, or too big to match", name: "Parent-document (small-to-big)", days: [12], idea: "Search small chunks for precision, hand the model their larger parent for context.", cost: 1 },
  { stage: "Retrieve", symptom: "Questions about relationships or the big picture across documents", name: "Graph RAG", days: [18], idea: "Extract entities and relations into a graph; answer with local or community-level search.", cost: 3 },
  { stage: "Retrieve", symptom: "The answer is in a database, not in text", name: "Text-to-SQL agent", days: [26], idea: "Give an agent the schema and a read-only SQL tool, alongside document search.", cost: 2 },
  { stage: "Generate", symptom: "Answers invent facts and can't be checked", name: "Grounded prompts and citations", days: [7], idea: "Numbered sources, “cite or say I don't know” rules, or Claude's citations API.", cost: 1 },
  { stage: "Generate", symptom: "Confident answers when the docs don't say", name: "Corrective RAG / self-checking", days: [17], idea: "Grade the retrieved chunks, rewrite and retry, then check the answer is grounded.", cost: 3 },
  { stage: "Generate", symptom: "Follow-up questions lose the conversation", name: "Conversational memory", days: [24], idea: "Rewrite follow-ups into standalone questions; keep long-term facts about the user.", cost: 2 },
  { stage: "Agents", symptom: "One search isn't enough to answer", name: "Agentic RAG", days: [15, 16], idea: "Make retrieval a tool and let Claude search as many times as it needs.", cost: 3 },
  { stage: "Agents", symptom: "Claude Desktop or Claude Code should use your knowledge base", name: "MCP server", days: [19, 20], idea: "Expose search as MCP tools and resources any MCP host can call.", cost: 1 },
  { stage: "Agents", symptom: "The agent needs tools from several systems", name: "MCP client / tool bridge", days: [21], idea: "Connect to several MCP servers and route Claude's tool calls to the right one.", cost: 2 },
  { stage: "Agents", symptom: "Questions span domains, or one agent has too many tools", name: "Multi-agent: router + specialists", days: [22, 23], idea: "Route to focused agents with few tools each, run them in parallel, synthesise, critique.", cost: 3 },
  { stage: "Production", symptom: "You can't tell whether a change helped", name: "Evaluation", days: [14], idea: "A fixed eval set with hit@k and MRR for retrieval, LLM-as-judge for answers. Run it on every change.", cost: 1 },
  { stage: "Production", symptom: "Too slow or too expensive", name: "Caching and model routing", days: [13, 28], idea: "Semantic cache, prompt caching, a fast model for cheap steps, tracked cost per request.", cost: 1 },
  { stage: "Production", symptom: "Leaks private data, or follows instructions hidden in documents", name: "Guardrails and security", days: [29], idea: "PII redaction, tenant isolation at retrieval time, prompt-injection screening, traces.", cost: 2 },
  { stage: "Production", symptom: "Users need an API with streaming answers", name: "Serving with FastAPI + SSE", days: [27], idea: "JSON and server-sent-event endpoints around the pipeline.", cost: 1 },
  { stage: "Production", symptom: "The index goes stale when documents change", name: "Incremental indexing and deployment", days: [30], idea: "Hash documents, re-index only what changed, handle deletions, deploy with Docker Compose.", cost: 1 },
];

/** Where do things go wrong? A decision chart that points at the technique groups above. */
export const DIAGNOSE = `flowchart TD
  S([Bad answer]) --> R{Is the right text in the retrieved chunks?}
  R -->|no| F{Is it in the index at all?}
  F -->|no or mangled| I[Ingest: loading, chunking, contextual retrieval]
  F -->|yes| K{What kind of miss?}
  K -->|exact term| H[Hybrid search · Day 08]
  K -->|ranked too low| RR[Reranking · Day 09]
  K -->|vague question| QT[Query transformation · Day 10]
  K -->|wrong scope| MF[Metadata filters · Day 11]
  R -->|yes| G{Did the model use it?}
  G -->|invented things| C[Citations · Day 07 · Corrective RAG · Day 17]
  G -->|needed more lookups| A[Agentic RAG · Day 16]
  G -->|yes, still unsure| E[Measure it: evaluation · Day 14]`;
