"""MCP server: hybrid search over a folder of documents."""

import argparse
import sys
from pathlib import Path

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from rag_common import HybridIndex
from rag_common.chunking import chunk_by_headings
from rag_common.index import HANDBOOK_DIR
from rag_common.loaders import load_directory


def build_server(folder: Path = HANDBOOK_DIR, name: str = "docs") -> MCPServer:
    docs = {d.metadata["title"]: d for d in load_directory(folder)}
    chunks = []
    for title, doc in docs.items():
        for i, c in enumerate(chunk_by_headings(doc.text)):
            c.metadata.update(title=title, source=doc.metadata["source"], chunk_id=f"{title}#{i}")
            chunks.append(c)
    index = HybridIndex(chunks)
    print(f"[{name}] indexed {len(docs)} documents, {len(chunks)} chunks", file=sys.stderr)

    mcp = MCPServer(name, instructions="Search and read documents. Cite chunk ids like [title#3].")

    @mcp.tool()
    def search_docs(query: str, k: int = 4, title: str | None = None) -> str:
        """Hybrid keyword+semantic search. Optionally restrict to one document `title`.

        Returns up to k passages, each prefixed with its chunk id.
        """
        return index.search_text(query, k=max(1, min(k, 10)), where={"title": title} if title else None)

    @mcp.tool()
    def list_documents() -> str:
        """List all document titles with their first heading."""
        return "\n".join(f"- {t}: {d.text.strip().splitlines()[0].lstrip('# ')}" for t, d in sorted(docs.items()))

    @mcp.tool()
    def get_document(title: str) -> str:
        """Return the full text of one document (title from list_documents)."""
        if title not in docs:
            raise ToolError(f"Unknown document {title!r}. Available: {', '.join(sorted(docs))}")
        return docs[title].text

    @mcp.resource("docs://{title}")
    def document(title: str) -> str:
        """A document as an attachable resource."""
        return docs[title].text

    return mcp


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--docs", type=Path, default=HANDBOOK_DIR)
    parser.add_argument("--name", default="docs")
    parser.add_argument("--http", action="store_true")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    server = build_server(args.docs, args.name)
    server.run("streamable-http", port=args.port) if args.http else server.run()
