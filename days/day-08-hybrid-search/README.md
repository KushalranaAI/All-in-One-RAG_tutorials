# Day 08 - Hybrid search: keywords + vectors

**Goal:** combine BM25 keyword search with dense vector search so you catch both *exact terms* and *meaning*.

## In everyday life

At a railway enquiry counter, two kinds of questions arrive. One person asks, "What time does train 12345 leave?" Another asks, "Is there an evening train to Mumbai that is not too crowded?" The first needs someone who matches the exact number. The second needs someone who understands what the traveller means.

RAG search has the same two helpers. **BM25** (a classic keyword ranking, like old search engines used) matches exact words and numbers, and rare words count for more. It is blind to meaning. **Dense search** (search by embeddings, from Day 02) knows that "money back" means "refund", but can stumble on codes like "error 409" or "SEV1". **Hybrid search** asks both and merges the answers.

Merging needs care, because the two helpers score on different scales. So **RRF** (Reciprocal Rank Fusion: combine by position in each list, not by score) gives every document points for how high each helper ranked it. A document that both rank near the top wins. It needs almost no tuning.

**Where you meet it.** A support search over engineering docs. Engineers paste exact error codes, and they also describe problems loosely. A keyword-only search misses the loose descriptions, and a meaning-only search misses the code. Hybrid search handles both.

```scene
title: Two helpers at the enquiry counter
step: 🙋 A traveller asks, sometimes with a number, sometimes with a description | User query
step: 🔢 One clerk matches the exact words and numbers on the timetable | BM25 keyword ranking
step: 💭 Another clerk understands what the traveller means | Dense vector search
step: 📋 Each clerk hands over a ranked list, scored in a different style | Two ranked lists
step: 🤝 You merge the lists by position, so shared favourites rise to the top | Reciprocal Rank Fusion
takeaway: Keywords catch exact terms, vectors catch meaning, and hybrid search keeps both.
```

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
