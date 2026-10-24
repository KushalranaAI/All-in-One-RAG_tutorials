# Day 30 - Deployment, monitoring and the capstone

**Goal:** ship it. Package the API and the MCP server, keep the index fresh, and know what to monitor.

## What you deploy
```
            ┌──────────── docker compose ────────────┐
users ────► │ api (FastAPI, Day 27)        :8000     │──► Anthropic API
MCP hosts ─►│ mcp (docs server, Day 20)    :8001/mcp │
            │ volume: ./data  (documents + index)    │
            └────────────────────────────────────────┘
```
Files in this folder:
- `Dockerfile` - one image for both services.
- `docker-compose.yml` - runs the API and the MCP server over streamable HTTP.
- `refresh_index.py` - **incremental** re-indexing: only re-embeds documents whose hash changed.

```bash
cp .env.example .env    # add ANTHROPIC_API_KEY
docker compose -f days/day-30-deployment/docker-compose.yml up --build
python days/day-30-deployment/refresh_index.py           # run on a schedule (cron / CI)
```

## Production checklist
**Quality**
- [ ] Eval set of 50+ real questions; run it in CI on every prompt/retriever change (Day 14)
- [ ] Grounding check or citations shown to users (Day 07, 17)
- [ ] "I don't know" path tested with unanswerable questions

**Data**
- [ ] Incremental indexing with document hashes; deletions handled
- [ ] Metadata: source, updated_at, tenant/ACL on every chunk (Day 11, 29)
- [ ] PII policy applied before indexing

**Ops**
- [ ] Secrets from the environment / a secret manager, never in the image
- [ ] Traces per request (retrieval ids, tokens, latency), dashboards, alerts on error rate and p95 latency
- [ ] Retries with backoff (the SDK retries 429/5xx by default) and timeouts
- [ ] Cost per day tracked; caching and routing in place (Day 28)

**Security**
- [ ] Auth on the API and MCP server (OAuth for remote MCP)
- [ ] Tenant filters at retrieval time, read-only tools, approval for writes
- [ ] Prompt-injection scanning on ingested content

## Capstone
Build **Project 15 - the enterprise multi-agent RAG platform** in `projects/15-enterprise-rag-platform`.
It combines hybrid retrieval, MCP servers, a router, specialist agents, a critic, memory and an API.

## What next?
Pick three projects from `projects/`, adapt them to your own data, and measure them with the Day 14
harness. That's how you go from "I followed a tutorial" to "I build RAG systems".
