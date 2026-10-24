"""Day 17: corrective RAG - grade retrieval, rewrite the query if needed, then self-check the answer."""

import sys

from pydantic import BaseModel

from rag_common import FAST_MODEL, RAG_SYSTEM, ask, build_handbook_index, parse
from rag_common.prompts import format_context, rag_user_prompt


class ChunkGrades(BaseModel):
    relevant_ids: list[int]  # source ids that help answer the question
    missing: str             # what information is still missing ("" if none)


class Rewrite(BaseModel):
    query: str


class Groundedness(BaseModel):
    unsupported_claims: list[str]
    grounded: bool


def grade(question: str, hits) -> ChunkGrades:
    return parse(
        f"<sources>\n{format_context(hits)}\n</sources>\nQuestion: {question}\n\n"
        "Which source ids contain information that helps answer the question? What is missing?",
        ChunkGrades,
        model=FAST_MODEL,
    )


def rewrite(question: str, missing: str) -> str:
    return parse(
        f"A search for this question did not find: {missing}\nQuestion: {question}\n"
        "Write a better search query using formal, document-style vocabulary.",
        Rewrite,
        model=FAST_MODEL,
    ).query


def check(answer: str, hits) -> Groundedness:
    return parse(
        f"<sources>\n{format_context(hits)}\n</sources>\n<answer>{answer}</answer>\n\n"
        "List any claims in the answer that the sources do not support. grounded = no such claims.",
        Groundedness,
        model=FAST_MODEL,
    )


def corrective_rag(store, question: str, max_attempts: int = 3) -> str:
    query, relevant = question, []
    for attempt in range(1, max_attempts + 1):
        hits = store.search(query, k=4)
        grades = grade(question, hits)
        relevant = [hits[i - 1] for i in grades.relevant_ids if 1 <= i <= len(hits)]
        print(f"[attempt {attempt}] query={query!r} -> {len(relevant)}/{len(hits)} relevant")
        if relevant and not grades.missing:
            break
        query = rewrite(question, grades.missing or "relevant passages")

    if not relevant:
        return "I couldn't find this in the handbook."

    answer = ask(rag_user_prompt(question, relevant), system=RAG_SYSTEM)
    verdict = check(answer, relevant)
    print(f"[self-check] grounded={verdict.grounded} unsupported={verdict.unsupported_claims}")
    if not verdict.grounded:
        strict = RAG_SYSTEM + "\nRemove anything not explicitly stated in the sources: " + "; ".join(verdict.unsupported_claims)
        answer = ask(rag_user_prompt(question, relevant), system=strict)
    return answer


if __name__ == "__main__":
    q = " ".join(sys.argv[1:]) or "my bill went wrong, can I get cash back for the yearly plan?"
    print("\n" + corrective_rag(build_handbook_index(), q))
