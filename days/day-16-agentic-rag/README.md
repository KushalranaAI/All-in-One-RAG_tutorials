# Day 16 - Agentic RAG: retrieval as a tool

**Goal:** let Claude decide *when*, *what* and *how often* to search, instead of always retrieving once.

## Classic RAG vs. agentic RAG
| | Classic (Day 06) | Agentic |
|-|------------------|---------|
| Retrieval | always, once, with the raw question | zero or more times, with queries Claude writes |
| Multi-hop questions | often fail | search → read → search again |
| Small talk | wastes a retrieval | answers directly |
| Cost / latency | predictable, low | higher, variable |

## The tools
- `list_documents()` - what's available (gives the agent a map).
- `search_handbook(query, category?)` - hybrid search over chunks.
- `read_document(title)` - fetch a whole document when snippets aren't enough.

The system prompt tells the agent to search before answering, cite chunk ids, and stop when it has
enough evidence.

## Run it
```bash
python days/day-16-agentic-rag/agent.py "Compare backup retention and support response times between Pro and Enterprise."
```
Watch the `-> tool(...)` lines: the agent will usually search several times with different queries.

## When to use which
- **Classic RAG**: FAQ bots, high volume, latency-sensitive, single-hop questions.
- **Agentic RAG**: research questions, comparisons, multi-hop, multiple data sources (Day 21+).
- Hybrid: classic first; escalate to the agent when the grader (Day 17) says the context is insufficient.

## Exercises
1. Add `max_searches`: after 5 searches, the tool returns "search budget exhausted, answer now".
2. Give the agent a second knowledge source (e.g. a `search_web` stub) and see how it chooses.
3. Log each run's number of tool calls and tokens; compare with Day 06 on the eval set.
