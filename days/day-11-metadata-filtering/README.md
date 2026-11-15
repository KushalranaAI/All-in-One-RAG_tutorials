# Day 11 - Metadata filtering and self-querying retrieval

**Goal:** narrow the search space with structured filters - and let the LLM write those filters.

## In everyday life

When you shop online for a shirt, you do not scroll through every product. You tick filters: size M, under 1,000 rupees, in stock. Only then do you look at what is left. Without filters, the best-looking match might be a shirt in the wrong size.

**Metadata** (labels attached to each chunk, such as category, year or product) work as those filters in RAG. Without them, similarity search returns near-misses: last year's policy, the wrong product, another customer's records. A **metadata filter** (a rule such as year at least 2025) keeps only chunks whose labels fit, and then similarity ranks the survivors.

Users do not type filters by hand, so **self-querying** (letting a model turn the question into a search phrase plus filters) does it for them. "What are the security backup rules?" becomes a search for backup retention, limited to the security category. Unlike a shop's filter menu, a model can pick a wrong filter, so it is only allowed to choose values that really exist.

**Where you meet it.** A helpdesk tool shared by many companies. One company's agent searches for refund rules. The system filters on that company's id at retrieval time, so other companies' tickets never reach the model. You do not ask the model to hide them.

```scene
title: Filters before you browse a shop
step: 🙋 You tell the assistant you want a medium shirt within a budget | User question
step: 🧠 The assistant turns your words into a search phrase plus filters | Self-query: query and filters
step: ☑️ The shop hides every shirt that fails the size or price rule | Metadata filter applied first
step: 🔍 You compare only the shirts that remain | Similarity search on filtered chunks
step: 🛍️ You choose from a short list that is all relevant | Precise and safe results
takeaway: Filter by labels first, so search only looks where the right answer can be.
```

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
