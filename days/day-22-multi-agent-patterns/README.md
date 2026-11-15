# Day 22 - Multi-agent patterns

**Goal:** know the handful of patterns behind every "multi-agent system", and when *not* to use one.

## In everyday life

Walk into a hospital with two problems: chest pain and a doubt about a medicine. The front-desk nurse does not treat you herself. She decides which specialists you need and sends you on. They see you at the same time, each using only their own department's files. One doctor then writes a single summary for you. If you only had a cough, she would send you straight to one doctor, with no team at all.

**Multi-agent patterns** are team shapes like this for AI. An **agent** is a model that can use tools and decide its next step. **Routing** means a first step picks the right specialist. **Parallelisation** means several workers run at once and a final step merges the results. There are other shapes, such as a writer and critic in a loop, but all of them cost more and are harder to debug than one agent. So start with one agent and add a team only when it clearly fails.

Unlike a hospital, these specialists are the same kind of model, given different instructions and different documents.

**Where you meet it.** A company help bot is asked, "I'm on Pro: how long are backups kept, and can I get a refund after three weeks?" A billing specialist and a security specialist each search only their own documents, and one answer merges both. Splitting also keeps each agent's context small and limits who can see what.

```scene
title: The hospital front desk
step: 🙋 A patient arrives with two problems, one about the heart and one about a medicine | A question touching two topics
step: 🧑 The front-desk nurse decides which specialists are needed | Router picks specialists
step: 🩺 Two specialists see the patient at the same time in separate rooms | Specialists run in parallel
step: 📂 Each one opens only the files of their own department | Search restricted to own documents
step: 📝 One doctor merges both notes into a single summary | Synthesiser writes the cited answer
takeaway: Route to specialists, run them in parallel, merge the results, and keep it simple.
```

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
