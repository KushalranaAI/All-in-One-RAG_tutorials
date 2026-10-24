"""Day 19: the smallest useful MCP server - one tool, one resource, one prompt."""

from datetime import date

from mcp.server.mcpserver import MCPServer

mcp = MCPServer("hello", instructions="A demo server for learning MCP.")


@mcp.tool()
def add(a: float, b: float) -> float:
    """Add two numbers and return the sum."""
    return a + b


@mcp.resource("info://today")
def today() -> str:
    """Today's date (a resource the app can attach as context)."""
    return f"Today is {date.today():%A, %d %B %Y}."


@mcp.prompt()
def explain(topic: str) -> str:
    """A reusable prompt template: explain a topic to a beginner."""
    return f"Explain {topic} to a beginner in five short bullet points, with one example."


if __name__ == "__main__":
    mcp.run()  # stdio transport: a host launches this file as a subprocess
