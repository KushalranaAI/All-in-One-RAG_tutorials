# Project 15 - Enterprise Multi-Agent RAG Platform (capstone)

**Level:** capstone · **Uses:** everything · **Stack:** FastAPI, MCP (in *and* out), router + specialist agents, critic, memory, guardrails, RBAC, tracing, semantic cache

A company assistant that employees and customers can use from a web API **or from any MCP host**. It
combines everything from the 30 days:

```
                         ┌──────────────────────── enterprise_rag ────────────────────────┐
HTTP  /chat ────────┐    │ guardrails ─► memory ─► cache ─► router (RBAC-filtered)        │
MCP   ask_company ──┴──► │                                    │                           │
                         │          ┌─────────────────────────┼──────────────────────┐    │
                         │          ▼                         ▼                      ▼    │
                         │    docs agent              data agent              support agent│
                         │  [docs__search_docs,     [sql__get_schema,       [tickets__find_customer,
                         │   docs__get_document]     sql__run_sql]           tickets__list_tickets, ...]
                         │          └───────────── run in parallel ───────────────┘      │
                         │                       synthesiser ─► critic (grounded?) ─► answer
                         │                       trace (JSONL) for every step            │
                         └──────────────┬────────────────┬─────────────────┬─────────────┘
                                 MCP: docs_server   MCP: sql_server   MCP: tickets_server
```

## Features → lessons
| Feature | Where | Day |
|---------|-------|-----|
| Hybrid retrieval, citations | `mcp_servers/docs_server.py` | 07, 08 |
| MCP servers + shared client pool | `MCPToolbox` opened once at startup | 20, 21 |
| Router + parallel specialists + synthesiser | `orchestrator.py` | 22, 23 |
| Least-privilege tools per agent, RBAC per user role | `AGENTS`, `ROLE_AGENTS` | 22, 29 |
| Grounding critic with one revision | `orchestrator.py` | 17 |
| Conversation memory + query condensation | `memory.py` | 24 |
| PII redaction, prompt-injection screening | `guardrails.py` | 29 |
| Semantic cache | `orchestrator.py` | 28 |
| Request tracing | `tracing.py` → `.rag_index/platform_traces.jsonl` | 29 |
| HTTP API | `api.py` | 27 |
| The platform itself as an MCP server | `mcp_server.py` | 20 |

## Run
```bash
python data/make_sample_db.py
pip install fastapi uvicorn

# CLI
python projects/15-enterprise-rag-platform/cli.py --role employee "Which Enterprise customers opened SEV1 tickets, and what response time does their plan guarantee?"
python projects/15-enterprise-rag-platform/cli.py --role customer "How do refunds work on annual plans?"

# HTTP API
uvicorn enterprise_rag.api:app --app-dir projects/15-enterprise-rag-platform --port 8000
curl -s localhost:8000/chat -H 'content-type: application/json' \
  -d '{"session_id":"s1","role":"employee","message":"How many Pro customers do we have per region?"}'
curl -s localhost:8000/traces/<request_id>

# As an MCP server (e.g. in Claude Desktop / Claude Code)
claude mcp add company -- python $PWD/projects/15-enterprise-rag-platform/mcp_server.py
```

## Offline tests
`tests/test_capstone.py` runs the whole orchestrator against the real MCP servers with a scripted LLM
(no API key needed): routing, RBAC, parallel agents, critic and tracing.

## Ideas to take it further
- Auth (OAuth/JWT) mapping users to roles and tenants; tenant filters in every MCP server.
- Persist memory and traces in Postgres; dashboards on latency, cost and critic failure rate.
- Nightly evaluation (Project 14) with alerts on regressions.
- Add a web-research agent with the `web_search` server tool (Project 09).
