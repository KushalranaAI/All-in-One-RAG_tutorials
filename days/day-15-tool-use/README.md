# Day 15 - Tool use: letting Claude call your functions

**Goal:** understand the tool-use loop - the foundation of agents, agentic RAG and MCP.

## How tool use works
1. You describe tools with a **name**, **description** and **JSON schema** for the input.
2. Claude decides whether to call one. If so, the response has `stop_reason == "tool_use"` and a
   `tool_use` block: `{"id": "toolu_...", "name": "search_docs", "input": {"query": "refunds"}}`.
3. **You** run the function and send back a `tool_result` block with the same `tool_use_id`.
4. Repeat until Claude answers with `stop_reason == "end_turn"`.

```
user ─► Claude ──tool_use──► your code runs search_docs() ──tool_result──► Claude ──► final answer
                 ▲                                                            │
                 └──────────────── may call more tools ◄──────────────────────┘
```

## Writing good tools
- **Descriptions are prompts.** Say what the tool does, when to use it, what it returns, its limits.
- Keep inputs small and typed; use `enum` for fixed choices.
- Return concise, readable text (or compact JSON) - every result costs context tokens.
- On failure, return `is_error: true` with a helpful message; Claude will often recover.
- Claude may call **several tools in parallel** in one turn - run them all and return **all** results
  in **one** user message.

## Three ways to run the loop
| Way | When |
|-----|------|
| Manual loop (`manual_loop.py`) | learning, full control |
| `rag_common.run_tool_loop` | the same loop as a reusable function (used in later days) |
| SDK **tool runner** - `client.beta.messages.tool_runner(tools=[...])` with `@beta_tool` functions | production code; the SDK runs the loop |

## Run it
```bash
python days/day-15-tool-use/manual_loop.py
python days/day-15-tool-use/tool_runner.py
```

## Exercises
1. Add a `get_plan_price(plan: enum)` tool backed by a Python dict. Ask "What's 3 Pro seats for a year?"
2. Make a tool raise an exception and watch Claude react to the `is_error` result.
3. Print every message in the history to see exactly what goes over the wire.
