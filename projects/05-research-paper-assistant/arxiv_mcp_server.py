"""MCP server exposing the paper library to any MCP host."""

from arxiv_tools import PaperLibrary
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

library = PaperLibrary()
mcp = MCPServer("arxiv", instructions="Search arXiv, build a library, and read papers. Cite as [arXiv:ID].")


@mcp.tool()
def search_arxiv(query: str, max_results: int = 8) -> str:
    """Search arXiv and add the results to the local library."""
    return library.search_arxiv(query, max_results)


@mcp.tool()
def search_library(question: str, k: int = 5) -> str:
    """Hybrid search over the abstracts of every paper collected so far."""
    return library.search_library(question, k)


@mcp.tool()
def paper_details(arxiv_id: str) -> str:
    """Title, authors, date, abstract and PDF link of a paper in the library."""
    try:
        return library.paper_details(arxiv_id)
    except KeyError as exc:
        raise ToolError(str(exc)) from exc


@mcp.tool()
def read_paper(arxiv_id: str, question: str) -> str:
    """Read the full PDF of a paper and answer a question about it (slower; use for the most relevant papers)."""
    try:
        return library.read_paper(arxiv_id, question)
    except KeyError as exc:
        raise ToolError(str(exc)) from exc


if __name__ == "__main__":
    mcp.run()
