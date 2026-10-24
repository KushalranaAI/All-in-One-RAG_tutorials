"""Keyword search and rank fusion (Day 08)."""

from __future__ import annotations

import math
import re
from collections import Counter


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


class BM25:
    """Okapi BM25 over a list of texts."""

    def __init__(self, texts: list[str], k1: float = 1.5, b: float = 0.75):
        self.texts = texts
        self.k1, self.b = k1, b
        self.docs = [Counter(tokenize(t)) for t in texts]
        self.lengths = [sum(d.values()) for d in self.docs]
        self.avg_len = sum(self.lengths) / max(len(self.docs), 1)
        df = Counter(term for d in self.docs for term in d)
        n = len(self.docs)
        self.idf = {term: math.log(1 + (n - f + 0.5) / (f + 0.5)) for term, f in df.items()}

    def scores(self, query: str) -> list[float]:
        terms = tokenize(query)
        out = []
        for doc, length in zip(self.docs, self.lengths):
            s = 0.0
            for t in terms:
                if t in doc:
                    tf = doc[t]
                    s += self.idf[t] * tf * (self.k1 + 1) / (tf + self.k1 * (1 - self.b + self.b * length / self.avg_len))
            out.append(s)
        return out

    def search(self, query: str, k: int = 4) -> list[tuple[int, float]]:
        scored = sorted(enumerate(self.scores(query)), key=lambda x: -x[1])
        return [(i, s) for i, s in scored[:k] if s > 0]


def reciprocal_rank_fusion(rankings: list[list[str]], k: int = 60) -> list[tuple[str, float]]:
    """Merge several ranked lists of ids: score = sum(1 / (k + rank))."""
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: -x[1])


class HybridIndex:
    """Dense + BM25 search fused with RRF over a list of Chunk objects (Day 08, packaged)."""

    def __init__(self, chunks, embedder=None):
        from .vectorstore import SimpleVectorStore

        self.chunks = list(chunks)
        for i, c in enumerate(self.chunks):
            c.metadata.setdefault("chunk_id", f"chunk-{i}")
        self.by_id = {c.metadata["chunk_id"]: c for c in self.chunks}
        self.dense = SimpleVectorStore(embedder)
        self.dense.add([c.text for c in self.chunks], [c.metadata for c in self.chunks])
        self.bm25 = BM25([c.text for c in self.chunks])

    def search(self, query: str, k: int = 4, where: dict | None = None, candidates: int = 20):
        def ok(meta):
            return not where or all(meta.get(key) == value for key, value in where.items())

        dense = [h.metadata["chunk_id"] for h in self.dense.search(query, candidates, where=where)]
        sparse = [
            self.chunks[i].metadata["chunk_id"]
            for i, _ in self.bm25.search(query, candidates * 3)
            if ok(self.chunks[i].metadata)
        ][:candidates]
        return [self.by_id[i] for i, _ in reciprocal_rank_fusion([dense, sparse])[:k]]

    def search_text(self, query: str, k: int = 4, where: dict | None = None) -> str:
        """Search results formatted for an LLM: each passage prefixed by its id."""
        hits = self.search(query, k, where)
        return "\n\n".join(f"[{c.metadata['chunk_id']}]\n{c.text}" for c in hits) or "No results."
