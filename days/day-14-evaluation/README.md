# Day 14 - Evaluating RAG: retrieval metrics and LLM-as-judge

**Goal:** stop guessing. Measure retrieval and answer quality so every change is a measured improvement.

## In everyday life

Before a big exam, a good coaching class does not just tell students to study harder. It sets a mock test with an answer key, marks it, and checks the score. Then it changes something, such as the study plan, and tests again. Without that, nobody knows whether the change helped.

A RAG system needs the same habit. **Evaluation** (measuring quality with a fixed set of test questions) looks at two halves. First, retrieval: did we fetch the right pages? Two common scores are **hit@k** (the share of questions where a correct source is in the top k results) and **MRR** (mean reciprocal rank, which rewards putting the right source first). Second, generation: is the answer correct and **faithful** (every claim is backed by the retrieved text)?

Marking hundreds of answers by hand is slow, so a strong model can do the marking. This is **LLM-as-judge** (a model that grades answers against a reference answer and the sources). Unlike a trusted teacher, the judge can be wrong, so you check its marks against your own on a small sample.

**Where you meet it.** A team running a customer help bot wants to try bigger chunks. They keep a set of real customer questions with correct answers, run the old and new setups, and compare scores. If the numbers drop, they undo the change before any customer sees it.

```scene
title: The mock test before the real exam
step: 📋 A coaching class prepares a mock test with an answer key | Eval set with reference answers
step: 📚 First it checks whether each student opened the right chapter | Retrieval hit rate and MRR
step: ✏️ Then it checks whether the written answer matches the key | Answer correctness and faithfulness
step: 👩 A senior teacher marks the answers and writes her reasons first | LLM-as-judge
step: 🔁 After the study plan changes, the same test is taken again | Re-run the eval after each change
step: 📈 The scores show whether the change really helped | Measured improvement
takeaway: Measure retrieval and answers on the same questions after every change.
```

## Evaluate the two halves separately
| Half | Question | Metrics |
|------|----------|---------|
| **Retrieval** | did we fetch the right chunks? | hit-rate@k (recall@k), **MRR**, precision@k, nDCG |
| **Generation** | is the answer right and grounded? | correctness, **faithfulness** (no claims beyond the sources), answer relevance |

If retrieval fails, no prompt will save the answer - so always check retrieval first.

## Metrics in plain words
- **hit@k** - share of questions where a correct source is in the top k.
- **MRR** (mean reciprocal rank) - average of `1/rank` of the first correct result (1.0 = always first).
- **Faithfulness** - every claim in the answer is supported by the retrieved context.
- **Correctness** - the answer matches the reference answer.

## The eval set
`data/eval_set.json` - 16 questions with a reference answer and the source document. Real projects
need 50-200 examples, ideally from real user questions. You can bootstrap by asking Claude to write
questions *from* your chunks, then review them by hand.

## LLM-as-judge
A strong model grades each answer against the reference and the sources, returning a structured verdict
(we use `parse()` with a Pydantic schema). Tips:
- Ask for the **reasoning before the score**.
- Use binary or 1-5 scales with clear definitions.
- Spot-check the judge against your own judgement on ~20 examples.

Libraries such as **Ragas**, **DeepEval**, **TruLens** and **Phoenix** package these metrics.

## Run it
```bash
python days/day-14-evaluation/evaluate.py              # retrieval metrics only (free, no API calls)
python days/day-14-evaluation/evaluate.py --judge      # + answer correctness/faithfulness with Claude
```

## Exercises
1. Compare dense, BM25 and hybrid retrieval (Day 08) - which has the best MRR?
2. Sweep chunk size (300, 600, 1200) and k (1, 3, 5). Make a table.
3. Add 10 questions of your own, including two unanswerable ones. Does the system say "I don't know"?
