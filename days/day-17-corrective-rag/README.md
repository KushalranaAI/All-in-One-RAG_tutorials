# Day 17 - Corrective RAG and Self-RAG: pipelines that check themselves

**Goal:** detect bad retrieval and ungrounded answers *at runtime*, and fix them automatically.

## In everyday life

Remember an open-book exam. You read the question, flip to the pages that seem to answer it, and start writing. A careful student does two extra things. First, she checks the pages really help, because a page about the right topic can still miss the point. If they do not, she rewords the question and looks in the index again. Second, before submitting, she reads her answer and checks that every line is backed by the book.

**Corrective RAG** (a RAG pipeline that grades what it retrieved before answering) does the first check. **Self-RAG style self-check** (grading the finished answer against its sources) does the second. Both graders are small, cheap model calls that answer yes or no. A **hallucination** (a confident claim the sources do not support) is what the second check catches.

Unlike the student, the pipeline does this in a loop with a limit of three tries, then it says it does not know instead of guessing.

**Where you meet it.** A company HR chatbot gets asked how many leave days carry forward. Search returns the public holiday list, which is on topic but useless, and a plain pipeline would invent a number. A grader rejects those pages, the query is reworded, and if nothing fits the bot admits the answer is not in the policy.

```scene
title: The careful open-book exam
step: 📖 You flip to the pages that seem to answer the question | Retrieve chunks
step: 🧐 You skim each page and ask whether it really helps | Grade each chunk
step: ✏️ If the pages miss, you reword the question and search again | Rewrite query and retrieve again
step: 📝 With good pages in hand, you write your answer | Generate from relevant chunks
step: ✅ Before submitting, you check each line is backed by the pages | Grounding check on the answer
step: 🙅 A line the pages do not back up is dropped, or you say it is missing | Regenerate strictly or abstain
takeaway: Check the sources before answering and check the answer before sending it.
```

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
