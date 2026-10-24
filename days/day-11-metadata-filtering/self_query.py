"""Day 11: enrich chunks with a category, then let Claude choose filters for each question."""

from typing import Literal, Optional

from pydantic import BaseModel

from rag_common import FAST_MODEL, SimpleVectorStore, handbook_chunks, parse

CATEGORY_BY_TITLE = {
    "pricing": "billing",
    "refund_policy": "billing",
    "security": "security",
    "api_rate_limits": "engineering",
    "incident_runbook": "engineering",
    "onboarding": "hr",
    "product_faq": "product",
}
Category = Literal["billing", "security", "engineering", "hr", "product"]


class SearchPlan(BaseModel):
    query: str
    category: Optional[Category] = None


def plan(question: str) -> SearchPlan:
    return parse(
        "Turn the user's question into a search plan: a concise semantic `query`, and a `category` "
        "filter only if the question clearly belongs to one.\n"
        "Categories: billing (prices, refunds), security, engineering (API, incidents), hr (employees), "
        f"product (features, regions, support).\n\nQuestion: {question}",
        SearchPlan,
        model=FAST_MODEL,
    )


if __name__ == "__main__":
    chunks = handbook_chunks()
    for c in chunks:
        c.metadata["category"] = CATEGORY_BY_TITLE.get(c.metadata["title"], "product")
    store = SimpleVectorStore()
    store.add([c.text for c in chunks], [c.metadata for c in chunks])

    for question in [
        "How many vacation days do new employees get?",
        "How long do you keep backups?",
        "What happens when I send too many requests?",
    ]:
        p = plan(question)
        where = {"category": p.category} if p.category else None
        hits = store.search(p.query, k=3, where=where) or store.search(p.query, k=3)
        print(f"\nQ: {question}\n   plan: query={p.query!r} category={p.category}")
        print("   hits:", [h.metadata["chunk_id"] for h in hits])
