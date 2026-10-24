"""Planner -> parallel researchers (internal + web) -> writer -> critic -> editor."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from rag_common import (
    FAST_MODEL,
    HybridIndex,
    ask,
    handbook_chunks,
    parse,
    run_tool_loop,
    tool,
)

HERE = Path(__file__).resolve().parent
INDEX = HybridIndex(handbook_chunks())
WEB_SEARCH = {"type": "web_search_20260209", "name": "web_search", "max_uses": 4}


class Section(BaseModel):
    title: str
    questions: list[str]
    sources: Literal["internal", "web", "both"]


class Plan(BaseModel):
    sections: list[Section]


class Review(BaseModel):
    score: int  # 1-10
    issues: list[str]


def research(section: Section, use_web: bool) -> str:
    tools = [tool("search_internal", "Search the company's internal handbook.", {"query": {"type": "string"}})]
    if use_web and section.sources != "internal":
        tools.append(WEB_SEARCH)
    brief = (
        f"Research section '{section.title}'. Answer these questions:\n- " + "\n- ".join(section.questions) +
        f"\nPreferred sources: {section.sources}. Return bullet-point findings. Cite internal passages as "
        "[chunk_id] and web pages as (url). State clearly what you could not find."
    )
    findings, _ = run_tool_loop(
        [{"role": "user", "content": brief}], tools, {"search_internal": lambda query: INDEX.search_text(query, 4)},
        system="You are a meticulous research assistant.", model=FAST_MODEL, effort="low", verbose=False,
    )
    print(f"  ✓ researched: {section.title}")
    return f"## Findings: {section.title}\n{findings}"


def run(question: str, use_web: bool) -> str:
    plan = parse(f"Create a research plan (3-5 sections) for this question: {question}", Plan)
    print("Plan:", *[f"  - {s.title} [{s.sources}]" for s in plan.sections], sep="\n")

    with ThreadPoolExecutor(max_workers=5) as pool:
        findings = list(pool.map(lambda s: research(s, use_web), plan.sections))
    notes = "\n\n".join(findings)

    write = (f"<findings>\n{notes}\n</findings>\n\nWrite a well-structured Markdown report answering: {question}\n"
             "Use only the findings. Keep every citation. Start with an executive summary and end with a recommendation.")
    report = ask(write, effort="high")
    for round_ in range(1, 3):
        review = parse(f"<question>{question}</question>\n<findings>\n{notes}\n</findings>\n<report>\n{report}\n</report>\n\n"
                       "Score the report 1-10 for accuracy against the findings, citation coverage and usefulness. "
                       "List concrete issues.", Review)
        print(f"Critic round {round_}: score={review.score} issues={len(review.issues)}")
        if review.score >= 8:
            break
        report = ask(f"{write}\n\nPrevious draft:\n{report}\n\nFix these issues:\n- " + "\n- ".join(review.issues), effort="high")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("question", nargs="+")
    parser.add_argument("--no-web", action="store_true")
    args = parser.parse_args()
    report = run(" ".join(args.question), use_web=not args.no_web)
    (HERE / "report.md").write_text(report)
    print("\n" + report + f"\n\nSaved to {HERE / 'report.md'}")
