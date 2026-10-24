# Day 08 - Hybrid search: keywords + vectors

**Goal:** combine BM25 keyword search with dense vector search so you catch both *exact terms* and *meaning*.

## Why dense search alone isn't enough
Embeddings are great at paraphrase ("money back" ≈ "refund") but weak at:
- exact identifiers: error `409`, `SEV1`, `ap-south`, product SKUs, function names,
- rare words the embedding model never saw,
- short, keyword-style queries.

**BM25** (the classic search-engine ranking function) is the opposite: precise on exact terms, blind
to synonyms. Use both.

## BM25 in one formula
```
score(q, d) = Σ_t  IDF(t) · tf(t,d)·(k1+1) / (tf(t,d) + k1·(1 - b + b·|d|/avg|d|))
```
- **IDF**: rare terms count more. **tf**: repeated terms count more, with diminishing returns (`k1`).
- `b` normalises for document length. See `rag_common/retrieval.py` - 30 lines.

## Fusing two rankings: Reciprocal Rank Fusion (RRF)
Scores from BM25 and cosine similarity live on different scales, so instead of mixing scores we mix
**ranks**:
```
RRF(d) = Σ_rankers 1 / (60 + rank_r(d))
```
Simple, robust, no tuning - the default in Elasticsearch, OpenSearch, Weaviate and others.
(An alternative is weighted score fusion after min-max normalisation: `α·dense + (1-α)·bm25`.)

## Run it
```bash
python days/day-08-hybrid-search/hybrid.py
```
It prints the top-3 from dense, BM25 and hybrid for a mix of keyword and semantic queries. Look for
queries where one retriever fails and hybrid still gets it.

## Exercises
1. Implement weighted fusion and sweep `α` from 0 to 1 using the Day 14 eval set.
2. Add stemming to `tokenize` (e.g. `nltk.PorterStemmer`). Does BM25 improve?
3. Try `rank_bm25.BM25Okapi` and check it ranks the same as ours.
