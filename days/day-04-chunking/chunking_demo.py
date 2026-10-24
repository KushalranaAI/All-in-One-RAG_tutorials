"""Day 04: compare fixed-size, recursive and heading-aware chunking on the same document."""

from pathlib import Path

from rag_common.chunking import chunk_by_headings, chunk_fixed, chunk_recursive

DOC = Path(__file__).resolve().parents[2] / "data" / "company_handbook" / "pricing.md"


def show(name: str, chunks: list[str]) -> None:
    sizes = [len(c) for c in chunks]
    print(f"\n=== {name}: {len(chunks)} chunks, sizes {min(sizes)}-{max(sizes)} chars ===")
    print("First chunk:\n" + "-" * 40 + f"\n{chunks[0]}\n" + "-" * 40)
    print("Second chunk starts with:", repr(chunks[1][:70]) if len(chunks) > 1 else "-")


if __name__ == "__main__":
    text = DOC.read_text()
    print(f"Document: {DOC.name} ({len(text)} chars)")

    show("Fixed size (300 chars, 50 overlap)", chunk_fixed(text, size=300, overlap=50))
    show("Recursive (300 chars)", chunk_recursive(text, size=300))
    show("By headings", [c.text for c in chunk_by_headings(text, max_size=600)])
