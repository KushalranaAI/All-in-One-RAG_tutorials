# Day 21 - MCP clients: connecting Claude to MCP servers

**Goal:** write the host side - your own app that connects Claude to one or many MCP servers.

## Option A: your own client (local or remote servers)
`rag_common/mcp_bridge.py` does four things:
1. **Connect** to each server (`mcp.Client` with stdio params, a URL, or an in-process object).
2. **List tools** and convert each to a Claude tool definition - MCP's `inputSchema` *is* a JSON
   schema, so the mapping is direct: `{"name", "description", "input_schema"}`.
3. **Namespace** them as `server__tool` so two servers can both have a `search` tool.
4. **Loop**: when Claude returns `tool_use`, route the call to the right server with `call_tool`, and
   send the text back as a `tool_result` (with `is_error` if the server reported an error).

```python
servers = [MCPServerSpec.python("handbook", "days/day-20-build-mcp-server/rag_mcp_server.py")]
answer = asyncio.run(run_mcp_agent("What is the refund policy?", servers))
```

The Anthropic SDK also ships helpers for this: `from anthropic.lib.tools.mcp import async_mcp_tool`
converts MCP tools for the SDK tool runner.

## Option B: let the API connect for you (remote servers only)
For servers reachable over HTTPS, the Messages API has a built-in **MCP connector** - no client code:
```python
client.beta.messages.create(
    model="claude-opus-5-5", max_tokens=16000,
    betas=["mcp-client-2025-11-20"],
    mcp_servers=[{"type": "url", "url": "https://example.com/mcp", "name": "docs"}],
    tools=[{"type": "mcp_toolset", "mcp_server_name": "docs"}],   # both halves are required
    messages=[{"role": "user", "content": "Search the docs for ..."}],
)
```
Anthropic's servers call the MCP server and run the tool loop inside one API request.

## Run it
```bash
python days/day-21-mcp-client/mcp_agent.py "What's the refund policy for annual plans, and how do I request one?"
python days/day-21-mcp-client/mcp_agent.py --multi "How much is Pro for a year, and what's 15% of that?"
```
`--multi` connects **two** servers at once - the handbook server from Day 20 and a calculator server
in this folder - and Claude picks tools from both.

## Exercises
1. Add a third server: the official filesystem server (`npx -y @modelcontextprotocol/server-filesystem <dir>`).
2. Run the Day 20 server with `--http` and connect with `MCPServerSpec(name="docs", url="http://localhost:8000/mcp")`.
3. Add a confirmation step before any tool whose name starts with `write_` or `delete_`.
