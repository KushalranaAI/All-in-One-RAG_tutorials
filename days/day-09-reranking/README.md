# Day 09 - Reranking

**Goal:** retrieve broadly, then re-order a short list with a slower, much more accurate model.

## In everyday life

A company advertises a job and gets 400 applications. Nobody reads 400 resumes in full. First a quick screen picks the 20 that look closest to the job. Then an interviewer sits with each of the 20, reads the job description and the candidate together, and ranks them. The screen is fast but rough. The interview is slow but sharp.

**Reranking** (re-ordering a short list with a more careful scorer) is that second stage. The fast first stage uses embeddings from a **bi-encoder** (a model that turns query and document into numbers separately, so the numbers can be prepared ahead of time). The careful stage uses a **cross-encoder** (a model that reads the question and one chunk together and scores how well they fit). It is accurate, but it must run once per pair, so you use it on only 20 to 50 candidates.

Unlike an interviewer, a reranker cannot find a candidate who never made the shortlist. It fixes the order, not the **recall** (whether the right chunk was found at all).

**Where you meet it.** A legal research tool. Search returns 30 clauses, and the best one sits at rank 9 behind loosely related ones. The model would see only the top 3 and miss it. The reranker moves the best clause to the top, so the answer uses it.

```scene
title: Shortlisting and interviewing candidates
step: 📨 Four hundred applications arrive for one job | Large document collection
step: ⚡ A quick screen keeps the 20 that look closest | Fast retrieval of top 20-50
step: 🗣️ An interviewer reads the job and each candidate together | Cross-encoder scores each pair
step: 📊 The interviewer ranks the 20 from best to worst | Re-ordered candidate list
step: 🏁 Only the top few go forward to the final panel | Top 3-5 sent to the LLM
takeaway: Search wide and cheap first, then spend careful effort on a short list to get the order right.
```

## Two-stage retrieval
```
query ─► fast retriever (top 20-50) ─► reranker (scores each query+chunk pair) ─► top 3-5 ─► LLM
```
- **Bi-encoders** (Day 02 embeddings) encode query and document *separately* - fast, can be indexed.
- **Cross-encoders** read query and document *together* - they see word-level interactions, so they're
  far more accurate, but you can't precompute them. Perfect for re-scoring a short candidate list.

## Reranker options
| Reranker | Notes |
|----------|-------|
| `cross-encoder/ms-marco-MiniLM-L-6-v2` | free, local, ~20 ms per pair on CPU |
| `BAAI/bge-reranker-v2-m3` | stronger, multilingual |
| Cohere Rerank, Voyage rerank | hosted APIs |
| **LLM as reranker** | ask a fast model (Claude Haiku) to grade relevance 0-10; flexible, can follow instructions like "prefer recent docs" |

## Run it
```bash
python days/day-09-reranking/rerank.py
```
Uses the cross-encoder if `sentence-transformers` is installed, and always also runs the LLM reranker
(structured output via `rag_common.parse` → a validated Pydantic object, no JSON parsing by hand).

## Tips
- Rerank 20-50 candidates; more costs latency with little gain.
- Rerankers fix *ordering*, not *recall* - if the right chunk isn't in the candidates, no reranker helps.
- Drop chunks below a relevance threshold instead of always sending k chunks.

## Exercises
1. Measure MRR before/after reranking with the Day 14 eval set.
2. Add a threshold: drop LLM scores < 4. How often does the answer become "I don't know"?
3. Rerank with the cross-encoder, then let the LLM pick the final 3 - is the combo worth it?
