"""Review a contract clause-by-clause against a playbook, with parallel reviewer agents."""

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from rag_common import HybridIndex, ask, parse
from rag_common.chunking import chunk_by_headings

HERE = Path(__file__).resolve().parent
ClauseType = Literal["Limitation of Liability", "Indemnification", "Term and Termination", "Payment Terms",
                     "Data Protection", "Governing Law", "Other"]


class Clause(BaseModel):
    clause_type: ClauseType
    section: str
    text: str


class Clauses(BaseModel):
    clauses: list[Clause]


class Finding(BaseModel):
    risk: Literal["low", "medium", "high"]
    deviation: str           # how the clause differs from the playbook
    playbook_rule: str       # the rule it is judged against (quoted)
    suggested_redline: str   # replacement wording, or "none"


def load_playbook(path: Path) -> HybridIndex:
    chunks = chunk_by_headings(path.read_text())
    for i, c in enumerate(chunks):
        c.metadata.update(clause_type=c.metadata["section"].split(" > ")[-1], chunk_id=f"playbook#{i}")
    return HybridIndex(chunks)


def review_clause(clause: Clause, playbook: HybridIndex) -> Finding:
    rules = playbook.search(clause.text, k=2, where={"clause_type": clause.clause_type}) or playbook.search(clause.text, k=2)
    rules_text = "\n\n".join(c.text for c in rules)
    return parse(
        f"<playbook_rules>\n{rules_text}\n</playbook_rules>\n<clause section='{clause.section}' type='{clause.clause_type}'>\n"
        f"{clause.text}\n</clause>\n\nAssess this clause against the playbook. high = crosses a red line; "
        "medium = outside standard but within fallback; low = matches standard. Suggest redline wording that "
        "meets the standard position.",
        Finding,
        system="You are an experienced commercial lawyer on the customer (buyer) side.",
    )


def review(contract_path: Path, playbook_path: Path) -> str:
    playbook = load_playbook(playbook_path)
    clauses = parse(f"Split this contract into clauses and classify each:\n\n{contract_path.read_text()}", Clauses).clauses
    print(f"Extracted {len(clauses)} clauses; reviewing in parallel...")
    with ThreadPoolExecutor(max_workers=6) as pool:
        findings = list(pool.map(lambda c: review_clause(c, playbook), clauses))

    order = {"high": 0, "medium": 1, "low": 2}
    rows = sorted(zip(clauses, findings), key=lambda cf: order[cf[1].risk])
    table = "\n".join(f"| {c.section} | {c.clause_type} | **{f.risk.upper()}** | {f.deviation} |" for c, f in rows)
    details = "\n\n".join(
        f"### §{c.section} {c.clause_type} - {f.risk.upper()}\n> {c.text}\n\n**Playbook:** {f.playbook_rule}\n\n"
        f"**Issue:** {f.deviation}\n\n**Suggested redline:** {f.suggested_redline}" for c, f in rows
    )
    summary = ask(f"Write a 5-sentence negotiation summary for the business owner based on:\n{table}", effort="low")
    return (f"# Contract review: {contract_path.name}\n\n{summary}\n\n| § | Clause | Risk | Deviation |\n|---|---|---|---|\n"
            f"{table}\n\n## Details\n\n{details}\n")


if __name__ == "__main__":
    contract = Path(sys.argv[1] if len(sys.argv) > 1 else "samples/vendor_msa.txt")
    contract = contract if contract.exists() else HERE / contract
    report = review(contract, HERE / "samples" / "playbook.md")
    (HERE / "review_report.md").write_text(report)
    print(report)
