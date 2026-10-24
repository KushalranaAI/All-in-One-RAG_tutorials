"""Day 21: Claude + MCP servers via our own MCP client (rag_common.mcp_bridge)."""

import argparse
import asyncio
from pathlib import Path

from rag_common.mcp_bridge import MCPServerSpec, run_mcp_agent

DAYS = Path(__file__).resolve().parents[1]

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("question", nargs="*")
    parser.add_argument("--multi", action="store_true", help="also connect the calculator server")
    args = parser.parse_args()

    servers = [MCPServerSpec.python("handbook", str(DAYS / "day-20-build-mcp-server" / "rag_mcp_server.py"))]
    if args.multi:
        servers.append(MCPServerSpec.python("calc", str(DAYS / "day-21-mcp-client" / "calculator_server.py")))

    question = " ".join(args.question) or "What's the refund policy for annual plans, and how do I request one?"
    answer = asyncio.run(
        run_mcp_agent(question, servers, system="Use the available tools. Cite handbook chunk ids like [title#n].")
    )
    print("\n" + answer)
