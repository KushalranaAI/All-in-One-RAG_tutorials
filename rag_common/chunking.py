"""Chunking strategies (Day 04)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class Chunk:
    text: str
    metadata: dict = field(default_factory=dict)


def chunk_fixed(text: str, size: int = 800, overlap: int = 100) -> list[str]:
    """Fixed-size character windows with overlap."""
    if overlap >= size:
        raise ValueError("overlap must be smaller than size")
    step = size - overlap
    return [text[i : i + size] for i in range(0, max(len(text) - overlap, 1), step)]


def chunk_recursive(text: str, size: int = 800, separators: tuple[str, ...] = ("\n\n", "\n", ". ", " ")) -> list[str]:
    """Split on the largest natural boundary that keeps pieces under `size`, then pack."""
    if len(text) <= size:
        return [text.strip()] if text.strip() else []
    sep = next((s for s in separators if s in text), None)
    if sep is None:
        return chunk_fixed(text, size, 0)
    pieces: list[str] = []
    for part in text.split(sep):
        pieces.extend(chunk_recursive(part, size, separators) if len(part) > size else [part])
    chunks, current = [], ""
    for piece in pieces:
        candidate = f"{current}{sep}{piece}" if current else piece
        if len(candidate) <= size:
            current = candidate
        else:
            if current.strip():
                chunks.append(current.strip())
            current = piece
    if current.strip():
        chunks.append(current.strip())
    return chunks


def chunk_by_headings(markdown: str, max_size: int = 1200) -> list[Chunk]:
    """Split markdown by headings; each chunk remembers its section path."""
    chunks: list[Chunk] = []
    path: list[str] = []
    buf: list[str] = []

    def flush():
        body = "\n".join(buf).strip()
        if body:
            section = " > ".join(path)
            for piece in chunk_recursive(body, max_size):
                chunks.append(Chunk(text=f"{section}\n\n{piece}" if section else piece, metadata={"section": section}))
        buf.clear()

    for line in markdown.splitlines():
        m = re.match(r"^(#{1,6})\s+(.*)", line)
        if m:
            flush()
            level = len(m.group(1))
            path[:] = path[: level - 1] + [m.group(2).strip()]
        else:
            buf.append(line)
    flush()
    return chunks
