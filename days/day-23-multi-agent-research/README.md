# Day 23 - A multi-agent research system (orchestrator-workers + critic)

**Goal:** build the pattern behind "deep research" products: a lead agent that plans, delegates
research to sub-agents in parallel, writes a report, and revises it after critique.

## Architecture
```
                 ┌──────────── Lead researcher (Claude Opus) ────────────┐
question ──────► │ 1. plan sub-questions                                 │
                 │ 2. delegate_research(sub-q) ×N  ──► workers (Haiku)   │──► draft
                 │    each worker: search → read → summarise w/ sources  │
                 └───────────────────────────────────────────────────────┘
draft ──► Critic (checks every claim has a citation, finds gaps) ──► revise (max 2 rounds) ──► report
```

## Why this works
- **Separation of concerns** - workers have small, focused contexts; the lead never reads raw chunks,
  only condensed findings.
- **Parallelism** - Claude can emit several `delegate_research` calls in one turn; we run them
  concurrently.
- **Cheaper workers** - research is reading-heavy; a fast model is enough. The lead does the reasoning.
- **Evaluator-optimizer** - a separate critic is more reliable at spotting gaps than self-review.

## Lessons from production multi-agent research systems
- Tell the lead **how much effort** to spend: 1 worker for a simple fact, 3-5 for comparisons.
- Give workers **complete, self-contained tasks** (objective, output format, which sources to use).
- Workers return **condensed findings with citations**, not raw search dumps.
- Cap rounds and tool calls; log everything - debugging needs traces.

## Run it
```bash
python days/day-23-multi-agent-research/research_team.py "Write a briefing for a startup deciding between the Pro and Enterprise plans."
```

## Exercises
1. Add a `web_search` server tool (`{"type": "web_search_20260209", "name": "web_search"}`) to the
   workers so they can compare Nimbus with public information.
2. Make the critic return structured output (`passed: bool, issues: list[str]`) - it already does; add
   a `score` and stop when it's ≥ 8.
3. Stream progress events to a UI (Day 27).
