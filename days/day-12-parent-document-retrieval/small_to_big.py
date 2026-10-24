"""Day 12: index small child chunks, retrieve them, and return their parent sections."""

import re

from rag_common import SimpleVectorStore, handbook_chunks


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [p.strip(" -*") for p in parts if len(p.strip()) > 15]


class ParentDocumentRetriever:
    def __init__(self):
        self.parents = {c.metadata["chunk_id"]: c for c in handbook_chunks(max_size=1500)}
        self.children = SimpleVectorStore()
        for parent_id, parent in self.parents.items():
            section = parent.metadata.get("section", "")
            body = parent.text.split("\n\n", 1)[-1]
            sentences = split_sentences(body)
            # Prefix each child with its section so even tiny chunks keep their topic.
            self.children.add([f"{section}: {s}" for s in sentences], [{"parent_id": parent_id} for _ in sentences])

    def search(self, query: str, k: int = 3):
        """Return up to k distinct parents, ordered by their best-matching child."""
        parents, seen = [], set()
        for hit in self.children.search(query, k=k * 4):
            pid = hit.metadata["parent_id"]
            if pid not in seen:
                seen.add(pid)
                parents.append((hit, self.parents[pid]))
            if len(parents) == k:
                break
        return parents


if __name__ == "__main__":
    retriever = ParentDocumentRetriever()
    print(f"{len(retriever.parents)} parents, {len(retriever.children)} children\n")

    for child, parent in retriever.search("Are add-ons refundable?", k=2):
        print(f"matched child ({child.score:.3f}): {child.text!r}")
        print(f"parent sent to the LLM [{parent.metadata['chunk_id']}]:\n{parent.text}\n" + "-" * 60)
