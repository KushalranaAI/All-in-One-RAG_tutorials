# Day 16 - Agentic RAG: retrieval as a tool

**Goal:** let Claude decide *when*, *what* and *how often* to search, instead of always retrieving once.

## In everyday life

You want to compare two broadband plans before buying. You do not type one search and decide. You glance at the website menu to see what pages exist, search for one plan's cancellation fee, and open the full terms when a snippet is unclear. Then you search again for the other plan. You stop when you have both numbers.

**Agentic RAG** lets Claude work this way. In classic RAG, the system always searches once with your raw question. In agentic RAG, **retrieval is a tool** (a function Claude may choose to call), so Claude decides whether to search, which words to use and how often. A question that needs two facts from different pages is **multi-hop** (the answer takes more than one lookup, each guided by the last). Small talk like "thanks" needs no search at all.

The price is extra cost and waiting, because every search is another round trip. Unlike you, the agent has no feeling for when to give up, so set a limit on searches.

**Where you meet it.** A company handbook assistant is asked to compare backup retention and support times between two plans. One search finds only half the facts. The agent searches for each plan separately, opens a full document if needed, and answers with sources.

```scene
title: Comparing two broadband plans
step: ❓ You want two facts about two plans, which one page cannot give | Multi-hop question
step: 🧭 You look at the site menu to see which pages exist | list_documents tool
step: 🔍 You search for one plan's cancellation fee in your own words | search_handbook with a query Claude writes
step: 📖 A snippet is unclear, so you open the full terms page | read_document tool
step: 🔁 You search again for the second plan using new words | Another search, different query
step: 🛑 With both numbers in hand, you stop and write the comparison | Answer with cited chunk ids
takeaway: Let the model decide when and what to search, and cap how many times.
```

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
