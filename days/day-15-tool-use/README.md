# Day 15 - Tool use: letting Claude call your functions

**Goal:** understand the tool-use loop - the foundation of agents, agentic RAG and MCP.

## In everyday life

Think of a bank clerk behind a counter. A customer asks, "How much is in my old savings account?" The clerk cannot open the vault or the ledger from her seat. So she writes a request slip, "look up this account", and a runner brings back the figure. Then she tells the customer.

**Tool use** works the same way. A **tool** is a function in your own code, described to Claude by a name, a plain-language description and a **JSON schema** (a fixed format that says which inputs it takes). Claude never runs the function itself. It sends a **tool_use** block (a message that says "please run this tool with these inputs"). Your code runs the function and replies with a **tool_result** (the output, tagged with the same id so Claude knows which request it answers). Claude can ask again until it has enough, then gives the final answer.

Unlike the clerk, Claude knows a tool only through its description, so write each description carefully.

**Where you meet it.** A travel help assistant is asked whether a flight is delayed. The model has no live data and would have to guess. With a flight status tool, it asks your code for the status and answers from the real result.

```scene
title: The clerk and the request slip
step: 🙋 A customer asks the clerk about an old account balance | User question
step: 📋 The clerk cannot open the ledger, so she writes a request slip | tool_use block with name and input
step: 🏃 A runner takes the slip to the records room and looks it up | Your code runs the function
step: 📄 The runner returns the figure with the same slip number | tool_result with matching tool_use_id
step: 🔁 If the figure raises another question, she writes another slip | Loop while more tools are needed
step: 💬 With everything in hand, the clerk answers the customer | Final answer at end_turn
takeaway: Claude asks for the tool, your code runs it, and the result goes back to Claude.
```

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
