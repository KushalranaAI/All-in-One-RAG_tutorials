# Day 17 - Corrective RAG and Self-RAG: pipelines that check themselves

**Goal:** detect bad retrieval and ungrounded answers *at runtime*, and fix them automatically.

## Where RAG goes wrong
1. **Retrieval miss** - the chunks don't contain the answer → the model guesses.
2. **Hallucination** - the chunks are fine, but the answer adds unsupported claims.

## Corrective RAG (CRAG)
Grade the retrieved chunks *before* generating:
```
retrieve ─► grade each chunk (relevant?) ─┬─ enough relevant ─► generate
                                         └─ not enough ─► rewrite query / other source ─► retrieve again
```

## Self-RAG style self-check
Grade the answer *after* generating:
```
generate ─► "is every claim supported by the sources?" ─┬─ yes ─► return
                                                        └─ no  ─► regenerate strictly / say "I don't know"
```

Both graders are cheap structured calls to a fast model (`FAST_MODEL` + `parse()`).

## The state machine in `crag.py`
```
for attempt in 1..3:
    chunks   = retrieve(query)
    relevant = [c for c in chunks if grade(c).relevant]
    if relevant: break
    query    = rewrite(question, why_it_failed)
answer = generate(question, relevant)
if not grounded(answer, relevant): answer = generate(..., strict=True)
```
This is exactly what graph frameworks like LangGraph formalise - but it's just a loop with `if`s.

## Run it
```bash
python days/day-17-corrective-rag/crag.py "my bill went wrong, can I get cash back for the yearly plan?"
python days/day-17-corrective-rag/crag.py "What is the office address in Berlin?"   # not in the docs
```

## Exercises
1. Add a web-search fallback (Claude's server-side `web_search` tool) when the handbook fails twice.
2. Track how often each branch runs on the eval set. Is the extra cost worth it?
3. Return a `confidence` field to the user based on the grader results.
