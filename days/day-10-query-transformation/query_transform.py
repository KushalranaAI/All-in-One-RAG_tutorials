"""Day 10: multi-query, HyDE and decomposition before retrieval."""

from pydantic import BaseModel

from rag_common import (
    FAST_MODEL,
    ask,
    build_handbook_index,
    parse,
    reciprocal_rank_fusion,
)


class Queries(BaseModel):
    queries: list[str]


def multi_query(question: str, n: int = 3) -> list[str]:
    out = parse(
        f"Write {n} different search queries that would find documents answering this question. "
        f"Vary the wording and vocabulary.\n\nQuestion: {question}",
        Queries,
        model=FAST_MODEL,
    )
    return [question, *out.queries[:n]]


def hyde(question: str) -> str:
    return ask(
        f"Write a short passage (3-4 sentences) from a company help-center article that answers: {question}\n"
        "Invent plausible details; it is only used for search.",
        model=FAST_MODEL,
        effort="low",
    )


def decompose(question: str) -> list[str]:
    out = parse(
        f"Split this question into the minimal list of standalone sub-questions needed to answer it. "
        f"If it is already simple, return it unchanged as the only item.\n\nQuestion: {question}",
        Queries,
        model=FAST_MODEL,
    )
    return out.queries


def fused_search(store, queries: list[str], k: int = 4) -> list[str]:
    rankings = [[h.metadata["chunk_id"] for h in store.search(q, k=10)] for q in queries]
    return [doc_id for doc_id, _ in reciprocal_rank_fusion(rankings)[:k]]


if __name__ == "__main__":
    store = build_handbook_index()
    question = "Is the Pro plan worth it for a student team that needs long backups and fast API access?"
    print(f"Question: {question}\n")

    print("Plain retrieval :", [h.metadata["chunk_id"] for h in store.search(question, 4)])

    queries = multi_query(question)
    print("\nMulti-query     :", *queries, sep="\n  - ")
    print("  ->", fused_search(store, queries))

    passage = hyde(question)
    print(f"\nHyDE passage    : {passage[:150]}...")
    print("  ->", [h.metadata["chunk_id"] for h in store.search(passage, 4)])

    subs = decompose(question)
    print("\nDecomposition   :", *subs, sep="\n  - ")
    print("  ->", fused_search(store, subs, k=6))
