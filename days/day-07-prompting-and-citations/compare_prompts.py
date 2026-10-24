"""Day 07: the same retrieved chunks with a naive prompt vs. an engineered RAG prompt."""

import re

from rag_common import RAG_SYSTEM, ask, build_handbook_index
from rag_common.prompts import rag_user_prompt

QUESTIONS = [
    "Can I get a refund on my annual plan after 45 days?",
    "Who founded Nimbus Cloud?",  # not in the documents
]


def naive_prompt(question: str, hits) -> str:
    context = "\n".join(h.text for h in hits)
    return f"{context}\n\n{question}"


def verify_citations(answer: str, n_sources: int) -> list[int]:
    """Return any cited source ids that don't exist."""
    cited = {int(x) for x in re.findall(r"\[(\d+)\]", answer)}
    return sorted(c for c in cited if not 1 <= c <= n_sources)


if __name__ == "__main__":
    store = build_handbook_index()
    for question in QUESTIONS:
        hits = store.search(question, k=4)
        print("=" * 70, f"\nQ: {question}")

        print("\n--- naive prompt ---")
        print(ask(naive_prompt(question, hits)))

        print("\n--- engineered prompt ---")
        answer = ask(rag_user_prompt(question, hits), system=RAG_SYSTEM)
        print(answer)
        bad = verify_citations(answer, len(hits))
        print(f"\ncitation check: {'OK' if not bad else f'invalid ids {bad}'}\n")
