"""Day 07: Claude's citations feature - structured, verifiable quotes from your documents."""

from rag_common import build_handbook_index, create

QUESTION = "What happens to my data after I cancel, and can I get a refund on a monthly plan?"

if __name__ == "__main__":
    hits = build_handbook_index().search(QUESTION, k=4)

    documents = [
        {
            "type": "document",
            "source": {"type": "text", "media_type": "text/plain", "data": hit.text},
            "title": hit.metadata["chunk_id"],
            "citations": {"enabled": True},
        }
        for hit in hits
    ]
    response = create(
        [{"role": "user", "content": [*documents, {"type": "text", "text": QUESTION}]}],
        system="Answer using only the provided documents.",
    )

    footnotes = []
    for block in response.content:
        if block.type != "text":
            continue
        print(block.text, end="")
        for citation in block.citations or []:
            footnotes.append(citation)
            print(f"[{len(footnotes)}]", end="")
    print("\n\nEvidence:")
    for i, c in enumerate(footnotes, 1):
        print(f"  [{i}] {c.document_title}: \"{c.cited_text.strip()}\"")
