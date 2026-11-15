# Day 20 - Build an MCP server for your knowledge base

**Goal:** package your RAG retriever as an MCP server, so *any* MCP host - Claude Desktop, Claude Code,
your own agents - can search your documents.

## In everyday life

An apartment society office keeps its rules, bills and notices in one cupboard. Residents keep asking the secretary the same things. So she opens a counter window with a printed list: search the rules, list all documents, hand over one full file. Anyone from any building uses the counter the same way, and she does not explain it again each time.

An **MCP server** (a small program that offers abilities to AI apps in a standard way) does this for your documents. You already built a retriever. Here you wrap it, so any **MCP host** (an app such as Claude Desktop or Claude Code) can call it. The server lists its **tools** (actions the model can run), **resources** (documents that can be attached) and **prompts** (ready-made templates).

Two habits matter. A local server talks to the host through **stdio** (the program's plain text output channel), so printing debug notes there breaks the conversation. Log somewhere else. And anything that changes or deletes data should have a clear name and a confirmation step.

**Where you meet it.** An engineering team keeps its runbooks in one folder, and every assistant app needs its own search code for it. Once the folder is wrapped as an MCP server, Claude Desktop, Claude Code and the team's own agent all search it the same way, and fixes happen in one place.

```scene
title: The help counter of the society office
step: 🗄️ A society office keeps rules, bills and notices in one cupboard | Your documents and index
step: 🪟 The office opens a counter with a printed list of what you may ask | Server lists its tools, resources, prompts
step: 🙋 A resident from any building asks it to search the rules for parking | A host calls search_docs
step: 📑 The clerk hands back short extracts with page numbers | Passages returned with ids
step: 🏢 Residents of other buildings use the very same counter | Any MCP host can connect
step: 🔒 Giving out keys or removing files needs a clear label and a check | Confirm tools that change things
takeaway: Wrap your retriever once as an MCP server and every host can search your documents.
```

## What the server exposes
| Type | Name | Purpose |
|------|------|---------|
| tool | `search_docs(query, k=4, category?)` | hybrid search; returns passages with ids |
| tool | `list_documents()` | titles + one-line descriptions |
| tool | `get_document(title)` | full text of one document |
| resource | `docs://{title}` | each document as an attachable resource |
| prompt | `answer_with_citations(question)` | a ready-made RAG prompt template |

The index is built once at startup. Point it at any folder with `--docs path/to/folder`.

## Run / test it
```bash
python days/day-20-build-mcp-server/test_server.py                 # in-process smoke test
npx @modelcontextprotocol/inspector python days/day-20-build-mcp-server/rag_mcp_server.py
```

## Use it from Claude Code
```bash
claude mcp add handbook -- python /absolute/path/days/day-20-build-mcp-server/rag_mcp_server.py
# then in Claude Code: "search the handbook for the refund policy"
```

## Use it from Claude Desktop
Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):
```json
{
  "mcpServers": {
    "handbook": {
      "command": "python",
      "args": ["/absolute/path/days/day-20-build-mcp-server/rag_mcp_server.py",
               "--docs", "/absolute/path/to/your/docs"]
    }
  }
}
```

## Serve it over HTTP (remote, many users)
```bash
python days/day-20-build-mcp-server/rag_mcp_server.py --http --port 8000   # http://localhost:8000/mcp
```
For production add authentication (the SDK supports OAuth token verification) and per-user filters.

## Server design tips
- **Never print to stdout** in a stdio server - stdout carries the protocol. Log to stderr.
- Keep tool outputs short; include ids so the model can cite them.
- Raise `ToolError("helpful message")` for expected failures - the model sees the message as an
  `is_error` result. Any other exception is treated as a crash and its text stays on the server.
- Tools that change things (write, delete) deserve explicit names and confirmation in the host.

## Exercises
1. Add `add_document(title, text)` that indexes new text at runtime.
2. Add a `category` enum argument to `search_docs` (reuse Day 11's mapping).
3. Expose `eval_set.json` as a resource and write a prompt that runs a mini evaluation.
