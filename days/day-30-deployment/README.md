# Day 30 - Deployment, monitoring and the capstone

**Goal:** ship it. Package the API and the MCP server, keep the index fresh, and know what to monitor.

## In everyday life

A tiffin service starts in your kitchen. The dal tastes right on your own stove, but running a canteen means the same dish must come out right on a different stove, for hundreds of people, every day, with nobody watching you cook. That gap is **deployment** (moving a working project onto a server where real users can reach it, and keeping it running).

Three habits close the gap. First, **Docker** (a way to pack your app and everything it needs into one sealed box, called a **container**, that runs the same on any machine). Second, freshness: the menu changes, so you re-index only the documents that changed, spotted by comparing a **hash** (a short fingerprint of a file that changes whenever the file changes). Third, **monitoring** (watching numbers like errors, wait times and daily spend, with alerts), so you hear about problems before customers do.

Unlike a canteen, a RAG system can give wrong answers while everything looks fine. That is why the checklist also includes a fixed set of test questions.

**Where you meet it.** A team ships its internal policy bot. Without packaging and monitoring, it works on one laptop, goes stale when policies change, and nobody notices it started failing last Tuesday. With a container, a nightly refresh and alerts, it stays current and fails loudly instead of quietly.

```scene
title: From home kitchen to running canteen
step: 🍱 The recipe is packed so it cooks the same on any stove | Docker image and container
step: 🔑 The cash locker key stays with the manager, not on the menu | Secrets from the environment
step: 🪟 One counter serves customers, a second serves partner shops | API and MCP server in compose
step: 🌙 Each night only dishes with changed recipes get recooked | Incremental re-indexing by hash
step: 📈 A board shows complaints, wait times and daily spend | Traces, dashboards and alerts
step: 🧪 Before any menu change, a fixed taste test runs | Eval set run in CI
takeaway: Shipping is not the finish line, because a live system needs refreshing, watching and testing.
```

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
