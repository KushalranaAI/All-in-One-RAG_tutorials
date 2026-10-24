"""Build a ready-to-query index of the sample handbook (used from Day 06 onward)."""

from __future__ import annotations

import os
from pathlib import Path

from .chunking import Chunk, chunk_by_headings
from .loaders import load_directory
from .vectorstore import SimpleVectorStore

ROOT_DIR = Path(__file__).resolve().parents[1]
HANDBOOK_DIR = ROOT_DIR / "data" / "company_handbook"
INDEX_DIR = Path(os.getenv("RAG_INDEX_DIR", ROOT_DIR / ".rag_index"))  # caches, saved indexes, traces


def handbook_chunks(max_size: int = 800, directory: str | Path = HANDBOOK_DIR) -> list[Chunk]:
    chunks: list[Chunk] = []
    for doc in load_directory(directory):
        for i, chunk in enumerate(chunk_by_headings(doc.text, max_size=max_size)):
            chunk.metadata.update(doc.metadata, chunk_id=f"{doc.metadata['title']}#{i}")
            chunks.append(chunk)
    return chunks


def build_handbook_index(max_size: int = 800, directory: str | Path = HANDBOOK_DIR) -> SimpleVectorStore:
    store = SimpleVectorStore()
    chunks = handbook_chunks(max_size, directory)
    store.add([c.text for c in chunks], [c.metadata for c in chunks])
    return store
