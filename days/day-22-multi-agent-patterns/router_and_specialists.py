"""Day 22: routing + parallel specialists + synthesis."""

import sys
from typing import Literal

from pydantic import BaseModel

from rag_common import (
    FAST_MODEL,
    Agent,
    HybridIndex,
    handbook_chunks,
    parse,
    run_parallel,
    tool,
)

INDEX = HybridIndex(handbook_chunks())

SPECIALISTS = {
    "billing": ["pricing", "refund_policy"],
    "security": ["security"],
    "engineering": ["api_rate_limits", "incident_runbook"],
    "product": ["product_faq"],
}
Specialty = Literal["billing", "security", "engineering", "product"]


class Route(BaseModel):
    specialists: list[Specialty]
    sub_questions: list[str]  # one per specialist, same order


def make_specialist(name: str, titles: list[str]) -> Agent:
    def search(query: str) -> str:
        results = [INDEX.search_text(query, k=2, where={"title": t}) for t in titles]
        return "\n\n".join(r for r in results if r != "No results.")

    return Agent(
        name=name,
        system=f"You are the {name} specialist. Search your documents ({', '.join(titles)}) and report only "
        "facts you found, with chunk-id citations like [pricing#2]. Be brief.",
        tools=[tool("search", f"Search the {name} documents.", {"query": {"type": "string"}})],
        handlers={"search": search},
        model=FAST_MODEL,
        effort="low",
    )


def answer(question: str) -> str:
    route = parse(
        f"Which specialists are needed for this question, and what should each one be asked?\n"
        f"Specialists: {', '.join(SPECIALISTS)}.\nQuestion: {question}",
        Route,
        model=FAST_MODEL,
    )
    print(f"router -> {route.specialists}")
    jobs = [(make_specialist(s, SPECIALISTS[s]), q) for s, q in zip(route.specialists, route.sub_questions)]
    findings = run_parallel(jobs)
    for (agent, q), f in zip(jobs, findings):
        print(f"\n[{agent.name}] {q}\n{f}")

    report = "\n\n".join(f"<findings from='{a.name}'>\n{f}\n</findings>" for (a, _), f in zip(jobs, findings))
    synthesiser = Agent("synthesiser", "Combine specialist findings into one clear answer. Keep their citations. "
                        "Do not add facts that are not in the findings.")
    return synthesiser.run(f"{report}\n\nUser question: {question}")


if __name__ == "__main__":
    q = " ".join(sys.argv[1:]) or "I'm on Pro: how long are backups kept and can I get a refund if I leave after 3 weeks?"
    print("\n=== Final answer ===\n" + answer(q))
