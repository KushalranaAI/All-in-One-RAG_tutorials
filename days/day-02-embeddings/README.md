# Day 02 - Embeddings and semantic similarity

**Goal:** understand how text becomes vectors, and how "closeness" of vectors measures meaning.

## What is an embedding?
An embedding model maps text to a list of numbers (a vector), e.g. 384 floats. It is trained so that
texts with **similar meaning** end up **close together** - even with no words in common:

```
"How do I get my money back?"     ──►  [0.12, -0.40, 0.33, ...]  ┐ close
"Refund policy for monthly plans" ──►  [0.10, -0.38, 0.29, ...]  ┘
"Rate limits for the API"         ──►  [-0.51, 0.22, 0.07, ...]    far
```

## Measuring similarity
For normalised vectors (length 1), **cosine similarity** is just the dot product:

```
cos(a, b) = (a · b) / (|a| |b|)       → 1.0 same direction, 0 unrelated, -1 opposite
```

## Which embedding model?
Claude generates text, not embeddings, so RAG systems pair Claude with a separate embedding model:

| Option | Notes |
|--------|-------|
| `sentence-transformers/all-MiniLM-L6-v2` | free, local, 384 dims, fast - used in this course |
| `BAAI/bge-*`, `intfloat/e5-*`, `nomic-embed` | stronger open models |
| Voyage AI (`voyage-3`, `voyage-code-3`) | hosted, Anthropic's recommended embedding partner |

`rag_common.get_embedder()` uses MiniLM if `sentence-transformers` is installed and otherwise falls back
to a `HashingEmbedder` (pure numpy, lexical only) so everything still runs offline.

## Run it
```bash
python days/day-02-embeddings/embeddings_demo.py
```
You'll see a similarity matrix and a tiny "search" that ranks sentences against a query.
Try it once with `RAG_EMBEDDER=hashing` and compare: the hashing embedder only matches shared words,
a real model matches *meaning* ("money back" ≈ "refund").

## Things to remember
- Use the **same** model for documents and queries.
- Embeddings have a max input length (MiniLM: ~256 tokens) - one reason we chunk (Day 04).
- Some models want prefixes like `query:` / `passage:` (e5, bge) - read the model card.

## Exercises
1. Add five sentences of your own and find the closest pair.
2. Embed the same sentence in English and in another language. How similar are they?
3. Plot the vectors in 2-D with PCA (`sklearn.decomposition.PCA`) and colour by topic.
