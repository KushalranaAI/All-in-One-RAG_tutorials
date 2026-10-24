"""Serve the code index over MCP so any MCP host (Claude Code, Claude Desktop) can search your repo."""

import argparse
import sys

from code_index import CodeIndex
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

parser = argparse.ArgumentParser()
parser.add_argument("--repo", default=".")
args = parser.parse_args()

code = CodeIndex(args.repo)
print(f"indexed {len(code.files)} files", file=sys.stderr)
mcp = MCPServer("code-search", instructions=f"Search and read the repository at {code.repo}.")


@mcp.tool()
def search_code(query: str, k: int = 6) -> str:
    """Hybrid search over functions, classes and file windows. Returns code with path:line headers."""
    return code.search_code(query, k)


@mcp.tool()
def read_file(path: str, start: int = 1, end: int = 200) -> str:
    """Read lines start..end (1-based) of a repository file."""
    try:
        return code.read_file(path, start, end)
    except ValueError as exc:
        raise ToolError(str(exc)) from exc


@mcp.tool()
def list_files(pattern: str = "*") -> str:
    """List repository files matching a glob pattern."""
    return code.list_files(pattern)


if __name__ == "__main__":
    mcp.run()
