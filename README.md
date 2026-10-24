# All-in-One RAG Tutorials

**Learn Retrieval-Augmented Generation (RAG) in 30 days, from your first embedding to multi-agent systems built on MCP, then build 15 portfolio projects.**

Every day has a short lesson (`README.md`) and runnable Python code. Every project is a complete
application you can adapt to your own data. Everything uses the [Claude API](https://platform.claude.com/docs)
and the official [Model Context Protocol](https://modelcontextprotocol.io) Python SDK.

```
Week 1  Foundations         embeddings → loading → chunking → vector DBs → first RAG → prompting
Week 2  Advanced retrieval  hybrid search → reranking → query rewriting → filters → small-to-big → contextual → evaluation
Week 3  Agents & MCP        tool use → agentic RAG → corrective RAG → Graph RAG → MCP servers & clients
Week 4  Multi-agent & prod  multi-agent patterns → research teams → memory → multimodal → SQL → APIs → cost → security → deploy
Then    15 projects         chatbots, MCP servers, analyst agents, agent teams, an enterprise platform
```

---

## Quick start

```bash
git clone https://github.com/KushalranaAI/all-in-one-RAG_tutorials.git
cd all-in-one-RAG_tutorials
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install -e .                                      # installs the shared `rag_common` package
cp .env.example .env                                  # then add your ANTHROPIC_API_KEY
python data/make_sample_db.py                         # sample SQLite DB used from Day 26 on

python days/day-01-what-is-rag/hello_claude.py        # your first RAG call
```

- **Python 3.10+.** Get an API key at [platform.claude.com](https://platform.claude.com).
- `sentence-transformers` gives real semantic embeddings. Without it, the code falls back to a small
  dependency-free hashing embedder, so everything still runs (set `RAG_EMBEDDER=hashing` to force it).
- Models: `claude-opus-5-5` for answers and orchestration, `claude-haiku-5-5` for fast, cheap steps
  (rewriting, grading, extraction). Override them with `RAG_MODEL` / `RAG_FAST_MODEL`.

---

## 30-day curriculum

### Week 1 - Foundations
| Day | Topic | You build |
|-----|-------|-----------|
| [01](days/day-01-what-is-rag) | What is RAG and why it exists | the same question with no context, wrong context, and the right context |
| [02](days/day-02-embeddings) | Embeddings and semantic similarity | a similarity matrix and a mini semantic search |
| [03](days/day-03-document-loading) | Loading Markdown, PDFs and web pages | loaders with cleaning, metadata and hashes |
| [04](days/day-04-chunking) | Chunking strategies | fixed, recursive and heading-aware chunkers, compared |
| [05](days/day-05-vector-databases) | Vector databases (numpy, Chroma, HNSW) | a vector store from scratch, plus the same index in Chroma |
| [06](days/day-06-first-rag-pipeline) | Your first end-to-end RAG pipeline | a Q&A CLI over the sample handbook |
| [07](days/day-07-prompting-and-citations) | Prompting for RAG and built-in citations | grounded prompts, citation checks, Claude's citations API |

### Week 2 - Advanced retrieval
| Day | Topic | You build |
|-----|-------|-----------|
| [08](days/day-08-hybrid-search) | Hybrid search: BM25 + vectors + RRF | a hybrid retriever |
| [09](days/day-09-reranking) | Reranking (cross-encoders, LLM rerankers) | two-stage retrieval |
| [10](days/day-10-query-transformation) | Multi-query, HyDE, decomposition | query rewriters with RRF fusion |
| [11](days/day-11-metadata-filtering) | Metadata filters and self-querying | an LLM that writes its own search filters |
| [12](days/day-12-parent-document-retrieval) | Parent-document / small-to-big retrieval | search small chunks, answer with big ones |
| [13](days/day-13-contextual-retrieval) | Contextual retrieval and prompt caching | LLM-contextualised chunks, measured |
| [14](days/day-14-evaluation) | Evaluation: hit@k, MRR, LLM-as-judge | an eval harness for every later change |

### Week 3 - Agents and MCP
| Day | Topic | You build |
|-----|-------|-----------|
| [15](days/day-15-tool-use) | Tool use: the agent loop | a manual loop and the SDK tool runner |
| [16](days/day-16-agentic-rag) | Agentic RAG: retrieval as a tool | an agent that searches as often as it needs |
| [17](days/day-17-corrective-rag) | Corrective RAG and self-checking | grade → rewrite → retry → groundedness check |
| [18](days/day-18-graph-rag) | Graph RAG | a knowledge graph extracted by Claude |
| [19](days/day-19-mcp-fundamentals) | MCP fundamentals: tools, resources, prompts | your first MCP server, inspected by a client |
| [20](days/day-20-build-mcp-server) | Build an MCP server for your knowledge base | a docs-search MCP server for Claude Desktop / Code |
| [21](days/day-21-mcp-client) | MCP clients: connect Claude to many servers | an agent using tools from two MCP servers |

### Week 4 - Multi-agent systems and production
| Day | Topic | You build |
|-----|-------|-----------|
| [22](days/day-22-multi-agent-patterns) | Multi-agent patterns | router + parallel specialists + synthesiser |
| [23](days/day-23-multi-agent-research) | Orchestrator-workers research system | lead agent, parallel workers, critic loop |
| [24](days/day-24-memory-conversational-rag) | Memory and conversational RAG | follow-up rewriting + long-term user memory |
| [25](days/day-25-multimodal-rag) | Multimodal RAG: PDFs, images, charts | caption-then-embed + native PDF Q&A |
| [26](days/day-26-structured-data-sql) | Structured data: text-to-SQL agents | a read-only SQL + docs agent |
| [27](days/day-27-serving-api) | Serving with FastAPI and streaming | JSON + SSE endpoints and a tiny chat UI |
| [28](days/day-28-cost-latency) | Cost and latency optimisation | semantic cache, model routing, cost tracking |
| [29](days/day-29-guardrails-security) | Guardrails, security, observability | PII redaction, tenant isolation, injection defence, traces |
| [30](days/day-30-deployment) | Deployment and capstone | Docker Compose, incremental indexing, production checklist |

---

## 15 projects

| # | Project | Level | Key ideas | MCP | Multi-agent |
|---|---------|-------|-----------|:---:|:-----------:|
| 01 | [Document Chat Assistant](projects/01-document-chat-assistant) | ★ | Streamlit, uploads, streaming, citations | | |
| 02 | [Website Docs Chatbot](projects/02-website-docs-chatbot) | ★ | crawler, persistent index, URL citations | | |
| 03 | [Codebase Q&A Agent](projects/03-codebase-qa-agent) | ★★ | AST chunking, code search agent | ✅ | |
| 04 | [Support Reply Copilot](projects/04-support-reply-copilot) | ★★ | triage, rerank, structured replies, escalation | | |
| 05 | [Research Paper Assistant](projects/05-research-paper-assistant) | ★★ | arXiv API, paper library, full-PDF reading | ✅ | |
| 06 | [Personal Knowledge MCP Server](projects/06-personal-knowledge-mcp) | ★★ | notes search/create, resources, prompts | ✅ | |
| 07 | [Data Analyst Agent](projects/07-data-analyst-agent) | ★★ | SQL + docs over two MCP servers, reports | ✅ | |
| 08 | [Meeting Intelligence](projects/08-meeting-intelligence) | ★★ | parallel extraction, digests, Q&A across meetings | | ✅ |
| 09 | [Multi-Agent Research Team](projects/09-multi-agent-research-team) | ★★★ | planner, researchers, web search, writer, critic | | ✅ |
| 10 | [Contract Review Agents](projects/10-contract-review-agents) | ★★★ | clause extraction, playbook RAG, parallel reviewers | | ✅ |
| 11 | [Graph RAG Explorer](projects/11-graph-rag-explorer) | ★★★ | entity resolution, communities, local/global search | ✅ | |
| 12 | [Invoice Intelligence](projects/12-invoice-intelligence) | ★★ | vision/PDF extraction → SQLite → SQL agent | ✅ | |
| 13 | [Support Agent Team](projects/13-support-agent-team-mcp) | ★★★ | router, least-privilege MCP tools, QA, human handoff | ✅ | ✅ |
| 14 | [RAG Evaluation Lab](projects/14-rag-evaluation-lab) | ★★ | synthetic test sets, grid search, leaderboard | | |
| 15 | [Enterprise RAG Platform (capstone)](projects/15-enterprise-rag-platform) | ★★★★ | API + MCP in/out, agents, RBAC, memory, guardrails, tracing | ✅ | ✅ |

Shared, production-style MCP servers live in [`mcp_servers/`](mcp_servers): `docs_server` (hybrid
search), `sql_server` (read-only SQL) and `tickets_server` (ticketing). Add them to Claude Code with
`claude mcp add nimbus-docs -- python $PWD/mcp_servers/docs_server.py`.

---

## Repository layout

```
rag_common/        shared library you build in Week 1 (LLM wrapper, embeddings, chunking, vector store,
                   BM25 + hybrid search, agents, MCP bridge)
data/              sample "Nimbus Cloud" handbook, eval set, sample DB generator
days/day-XX-*/     30 lessons: README.md (the explanation) + runnable scripts
projects/NN-*/     15 projects: README.md (architecture, run, extend) + code
mcp_servers/       reusable MCP servers (docs, sql, tickets)
tests/             offline tests: real MCP servers, scripted fake LLM, no API key needed
```

## How to use this course
1. **Read the lesson, run the code, do one exercise.** Each day takes 1-2 hours.
2. **Change one thing at a time** and measure it with Day 14's evaluator.
3. **Swap in your own documents.** Most scripts take `--docs path/to/folder`, or use `rag_common.load_directory`.
4. **After Day 30**, build 3-5 projects on your own data. That's your portfolio.

## Tests
```bash
pip install pytest
RAG_EMBEDDER=hashing pytest -q
```
The tests start every MCP server over real stdio and run every lesson and project script with a
scripted stand-in for Claude, so they need no API key. They check that the plumbing works, not answer
quality (use Day 14 / Project 14 with a real key for that).

## License
MIT. See [LICENSE](LICENSE).
