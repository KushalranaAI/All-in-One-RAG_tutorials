"""Connect Claude to one or more MCP servers (Day 21 explains this file).

Each MCP tool is exposed to Claude as `<server>__<tool>`; when Claude calls it we
forward the call to the right MCP server and send the result back.
"""

from __future__ import annotations

import asyncio
import json
import sys
from contextlib import AsyncExitStack
from dataclasses import dataclass, field
from typing import Any, Callable

from mcp import Client
from mcp.client.stdio import StdioServerParameters

from .llm import create, text_of


@dataclass
class MCPServerSpec:
    """How to reach a server: a local command (stdio), a URL (streamable HTTP) or an in-process object."""

    name: str
    command: str | None = None
    args: list[str] = field(default_factory=list)
    url: str | None = None
    server: Any = None  # an MCPServer instance, handy for tests

    @classmethod
    def python(cls, name: str, script: str, *args: str) -> "MCPServerSpec":
        """A server written in Python, launched with the current interpreter."""
        return cls(name=name, command=sys.executable, args=[script, *args])

    def target(self):
        if self.server is not None:
            return self.server
        if self.url:
            return self.url
        return StdioServerParameters(command=self.command, args=self.args)


def _result_text(result) -> str:
    parts = [getattr(c, "text", None) or json.dumps(c.model_dump(exclude_none=True)) for c in result.content]
    return "\n".join(parts) or json.dumps(result.structured_content or {})


class MCPToolbox:
    """Open connections to several MCP servers and present their tools to Claude."""

    def __init__(self, servers: list[MCPServerSpec]):
        self.servers = servers
        self.tools: list[dict] = []
        self._routes: dict[str, tuple[Client, str]] = {}
        self._stack = AsyncExitStack()

    async def __aenter__(self) -> "MCPToolbox":
        for spec in self.servers:
            client = await self._stack.enter_async_context(Client(spec.target()))
            for tool in (await client.list_tools()).tools:
                exposed = f"{spec.name}__{tool.name}"[:64]
                self._routes[exposed] = (client, tool.name)
                self.tools.append(
                    {"name": exposed, "description": tool.description or "", "input_schema": tool.input_schema}
                )
        return self

    async def __aexit__(self, *exc) -> None:
        await self._stack.aclose()

    async def call(self, exposed_name: str, arguments: dict) -> tuple[str, bool]:
        client, tool_name = self._routes[exposed_name]
        result = await client.call_tool(tool_name, arguments)
        return _result_text(result), bool(result.is_error)


async def run_mcp_agent(
    question: str | list[dict],
    servers: list[MCPServerSpec] | None = None,
    *,
    toolbox: MCPToolbox | None = None,
    allowed_tools: set[str] | None = None,
    system: str | None = None,
    local_tools: list[dict] | None = None,
    local_handlers: dict[str, Callable[..., Any]] | None = None,
    max_turns: int = 15,
    verbose: bool = True,
    **kwargs: Any,
) -> str:
    """Agent loop where tools come from MCP servers (plus optional local Python tools).

    Pass `servers` to open connections for this call, or an already-open `toolbox` to reuse
    connections across many calls. `allowed_tools` (exposed names like "docs__search_docs")
    limits what this agent may call - least privilege for multi-agent systems.
    """
    if toolbox is None:
        async with MCPToolbox(servers or []) as opened:
            return await run_mcp_agent(
                question, toolbox=opened, allowed_tools=allowed_tools, system=system, local_tools=local_tools,
                local_handlers=local_handlers, max_turns=max_turns, verbose=verbose, **kwargs,
            )

    messages = [{"role": "user", "content": question}] if isinstance(question, str) else list(question)
    local_handlers = local_handlers or {}
    mcp_tools = [t for t in toolbox.tools if allowed_tools is None or t["name"] in allowed_tools]
    tools = mcp_tools + (local_tools or [])
    permitted = {t["name"] for t in tools}
    for _ in range(max_turns):
        # The SDK call is blocking; run it in a thread so MCP connections stay responsive.
        response = await asyncio.to_thread(create, messages, system=system, tools=tools, **kwargs)
        messages.append({"role": "assistant", "content": response.content})
        if response.stop_reason == "pause_turn":
            continue
        if response.stop_reason != "tool_use":
            return text_of(response)

        results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            if verbose:
                print(f"  -> {block.name}({json.dumps(block.input)[:120]})")
            try:
                if block.name not in permitted:
                    raise PermissionError(f"tool {block.name} is not allowed for this agent")
                if block.name in local_handlers:
                    out = local_handlers[block.name](**block.input)
                    text, is_error = (out if isinstance(out, str) else json.dumps(out, default=str)), False
                else:
                    text, is_error = await toolbox.call(block.name, block.input)
            except Exception as exc:
                text, is_error = f"Error: {exc}", True
            result = {"type": "tool_result", "tool_use_id": block.id, "content": text}
            if is_error:
                result["is_error"] = True
            results.append(result)
        messages.append({"role": "user", "content": results})
    raise RuntimeError(f"Agent did not finish within {max_turns} turns")
