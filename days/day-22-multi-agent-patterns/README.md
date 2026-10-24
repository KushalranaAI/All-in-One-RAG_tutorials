# Day 22 - Multi-agent patterns

**Goal:** know the handful of patterns behind every "multi-agent system", and when *not* to use one.

## Start simple
Anthropic's guidance from building agents: the most successful systems use **simple, composable
patterns**, not heavy frameworks. Add agents only when one agent with good tools demonstrably fails -
multi-agent systems cost more tokens and are harder to debug.

## The patterns
| Pattern | Shape | Use for |
|---------|-------|---------|
| **Prompt chaining** | A → B → C, fixed order | outline → draft → polish |
| **Routing** | classifier → one specialist | support triage, cheap vs. expensive model |
| **Parallelisation** | fan-out to N workers → aggregate | search several sources at once; voting |
| **Orchestrator-workers** | lead agent plans, delegates sub-tasks dynamically, synthesises | open-ended research (Day 23) |
| **Evaluator-optimizer** | generator ↔ critic loop until it passes | writing, code, answers with a quality bar |
| **Agent-as-tool** | an agent exposed as a tool of another agent | hierarchical teams |

```
ROUTING                PARALLEL                    ORCHESTRATOR-WORKERS
q ─► router ─► A       q ─┬─► A ─┐                 q ─► lead ─┬─► worker(sub-q 1) ─┐
            └► B          ├─► B ─┼─► aggregate          ▲     ├─► worker(sub-q 2) ─┤
                          └─► C ─┘                      └─────┴──── results ◄──────┘
```

## Multi-agent RAG specifically
- **Specialists per corpus**: billing agent sees only billing docs, security agent only security docs -
  smaller, cleaner context per agent and natural access control.
- **Parallel retrieval** over many sources cuts latency.
- **Critic** agents check grounding (Day 17) as a separate role.

## Run it
```bash
python days/day-22-multi-agent-patterns/router_and_specialists.py "I'm on Pro: how long are backups kept and can I get a refund if I leave after 3 weeks?"
```
1. A **router** (Claude Haiku, structured output) picks which specialists are needed.
2. The chosen **specialists** run **in parallel**, each with a search tool restricted to its documents.
3. A **synthesiser** merges their findings into one cited answer.

## Exercises
1. Add an `hr` specialist for the onboarding guide.
2. Add an evaluator-optimizer loop: a critic grades the final answer; if it fails, the synthesiser retries with the critique.
3. Compare cost and quality against the single agent of Day 16 on the eval set.
