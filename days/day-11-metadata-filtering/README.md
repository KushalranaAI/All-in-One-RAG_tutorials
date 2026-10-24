# Day 11 - Metadata filtering and self-querying retrieval

**Goal:** narrow the search space with structured filters - and let the LLM write those filters.

## Why filter?
Similarity search over *everything* returns near-misses from the wrong place: last year's policy, another
product, another customer's tickets. Metadata filters make retrieval **precise** and **safe**:

- `category = "billing"`, `product = "postgres"`, `year >= 2025`, `language = "de"`
- **Security:** `tenant_id = current_user.tenant` - never rely on the LLM to hide other tenants' data;
  filter at retrieval time (Day 29).

## Self-query retrieval
Let a fast LLM turn the question into **(semantic query, filters)**:
```
"What are the security backup rules?"
  → query: "backup retention rules"   filters: {"category": "security"}
```
We use structured output (`rag_common.parse`) with a `Literal[...]` type so the model can only choose
categories that exist.

## Pre- vs. post-filtering
- **Pre-filter** (filter, then search) - exact, what `SimpleVectorStore.search(where=...)` does.
- **Post-filter** (search top-k, then drop) - can return fewer than k results. Most vector DBs do
  filtered HNSW to avoid this.

## Run it
```bash
python days/day-11-metadata-filtering/self_query.py
```

## Exercises
1. Add a `doc_type` field (policy / reference / guide) and let the self-query model filter on it.
2. Support range filters (`updated_after`) in `SimpleVectorStore.search`.
3. Fall back to unfiltered search when a filtered search returns nothing.
