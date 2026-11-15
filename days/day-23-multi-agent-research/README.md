# Day 23 - A multi-agent research system (orchestrator-workers + critic)

**Goal:** build the pattern behind "deep research" products: a lead agent that plans, delegates
research to sub-agents in parallel, writes a report, and revises it after critique.

## In everyday life

Think of a newspaper editor handed a big question, such as "Which of these two options should a small firm choose?" She does not read everything herself. She splits the question into smaller ones and sends a reporter on each, all at once. Each reporter returns short notes with sources. The editor writes a first draft from those notes only. A reviewer then marks claims with no source and parts that are missing, and the editor fixes them before publishing.

That is the **orchestrator-workers** pattern. The **lead agent** (the orchestrator) plans and writes. The **workers** are sub-agents that each search, read and summarise one sub-question. A separate **critic** (a second model call that checks the draft) is better at spotting gaps than the writer is at checking its own work. Caps on rounds and tool calls keep the cost under control.

Unlike a newsroom, the reporters here are cheaper, faster models, because reading is the bulk of the work.

**Where you meet it.** A startup asks for a briefing on which of two plans to buy. One search would give a thin answer. The team splits it into topics such as price, support and security, researches them in parallel, and returns a cited report that a critic has already checked.

```scene
title: The newsroom with a reviewer
step: 📰 An editor gets a big question and splits it into smaller ones | Lead plans sub-questions
step: 🏃 She sends a reporter on each small question, all at once | Workers run in parallel
step: 🔎 Each reporter searches and reads, then returns short sourced notes | Condensed findings with citations
step: ✍️ The editor writes the first draft from the notes only | Lead writes the draft
step: 🧐 A separate reviewer marks missing sources and gaps | Critic checks the draft
step: 🔁 The editor fixes the marks, at most twice, then publishes | Revise, capped at 2 rounds
takeaway: Plan, delegate in parallel, write from condensed notes, and let a critic check the draft.
```

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
