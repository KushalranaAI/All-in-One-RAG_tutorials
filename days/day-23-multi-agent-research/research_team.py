"""Day 23: lead researcher delegates to parallel worker agents, then a critic reviews the report."""

import sys
from concurrent.futures import ThreadPoolExecutor

from pydantic import BaseModel

from rag_common import (
    FAST_MODEL,
    MODEL,
    Agent,
    HybridIndex,
    create,
    handbook_chunks,
    parse,
    text_of,
    tool,
)
from rag_common.index import HANDBOOK_DIR

INDEX = HybridIndex(handbook_chunks())


def make_worker() -> Agent:
    return Agent(
        name="worker",
        system="You are a research worker. Use the tools to research the task thoroughly, then return a concise "
        "list of findings. Every finding must cite chunk ids like [pricing#2]. Note anything you couldn't find.",
        tools=[
            tool("search", "Hybrid search over the company handbook.", {"query": {"type": "string"}}),
            tool("read_document", "Read a full handbook document by title.", {"title": {"type": "string"}}),
        ],
        handlers={
            "search": lambda query: INDEX.search_text(query, k=4),
            "read_document": lambda title: (HANDBOOK_DIR / f"{title}.md").read_text(),
        },
        model=FAST_MODEL,
        effort="low",
    )


LEAD_SYSTEM = f"""You are the lead researcher. Documents available: {', '.join(p.stem for p in HANDBOOK_DIR.glob('*.md'))}.
1. Break the question into focused sub-questions (1 for a simple fact, 3-5 for comparisons).
2. Call delegate_research once per sub-question - call them in parallel in a single turn.
3. Write the final report from the findings only. Keep the citations. Use headings and a short recommendation."""

DELEGATE = tool(
    "delegate_research",
    "Give a research worker one self-contained sub-question. Returns cited findings.",
    {"task": {"type": "string", "description": "Objective, what to look for, and the desired output format"}},
)


class Review(BaseModel):
    passed: bool
    issues: list[str]  # missing citations, unsupported claims, unanswered parts


def lead_research(question: str) -> str:
    messages = [{"role": "user", "content": question}]
    while True:
        response = create(messages, system=LEAD_SYSTEM, tools=[DELEGATE], model=MODEL, effort="high")
        messages.append({"role": "assistant", "content": response.content})
        calls = [b for b in response.content if b.type == "tool_use"]
        if response.stop_reason != "tool_use":
            return text_of(response)
        print(f"lead delegates {len(calls)} tasks in parallel:")
        for c in calls:
            print("  •", c.input["task"][:100])
        with ThreadPoolExecutor() as pool:  # run all delegated tasks concurrently
            findings = list(pool.map(lambda c: make_worker().run(c.input["task"]), calls))
        messages.append({"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": c.id, "content": f} for c, f in zip(calls, findings)
        ]})


def critique(question: str, report: str) -> Review:
    return parse(
        f"<question>{question}</question>\n<report>{report}</report>\n\nReview the report: does every factual claim "
        "carry a citation, is anything unsupported, and does it fully answer the question?",
        Review,
    )


if __name__ == "__main__":
    question = " ".join(sys.argv[1:]) or "Write a briefing for a startup deciding between the Pro and Enterprise plans."
    report = lead_research(question)
    for round_ in range(1, 3):
        review = critique(question, report)
        print(f"\n[critic round {round_}] passed={review.passed} issues={review.issues}")
        if review.passed:
            break
        report = lead_research(f"{question}\n\nYour previous draft:\n{report}\n\nFix these issues:\n- " + "\n- ".join(review.issues))
    print("\n" + "=" * 70 + "\n" + report)
