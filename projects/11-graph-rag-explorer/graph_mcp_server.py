"""Serve the knowledge graph over MCP."""

from graph_rag import entity_info, global_search, load, local_search
from mcp.server.mcpserver import MCPServer

graph = load()
mcp = MCPServer("graph-rag", instructions="Knowledge-graph search over the company documents.")


@mcp.tool()
def graph_local_search(question: str) -> str:
    """Answer a specific question by walking the graph around the entities it mentions (with citations)."""
    return local_search(graph, question)


@mcp.tool()
def graph_global_search(question: str) -> str:
    """Answer broad questions ('main themes', 'overall summary') by map-reducing over community summaries."""
    return global_search(graph, question)


@mcp.tool()
def entity_lookup(name: str) -> str:
    """An entity's type, source chunks and relations."""
    return entity_info(graph, name)


if __name__ == "__main__":
    mcp.run()
