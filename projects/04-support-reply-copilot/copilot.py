"""Draft grounded support replies with triage, reranking and escalation rules."""

import json
import sys
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from rag_common import (
    FAST_MODEL,
    INDEX_DIR,
    HybridIndex,
    handbook_chunks,
    parse,
    reciprocal_rank_fusion,
)

ESCALATIONS = INDEX_DIR / "escalations.jsonl"
INDEX = HybridIndex(handbook_chunks())


class Triage(BaseModel):
    intent: Literal["billing", "refund", "technical", "outage", "account", "sales", "other"]
    urgency: Literal["low", "medium", "high"]
    sentiment: Literal["positive", "neutral", "frustrated", "angry"]
    search_queries: list[str] = Field(description="2-4 queries to find the relevant help-center passages")


class Relevance(BaseModel):
    ranked_chunk_ids: list[str] = Field(description="most relevant first; omit irrelevant chunks")


class Draft(BaseModel):
    reply: str
    cited_chunk_ids: list[str]
    confidence: float = Field(description="0-1: how sure you are the reply is correct and complete")
    needs_human: bool
    reason: str


def retrieve(triage: Triage, email: str, k: int = 4):
    rankings = [[c.metadata["chunk_id"] for c in INDEX.search(q, k=8)] for q in triage.search_queries]
    candidates = [INDEX.by_id[i] for i, _ in reciprocal_rank_fusion(rankings)[:10]]
    listing = "\n\n".join(f"<chunk id='{c.metadata['chunk_id']}'>\n{c.text}\n</chunk>" for c in candidates)
    ranked = parse(f"{listing}\n\nCustomer email:\n{email}\n\nRank the chunks that help answer it.", Relevance, model=FAST_MODEL)
    return [INDEX.by_id[i] for i in ranked.ranked_chunk_ids if i in INDEX.by_id][:k]


def draft_reply(email: str) -> tuple[Triage, Draft]:
    triage = parse(f"Triage this customer email:\n\n{email}", Triage, model=FAST_MODEL)
    chunks = retrieve(triage, email)
    context = "\n\n".join(f"<chunk id='{c.metadata['chunk_id']}'>\n{c.text}\n</chunk>" for c in chunks)
    draft = parse(
        f"<help_center>\n{context}\n</help_center>\n<email>\n{email}\n</email>\n\n"
        "Write a warm, concise reply that answers every question using only the help center. "
        "Never promise anything the policy doesn't allow. Set needs_human if the request is outside policy, "
        "needs account access, or the customer asks for a person.",
        Draft,
        system="You are a senior customer support agent for Nimbus Cloud.",
    )
    return triage, draft


def must_escalate(triage: Triage, draft: Draft) -> list[str]:
    reasons = []
    if draft.needs_human:
        reasons.append(f"model: {draft.reason}")
    if draft.confidence < 0.7:
        reasons.append(f"low confidence ({draft.confidence:.2f})")
    if triage.sentiment == "angry" or (triage.intent == "outage" and triage.urgency == "high"):
        reasons.append("angry customer / urgent outage")
    return reasons


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "samples/refund.txt"
    if arg == "-":
        email = sys.stdin.read()
    else:
        path = Path(arg) if Path(arg).exists() else Path(__file__).parent / arg  # allow samples/... from anywhere
        email = path.read_text()
    triage, draft = draft_reply(email)
    print(f"TRIAGE: {triage.model_dump()}\n")
    print(f"DRAFT (confidence {draft.confidence:.2f}, sources {draft.cited_chunk_ids}):\n\n{draft.reply}\n")
    if reasons := must_escalate(triage, draft):
        ESCALATIONS.parent.mkdir(exist_ok=True)
        with ESCALATIONS.open("a") as f:
            f.write(json.dumps({"email": email, "triage": triage.model_dump(), "draft": draft.model_dump(), "reasons": reasons}) + "\n")
        print("⚠ ESCALATED TO HUMAN:", "; ".join(reasons))
