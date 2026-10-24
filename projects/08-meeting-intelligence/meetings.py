"""Meeting intelligence: parallel minute extraction, weekly digest, and Q&A across meetings."""

import argparse
from pathlib import Path

from pydantic import BaseModel

from rag_common import FAST_MODEL, Agent, Chunk, HybridIndex, parse, tool
from rag_common.chunking import chunk_recursive

HERE = Path(__file__).resolve().parent
TRANSCRIPTS, MINUTES = HERE / "transcripts", HERE / "minutes"


class ActionItem(BaseModel):
    owner: str
    task: str
    due: str  # date as written, or "unspecified"


class Minutes(BaseModel):
    title: str
    date: str
    attendees: list[str]
    summary: str
    decisions: list[str]
    action_items: list[ActionItem]
    open_questions: list[str]
    topics: list[str]


def extract(path: Path) -> Minutes:
    return parse(
        f"<transcript>\n{path.read_text()}\n</transcript>\n\nExtract the meeting minutes. Decisions must be things "
        "explicitly agreed. Action items need an owner and a due date if one was said.",
        Minutes,
        model=FAST_MODEL,
    )


def to_markdown(m: Minutes) -> str:
    items = "\n".join(f"- [ ] **{a.owner}**: {a.task} (due {a.due})" for a in m.action_items)
    return (f"# {m.title} ({m.date})\nAttendees: {', '.join(m.attendees)}\n\n## Summary\n{m.summary}\n\n"
            "## Decisions\n" + "\n".join(f"- {d}" for d in m.decisions) + f"\n\n## Action items\n{items}\n\n"
            "## Open questions\n" + "\n".join(f"- {q}" for q in m.open_questions) + "\n")


def process() -> None:
    from concurrent.futures import ThreadPoolExecutor

    paths = sorted(TRANSCRIPTS.glob("*.txt"))
    with ThreadPoolExecutor() as pool:  # one extractor per meeting, in parallel
        all_minutes = list(pool.map(extract, paths))
    MINUTES.mkdir(exist_ok=True)
    for path, m in zip(paths, all_minutes):
        (MINUTES / f"{path.stem}.md").write_text(to_markdown(m))
        (MINUTES / f"{path.stem}.json").write_text(m.model_dump_json(indent=1))
        print(f"✓ {path.stem}: {len(m.decisions)} decisions, {len(m.action_items)} action items")

    writer = Agent("digest-writer", "You write crisp weekly digests for executives.")
    digest = writer.run(
        "Write a weekly digest from these meeting minutes: top decisions, action items grouped by owner with "
        "due dates, open questions, and risks.\n\n" + "\n\n".join(to_markdown(m) for m in all_minutes)
    )
    (MINUTES / "weekly_digest.md").write_text(digest)
    print(f"\nDigest saved to {MINUTES / 'weekly_digest.md'}")


def build_index() -> HybridIndex:
    chunks = []
    for path in sorted(TRANSCRIPTS.glob("*.txt")):
        meeting = path.stem
        for piece in chunk_recursive(path.read_text(), 600):
            chunks.append(Chunk(piece, {"meeting": meeting, "kind": "transcript"}))
        minutes_file = MINUTES / f"{meeting}.json"
        if minutes_file.exists():  # index extracted decisions / action items as their own chunks
            m = Minutes.model_validate_json(minutes_file.read_text())
            chunks += [Chunk(f"DECISION ({m.date}): {d}", {"meeting": meeting, "kind": "decision"}) for d in m.decisions]
            chunks += [Chunk(f"ACTION ITEM ({m.date}): {a.owner} - {a.task} (due {a.due})", {"meeting": meeting, "kind": "action"})
                       for a in m.action_items]
    for i, c in enumerate(chunks):
        c.metadata["chunk_id"] = f"{c.metadata['meeting']}#{i}"
    return HybridIndex(chunks)


def ask(question: str) -> str:
    index = build_index()

    def search(query: str, kind: str = "any") -> str:
        where = None if kind == "any" else {"kind": kind}
        return "\n\n".join(f"[{c.metadata['meeting']}] {c.text}" for c in index.search(query, k=6, where=where))

    agent = Agent(
        "meeting-qa",
        "Answer questions about the team's meetings. Search (try kind='decision' or 'action' when relevant), "
        "then answer citing meetings like [2026-10-08-eu-launch]. Say if something wasn't discussed.",
        tools=[tool("search", "Search meeting transcripts and extracted minutes.", {
            "query": {"type": "string"},
            "kind": {"type": "string", "enum": ["any", "transcript", "decision", "action"]},
        }, ["query"])],
        handlers={"search": search},
    )
    return agent.run(question, verbose=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("process")
    a = sub.add_parser("ask")
    a.add_argument("question", nargs="+")
    args = parser.parse_args()
    process() if args.cmd == "process" else print("\n" + ask(" ".join(args.question)))
