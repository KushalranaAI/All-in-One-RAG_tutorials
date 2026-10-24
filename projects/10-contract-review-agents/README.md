# Project 10 - Contract Review Agents (playbook RAG)

**Level:** advanced · **Uses:** Days 07, 11, 22 · **Stack:** clause extraction, RAG over a legal playbook, parallel reviewer agents

Legal teams review contracts against a **playbook**: the company's standard position, fallback position
and red lines for each clause type. This project automates the first pass.

```
contract.txt ─► Extractor (structured): clauses [{type, section, text}]
                    │
                    ▼   for each clause, in parallel:
            retrieve playbook rules for that clause type (metadata filter + hybrid search)
                    ▼
            Reviewer agent: {risk: low/medium/high, deviation, playbook_rule, suggested_redline}
                    ▼
            Summariser ─► review_report.md (risk table + redlines + negotiation notes)
```

## Run
```bash
python projects/10-contract-review-agents/review.py samples/vendor_msa.txt
```
Uses `samples/playbook.md` (our standard positions). Swap in your own playbook and contracts.

## Why RAG and not just "ask Claude to review"?
The model knows contract law in general; **your playbook** is specific (e.g. "liability cap must be at
least 12 months of fees"). Retrieving the exact rule per clause makes the review consistent, auditable
and explainable - every finding cites the rule it's based on.

> This is a learning project, not legal advice. Have a lawyer review real contracts.

## Extend it
- Output tracked-changes `.docx` redlines.
- Add a "missing clauses" check (playbook clause types not found in the contract).
- Run across a folder of contracts and build a risk dashboard.
