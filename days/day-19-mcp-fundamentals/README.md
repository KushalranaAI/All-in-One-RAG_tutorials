# Day 19 - MCP fundamentals: the Model Context Protocol

**Goal:** understand what MCP is, why it exists, and its three building blocks.

## The problem MCP solves
Every AI app used to write custom glue for every data source: a Slack connector for app A, another for
app B... **N apps × M tools = N×M integrations**. MCP is an open standard - "USB-C for AI tools" - so a
tool written once as an **MCP server** works in every **MCP host** (Claude Desktop, Claude Code, IDEs,
your own agents).

## Architecture
```
┌────────────── Host (Claude Desktop / Claude Code / your app) ──────────────┐
│   LLM  ◄──►  MCP client ─────┐   MCP client ───────┐                       │
└──────────────────────────────│─────────────────────│───────────────────────┘
                     stdio or HTTP            stdio or HTTP
                               ▼                     ▼
                      MCP server: handbook    MCP server: database
                      (tools, resources,      (tools: run_sql, ...)
                       prompts)
```
- **Host**: the application the user talks to.
- **Client**: one connection per server, inside the host.
- **Server**: a small program exposing capabilities. Messages are JSON-RPC 2.0.

## The three primitives
| Primitive | Controlled by | Example | RAG use |
|-----------|---------------|---------|---------|
| **Tools** | the model (it decides to call them) | `search_docs(query)` | retrieval as a tool (agentic RAG) |
| **Resources** | the application/user (attached as context) | `handbook://pricing` | expose documents to read |
| **Prompts** | the user (picked from a menu, like slash commands) | `answer_with_citations` | reusable RAG prompt templates |

## Transports
- **stdio** - the host launches the server as a subprocess. Simple, local, the default.
- **Streamable HTTP** - the server runs as a web service; many clients, remote, supports auth (OAuth).

## Run it
```bash
python days/day-19-mcp-fundamentals/inspect_server.py
```
This connects an MCP client **in-process** to the tiny server in `hello_server.py` and prints its
tools, resources and prompts, then calls a tool and reads a resource. You can also open the server in
the official inspector: `npx @modelcontextprotocol/inspector python days/day-19-mcp-fundamentals/hello_server.py`.

> This course uses the official Python SDK, `mcp` v2 (`from mcp.server.mcpserver import MCPServer`).
> In v1 the same class was called `FastMCP` - older tutorials online use that name.

## Exercises
1. Add a tool `word_count(text)` and a resource `notes://today`.
2. Add a prompt that takes a `topic` argument and returns a two-message conversation.
3. Read the JSON-RPC messages: run the server with the inspector and watch the traffic.
