"""Day 02: embed sentences, compare them with cosine similarity, and do a mini search."""

import numpy as np

from rag_common import get_embedder

SENTENCES = [
    "How do I get my money back?",
    "Refunds are available within 14 days of the first payment.",
    "The API returns HTTP 429 when you exceed the rate limit.",
    "Too many requests will get throttled.",
    "Employees get 25 days of paid vacation per year.",
    "How much holiday leave do staff receive?",
]


def cosine_matrix(vectors: np.ndarray) -> np.ndarray:
    vectors = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors @ vectors.T


if __name__ == "__main__":
    embedder = get_embedder()
    print(f"Embedder: {type(embedder).__name__} ({embedder.dim} dimensions)\n")

    vectors = embedder.embed(SENTENCES)
    sims = cosine_matrix(vectors)

    print("Similarity matrix (rows/cols = sentence index):")
    print("     " + "".join(f"{j:>7}" for j in range(len(SENTENCES))))
    for i, row in enumerate(sims):
        print(f"{i:>4} " + "".join(f"{v:7.2f}" for v in row))

    print("\nMost similar pair for each sentence:")
    for i, row in enumerate(sims):
        j = int(np.argsort(-row)[1])  # [0] is the sentence itself
        print(f"  [{i}] {SENTENCES[i]!r}\n      -> [{j}] {SENTENCES[j]!r} ({row[j]:.2f})")

    query = "what happens if I send too many API calls?"
    q = embedder.embed([query])[0]
    ranked = sorted(zip(vectors @ q, SENTENCES), reverse=True)
    print(f"\nSearch: {query!r}")
    for score, text in ranked[:3]:
        print(f"  {score:.3f}  {text}")
