# Day 19 - MCP fundamentals: the Model Context Protocol

**Goal:** understand what MCP is, why it exists, and its three building blocks.

## In everyday life

Imagine every shop in your street had to set up a separate arrangement with every bank before it could take a digital payment. Nobody would bother. A shared payment standard, like UPI, removes that work. Any app talks to any bank in the same agreed way.

AI apps faced the same mess. Each app wrote custom code for each data source, so five apps and ten sources meant fifty pieces of glue. The **Model Context Protocol (MCP)** is one shared standard for this. You write a connector once, and every compatible app can use it. The app you chat with is the **host**. Inside it, a **client** keeps one connection per **server**, which is a small program that offers abilities. A server can offer **tools** (actions the model chooses to run), **resources** (documents attached as context) and **prompts** (ready-made templates the user picks).

Unlike a payment standard, MCP moves questions and facts, not money, and each server decides what it allows.

**Where you meet it.** A company wants its assistant apps to read the internal wiki and query a sales database. Without a standard, every app needs its own wiki code and its own database code. With MCP, the wiki and the database each become one server, and any host app can plug into both.

```scene
title: One standard instead of many setups
step: 🏪 Every shop needs its own setup with every payment app and bank | N times M custom integrations
step: 📜 One shared rulebook is agreed that every app and bank follows | Model Context Protocol
step: 📱 You open your payment app, where you do everything | Host
step: 🔌 Inside it, one open line is kept to each bank | MCP client, one per server
step: 🏦 Each bank answers in the agreed format and lists what it can do | Server exposes tools, resources, prompts
step: ✅ A new bank joins and every app works with it at once | Write once, works in every host
takeaway: MCP turns many custom connections into one standard that every host and server speaks.
```

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
