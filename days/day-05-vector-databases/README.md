# Day 05 - Vector databases

**Goal:** store embeddings and find the nearest ones fast; understand what a vector DB actually does.

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
