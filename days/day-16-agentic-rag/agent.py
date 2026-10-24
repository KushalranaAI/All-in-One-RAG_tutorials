"""Day 16: an agent that searches the handbook as many times as it needs."""

import sys

from rag_common import (
    BM25,
    SimpleVectorStore,
    handbook_chunks,
    reciprocal_rank_fusion,
    run_tool_loop,
)
from rag_common.index import HANDBOOK_DIR

CHUNKS = handbook_chunks()
BY_ID = {c.metadata["chunk_id"]: c for c in CHUNKS}
DENSE = SimpleVectorStore()
DENSE.add([c.text for c in CHUNKS], [c.metadata for c in CHUNKS])
SPARSE = BM25([c.text for c in CHUNKS])

SYSTEM = """You are a research assistant for the Nimbus Cloud handbook.
- Always search before answering factual questions; search again with different words if results are weak.
- For comparisons, search for each side separately.
- Cite chunk ids like [pricing#2]. If the handbook doesn't contain the answer, say so."""

TOOLS = [
    {"name": "list_documents", "description": "List the titles of all handbook documents.",
     "input_schema": {"type": "object", "properties": {}}},
    {"name": "search_handbook", "description": "Hybrid keyword+semantic search. Returns up to 4 passages with ids.",
     "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}},
    {"name": "read_document", "description": "Return the full text of one document by title (from list_documents).",
     "input_schema": {"type": "object", "properties": {"title": {"type": "string"}}, "required": ["title"]}},
]


def list_documents() -> str:
    return ", ".join(sorted(p.stem for p in HANDBOOK_DIR.glob("*.md")))


def search_handbook(query: str) -> str:
    dense = [h.metadata["chunk_id"] for h in DENSE.search(query, 10)]
    sparse = [CHUNKS[i].metadata["chunk_id"] for i, _ in SPARSE.search(query, 10)]
    ids = [doc_id for doc_id, _ in reciprocal_rank_fusion([dense, sparse])[:4]]
    return "\n\n".join(f"[{i}]\n{BY_ID[i].text}" for i in ids)


def read_document(title: str) -> str:
    path = HANDBOOK_DIR / f"{title}.md"
    if not path.exists():
        raise FileNotFoundError(f"No document {title!r}. Available: {list_documents()}")
    return path.read_text()


if __name__ == "__main__":
    question = " ".join(sys.argv[1:]) or "Compare backup retention and support response times between Pro and Enterprise."
    answer, history = run_tool_loop(
        [{"role": "user", "content": question}],
        TOOLS,
        {"list_documents": list_documents, "search_handbook": search_handbook, "read_document": read_document},
        system=SYSTEM,
    )
    print(f"\n{answer}\n\n({sum(1 for m in history if m['role'] == 'assistant')} model turns)")
