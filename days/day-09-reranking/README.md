# Day 09 - Reranking

**Goal:** retrieve broadly, then re-order a short list with a slower, much more accurate model.

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
