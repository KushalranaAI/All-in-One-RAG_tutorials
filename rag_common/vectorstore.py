"""A tiny in-memory vector store (Day 05 builds it; Chroma is shown as the production option)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .embeddings import Embedder, get_embedder


@dataclass
class Hit:
    text: str
    metadata: dict
    score: float


class SimpleVectorStore:
    def __init__(self, embedder: Embedder | None = None):
        self.embedder = embedder or get_embedder()
        self.texts: list[str] = []
        self.metadatas: list[dict] = []
        self.vectors = np.zeros((0, self.embedder.dim), dtype=np.float32)

    def __len__(self) -> int:
        return len(self.texts)

    def add(self, texts: list[str], metadatas: list[dict] | None = None) -> None:
        if not texts:
            return
        metadatas = metadatas or [{} for _ in texts]
        self.vectors = np.vstack([self.vectors, self.embedder.embed(texts)])
        self.texts.extend(texts)
        self.metadatas.extend(metadatas)

    def search(self, query: str, k: int = 4, where: dict | None = None) -> list[Hit]:
        """Cosine similarity search. `where` filters on exact metadata matches."""
        if not self.texts:
            return []
        scores = self.vectors @ self.embedder.embed([query])[0]
        order = np.argsort(-scores)
        hits = []
        for i in order:
            meta = self.metadatas[i]
            if where and any(meta.get(key) != value for key, value in where.items()):
                continue
            hits.append(Hit(self.texts[i], meta, float(scores[i])))
            if len(hits) == k:
                break
        return hits

    def save(self, directory: str | Path) -> None:
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        np.save(directory / "vectors.npy", self.vectors)
        (directory / "records.json").write_text(json.dumps({"texts": self.texts, "metadatas": self.metadatas}))

    @classmethod
    def load(cls, directory: str | Path, embedder: Embedder | None = None) -> "SimpleVectorStore":
        directory = Path(directory)
        store = cls(embedder)
        records = json.loads((directory / "records.json").read_text())
        store.texts, store.metadatas = records["texts"], records["metadatas"]
        store.vectors = np.load(directory / "vectors.npy")
        return store
