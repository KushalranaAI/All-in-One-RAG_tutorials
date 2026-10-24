# Project 09 - Multi-Agent Research Team (internal docs + live web)

**Level:** advanced · **Uses:** Days 16, 22, 23 · **Stack:** planner → parallel researchers → writer → critic → editor

A team of agents that produces a sourced research report, combining your **internal knowledge base** with
the **live web** (Claude's server-side `web_search` tool - no search API key needed).

```
          ┌─ Planner (Opus, structured) ─ research plan: sections + questions + which source
question ─┤
          ├─ Researchers ×N in parallel (Haiku): internal search tool + web_search
          │      each returns findings with citations [doc#id] or (url)
          ├─ Writer (Opus): report.md from findings only
          └─ Critic (Opus, structured) ─ score + issues ──► Editor revises (≤ 2 rounds)
```

| Role | Model | Tools | Output |
|------|-------|-------|--------|
| Planner | Opus | - | `Plan{sections[{title, questions[], sources}]}` |
| Researcher | Haiku | `search_internal`, `web_search` (server tool) | cited findings |
| Writer | Opus | - | Markdown report |
| Critic | Opus | - | `Review{score, issues[]}` |

## Run
```bash
python projects/09-multi-agent-research-team/team.py "Should Nimbus Cloud launch a GPU hosting plan? Compare with the market."
python projects/09-multi-agent-research-team/team.py --no-web "Summarise our security posture for a customer questionnaire."
```
The report is written to `projects/09-multi-agent-research-team/report.md`.

## Notes
- `web_search` runs on Anthropic's side: results arrive inside the same response, with citations. The
  agent loop only executes *client* tools (`tool_use` blocks) - server tool blocks need no handling.
- Web search must be enabled for your organisation in the Claude Console and is billed per search.
- Each researcher gets one self-contained brief; they never see each other's context.

## Extend it
- Add a "fact checker" agent that re-verifies every number in the final report.
- Stream progress to a web UI (Day 27).
- Persist findings so follow-up questions reuse them.
