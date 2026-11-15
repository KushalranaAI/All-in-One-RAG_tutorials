# Day 06 - Your first end-to-end RAG pipeline

**Goal:** put Days 1-5 together into a working question-answering system over the handbook.

## In everyday life

A small restaurant does not start from raw vegetables when an order arrives. In the morning the cook washes, cuts and labels everything and puts it on shelves. When an order comes in, the cook takes the right items off the shelves, follows the recipe, and sends out the plate. The slow work happens once. Each order is quick.

A **RAG pipeline** (the full chain from your documents to a finished answer) works the same way. The morning prep is **indexing** (preparing your documents once): load the files, chunk them, embed each chunk, and store them in a **vector store** (a shelf that finds items by meaning). The order is the **query** (one question from a user): embed the question, fetch the **top-k** chunks (the k closest matches, here 4), put them in a prompt, and let Claude write the answer.

Today's version is plain on purpose, about fifty lines. Later days improve one step at a time. Unlike a kitchen, when the shelf lacks the right item the pipeline should say it does not know, not improvise.

**Where you meet it.** A startup's internal "ask the handbook" bot. A staff member asks "Which plan includes SSO?" and gets an answer with its sources. Without a pipeline, someone searches five documents by hand, or the model guesses.

```scene
title: A kitchen that preps before orders
step: 🥬 In the morning the cook washes and cuts all the vegetables | Load and chunk documents
step: 🏷️ Every item is labelled and put on a shelf by kind | Embed and store in vector store
step: 🧾 An order arrives from a customer | User question
step: 🧺 The cook takes the four best-matching items off the shelf | Top-k retrieval
step: 🍛 The cook follows the recipe with those items and serves the plate | Prompt Claude, answer with sources
takeaway: Prepare your documents once, then every question is just a lookup plus one model call.
```

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
