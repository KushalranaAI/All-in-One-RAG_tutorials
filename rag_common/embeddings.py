"""Embedding models.

Claude does not produce embeddings, so we embed locally:

- `SentenceTransformerEmbedder` - real semantic embeddings (all-MiniLM-L6-v2 by default).
- `HashingEmbedder` - a dependency-free fallback (hashed word + character n-grams).
  It only captures lexical overlap, but it lets every lesson run without
  downloading a model.
"""

from __future__ import annotations

import hashlib
import re
from typing import Protocol

import numpy as np


class Embedder(Protocol):
    dim: int

    def embed(self, texts: list[str]) -> np.ndarray: ...


class HashingEmbedder:
    def __init__(self, dim: int = 1024):
        self.dim = dim

    def _features(self, text: str) -> list[str]:
        words = re.findall(r"[a-z0-9]+", text.lower())
        grams = [w[i : i + 4] for w in words for i in range(max(1, len(w) - 3))]
        bigrams = [f"{a}_{b}" for a, b in zip(words, words[1:])]
        return words + grams + bigrams

    def embed(self, texts: list[str]) -> np.ndarray:
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for row, text in enumerate(texts):
            for feat in self._features(text):
                h = int(hashlib.md5(feat.encode()).hexdigest(), 16)
                out[row, h % self.dim] += 1.0 if (h >> 64) & 1 else -1.0
        norms = np.linalg.norm(out, axis=1, keepdims=True)
        return out / np.maximum(norms, 1e-9)


class SentenceTransformerEmbedder:
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(model_name)
        self.dim = self.model.get_sentence_embedding_dimension()

    def embed(self, texts: list[str]) -> np.ndarray:
        return np.asarray(self.model.encode(texts, normalize_embeddings=True), dtype=np.float32)


_default: Embedder | None = None


def get_embedder() -> Embedder:
    """Best available embedder (cached). Set RAG_EMBEDDER=hashing to force the fallback."""
    global _default
    if _default is None:
        import os

        if os.getenv("RAG_EMBEDDER") == "hashing":
            _default = HashingEmbedder()
        else:
            try:
                _default = SentenceTransformerEmbedder()
            except Exception:  # not installed / offline
                _default = HashingEmbedder()
    return _default
