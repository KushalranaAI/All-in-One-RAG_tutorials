"""Day 20: an MCP server that exposes hybrid search over a folder of documents."""

import argparse
import sys
from pathlib import Path

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from rag_common import BM25, SimpleVectorStore, reciprocal_rank_fusion
from rag_common.chunking import chunk_by_headings
from rag_common.index import HANDBOOK_DIR
from rag_common.loaders import load_directory


class DocsIndex:
    def __init__(self, folder: Path):
        self.docs = {d.metadata["title"]: d for d in load_directory(folder)}
        self.chunks = []
        for title, doc in self.docs.items():
            for i, c in enumerate(chunk_by_headings(doc.text)):
                c.metadata.update(title=title, chunk_id=f"{title}#{i}")
                self.chunks.append(c)
        self.dense = SimpleVectorStore()
        self.dense.add([c.text for c in self.chunks], [c.metadata for c in self.chunks])
        self.bm25 = BM25([c.text for c in self.chunks])
        self.by_id = {c.metadata["chunk_id"]: c for c in self.chunks}
        print(f"indexed {len(self.docs)} docs / {len(self.chunks)} chunks", file=sys.stderr)  # stderr, not stdout!

    def search(self, query: str, k: int) -> list:
        dense = [h.metadata["chunk_id"] for h in self.dense.search(query, 20)]
        sparse = [self.chunks[i].metadata["chunk_id"] for i, _ in self.bm25.search(query, 20)]
        return [self.by_id[i] for i, _ in reciprocal_rank_fusion([dense, sparse])[:k]]


def build_server(folder: Path = HANDBOOK_DIR) -> MCPServer:
    index = DocsIndex(folder)
    mcp = MCPServer(
        "docs-rag",
        instructions="Search and read the user's document collection. Cite chunk ids like [title#3].",
    )

    @mcp.tool()
    def search_docs(query: str, k: int = 4) -> str:
        """Hybrid (keyword + semantic) search over the documents.

        Returns up to k passages, each prefixed with its chunk id for citation.
        """
        k = max(1, min(k, 10))
        return "\n\n".join(f"[{c.metadata['chunk_id']}]\n{c.text}" for c in index.search(query, k))

    @mcp.tool()
    def list_documents() -> str:
        """List every document title with its first line, so you know what can be searched or read."""
        return "\n".join(f"- {t}: {d.text.strip().splitlines()[0].lstrip('# ')}" for t, d in sorted(index.docs.items()))

    @mcp.tool()
    def get_document(title: str) -> str:
        """Return the full text of one document. Use a title from list_documents."""
        if title not in index.docs:
            raise ToolError(f"Unknown document {title!r}. Available: {', '.join(sorted(index.docs))}")
        return index.docs[title].text

    @mcp.resource("docs://{title}")
    def document_resource(title: str) -> str:
        """A document, as an attachable resource."""
        return index.docs[title].text

    @mcp.prompt()
    def answer_with_citations(question: str) -> str:
        """Ask a question that must be answered from the documents with citations."""
        return (
            f"Use the search_docs tool to research this question, then answer it citing chunk ids like "
            f"[title#n]. If the documents don't contain the answer, say so.\n\nQuestion: {question}"
        )

    return mcp


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--docs", type=Path, default=HANDBOOK_DIR, help="folder of .md/.txt/.pdf files")
    parser.add_argument("--http", action="store_true", help="serve streamable HTTP instead of stdio")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    server = build_server(args.docs)
    if args.http:
        server.run("streamable-http", port=args.port)
    else:
        server.run()
