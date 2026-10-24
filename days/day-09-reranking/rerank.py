"""Day 09: rerank hybrid-search candidates with a cross-encoder and with an LLM."""

import sys
from pathlib import Path

from pydantic import BaseModel

from rag_common import FAST_MODEL, handbook_chunks, parse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "day-08-hybrid-search"))
from hybrid import HybridRetriever  # noqa: E402


class Grade(BaseModel):
    chunk_number: int
    relevance: int  # 0 = irrelevant ... 10 = directly answers the question


class Grades(BaseModel):
    grades: list[Grade]


def llm_rerank(query: str, texts: list[str], top_n: int = 3) -> list[tuple[int, int]]:
    """Return [(index, score)] best-first, graded by a fast Claude model in one call."""
    listing = "\n\n".join(f"<chunk number={i}>\n{t}\n</chunk>" for i, t in enumerate(texts))
    result = parse(
        f"{listing}\n\nQuestion: {query}\n\nGrade every chunk's relevance to the question from 0 to 10.",
        Grades,
        model=FAST_MODEL,
    )
    scored = sorted(((g.chunk_number, g.relevance) for g in result.grades), key=lambda x: -x[1])
    return scored[:top_n]


def cross_encoder_rerank(query: str, texts: list[str], top_n: int = 3):
    from sentence_transformers import CrossEncoder

    model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    scores = model.predict([(query, t) for t in texts])
    return sorted(enumerate(scores), key=lambda x: -x[1])[:top_n]


if __name__ == "__main__":
    chunks = handbook_chunks()
    by_id = {c.metadata["chunk_id"]: c for c in chunks}
    retriever = HybridRetriever(chunks)

    query = "If I stop paying for an annual subscription after a month, what money do I get back?"
    candidate_ids = retriever.search(query, k=10)
    texts = [by_id[i].text for i in candidate_ids]
    print(f"Query: {query}\n\nHybrid top-10: {candidate_ids}")

    try:
        ranked = cross_encoder_rerank(query, texts)
        print("\nCross-encoder top-3:", [(candidate_ids[i], round(float(s), 2)) for i, s in ranked])
    except ImportError:
        print("\n(cross-encoder skipped: pip install sentence-transformers)")

    ranked = llm_rerank(query, texts)
    print("LLM rerank top-3:   ", [(candidate_ids[i], s) for i, s in ranked if i < len(candidate_ids)])
