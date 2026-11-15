# Day 05 - Vector databases

**Goal:** store embeddings and find the nearest ones fast; understand what a vector DB actually does.

## In everyday life

Imagine the post office has to deliver a parcel, but the label has no street address. It only says "somewhere near the old market, close to the blue school". The postman could knock on every house in the country until one fits. He would find the best match, but it would take years.

A **vector database** (a store that keeps embeddings and quickly finds the ones closest to a given one) solves this. For each piece of text it keeps a label (`id`), a position (the **vector**, a list of numbers), the original text, and extra notes (**metadata**, such as the category or date). Checking every item is called **brute force** (compare against everything, always exact). It is fine for a small town. For a big country, an **approximate nearest neighbour index** (a shortcut structure that checks only the promising area) sorts houses into districts first, then searches only the nearest districts.

Unlike the postman, the shortcut can occasionally skip the very closest house. You trade a tiny bit of accuracy for a huge gain in speed.

**Where you meet it.** An online shop with a million product descriptions lets shoppers search by meaning and filter by category. Scanning every product for every search makes the page slow. A vector database with an index returns the closest products in a blink and only from the chosen category.

```scene
title: The post office finds the nearest house
step: 📦 Every parcel is stored with a label, a map spot, the contents and notes | id, vector, text, metadata
step: 🙋 A new request arrives with only a rough spot on the map | Query vector
step: 🚶 Knocking on every house would be exact but far too slow | Brute force search
step: 🏘️ The post office groups houses into districts and visits only nearby ones | ANN index such as IVF
step: 🏠 Inside those districts it picks the k closest houses matching the filter | Top k with metadata filter
takeaway: A vector database trades a little accuracy for speed by searching only the promising neighbourhood.
```

## What a vector DB stores
For every chunk: `id`, `vector`, `text`, `metadata`. A query is "give me the k vectors closest to this
one (optionally where metadata matches X)".

## Build one in 40 lines
`rag_common/vectorstore.py` is a complete, honest vector store:
```python
scores = self.vectors @ query_vector      # cosine similarity (vectors are normalised)
order  = np.argsort(-scores)[:k]          # brute-force exact nearest neighbours
```
Brute force is **exact** and fast up to ~100k chunks on a laptop. Beyond that you need an
**approximate nearest neighbour (ANN)** index.

## ANN indexes in one table
| Index | Idea | Used by |
|-------|------|---------|
| **HNSW** | multi-layer "small world" graph; greedy walk toward the query | Chroma, Qdrant, Weaviate, pgvector, Milvus |
| **IVF** | cluster vectors (k-means), search only the nearest clusters | FAISS, Milvus |
| **PQ** | compress vectors into short codes; trades accuracy for memory | FAISS, Milvus |

## Choosing a vector DB
| DB | When to pick it |
|----|-----------------|
| In-memory numpy / FAISS | prototypes, tests, < 1M vectors, single process |
| **Chroma** | local-first, zero config, great for learning (used below) |
| **pgvector** | you already run Postgres; transactions + SQL filters |
| Qdrant / Weaviate / Milvus | dedicated servers, filtering, scale-out, hybrid search |
| Pinecone / managed services | no ops, pay per use |

## Run it
```bash
python days/day-05-vector-databases/simple_store_demo.py   # our numpy store: add, search, filter, save, load
pip install chromadb
python days/day-05-vector-databases/chroma_demo.py         # the same with Chroma (persistent, HNSW)
```

## Exercises
1. Time `search()` on 1k, 10k and 100k random vectors. Where does brute force become too slow?
2. Add a `delete(where=...)` method to `SimpleVectorStore`.
3. Swap Chroma's default embedding function for `rag_common.get_embedder()` so both stores use the same model.
