# Day 20 - Build an MCP server for your knowledge base

**Goal:** package your RAG retriever as an MCP server, so *any* MCP host - Claude Desktop, Claude Code,
your own agents - can search your documents.

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
