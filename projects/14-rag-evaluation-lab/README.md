# Project 14 - RAG Evaluation Lab

**Level:** intermediate+ · **Uses:** Days 04, 08, 09, 13, 14 · **Stack:** synthetic test sets, retrieval grid search, LLM-as-judge, leaderboard

A benchmark harness to answer "which RAG setup is best **for my data**?" with numbers instead of vibes.

```
1. generate   Claude writes Q&A pairs from random chunks (+ unanswerable questions)  ─► testset.json
2. retrieval  grid: chunk size × retriever (dense | bm25 | hybrid | hybrid+rerank) × k  ─► hit@k, MRR, latency
3. answers    top configs: generate answers, judge correctness + faithfulness, token cost
4. report     leaderboard.md + results.csv
```

## Run
```bash
python projects/14-rag-evaluation-lab/lab.py generate --n 30               # synthetic questions (uses the API)
python projects/14-rag-evaluation-lab/lab.py retrieval                       # free: no LLM calls (except rerank)
python projects/14-rag-evaluation-lab/lab.py retrieval --testset data/eval_set.json --no-rerank
python projects/14-rag-evaluation-lab/lab.py answers --top 2                 # judge answers for the 2 best configs
```
Point `--docs` at your own folder to benchmark your corpus.

## Good evaluation hygiene
- Synthetic questions are a start; **real user questions** are the gold standard. Mix both.
- Review a sample of generated questions - drop vague or trivially lexical ones.
- Keep a held-out set you never tune on.
- Track **cost and latency** next to quality; the best config is rarely the most expensive.

## Extend it
- Add contextual retrieval (Day 13) and query rewriting (Day 10) as grid dimensions.
- Run it in CI and fail the build if MRR drops more than 5%.
- Plot quality vs. cost per configuration.
