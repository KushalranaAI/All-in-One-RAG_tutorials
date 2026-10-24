"""Day 21: a second tiny MCP server, to show Claude using tools from several servers at once."""

import math

from mcp.server.mcpserver import MCPServer

mcp = MCPServer("calculator")


@mcp.tool()
def calculate(expression: str) -> str:
    """Evaluate a math expression, e.g. '790 * 0.85' or 'sqrt(2) * pi'."""
    allowed = {name: getattr(math, name) for name in ("sqrt", "pi", "e", "log", "ceil", "floor")}
    return str(eval(expression, {"__builtins__": {}}, allowed))


if __name__ == "__main__":
    mcp.run()
