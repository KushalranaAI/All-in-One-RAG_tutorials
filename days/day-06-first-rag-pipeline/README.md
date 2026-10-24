# Day 06 - Your first end-to-end RAG pipeline

**Goal:** put Days 1-5 together into a working question-answering system over the handbook.

## The pipeline
```
INDEX (once)      load_directory ─► chunk_by_headings ─► embed ─► SimpleVectorStore
QUERY (per ask)   question ─► embed ─► top-k search ─► build prompt with sources ─► Claude ─► answer [1][2]
```

`rag.py` is ~50 lines. Read it top to bottom - every later lesson is a variation on one of its steps.

```python
hits = store.search(question, k=4)                  # retrieve
prompt = rag_user_prompt(question, hits)            # augment
answer = ask(prompt, system=RAG_SYSTEM)             # generate
```

## Decisions you just made (and will revisit)
| Knob | Today | Revisit on |
|------|-------|-----------|
| chunk size | 800 chars, by heading | Day 12, 13 |
| retriever | dense cosine only | Day 08 (hybrid), 09 (rerank), 10 (query rewriting) |
| k | 4 | Day 14 (measure it!) |
| prompt | numbered sources + cite rule | Day 07 |
| answer when unsure | "I don't know" | Day 17 (self-correcting) |

## Run it
```bash
python days/day-06-first-rag-pipeline/rag.py "Which plan includes SSO?"
python days/day-06-first-rag-pipeline/rag.py            # interactive mode
python days/day-06-first-rag-pipeline/rag.py --show-sources "What is the SEV1 response process?"
```

Questions to try:
- "Can I get a refund on an annual plan after 45 days?" (needs refund_policy)
- "How long are backups kept on Pro?" (needs security)
- "What's the CEO's name?" (not in the docs - it should say it doesn't know)

## Exercises
1. Change `k` to 1 and to 10. Which questions break?
2. Print the full prompt that is sent to Claude. How many tokens is it?
3. Add a `--doc` flag that restricts retrieval to one document using `where=`.
