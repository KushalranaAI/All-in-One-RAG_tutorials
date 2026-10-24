"""Day 05: our numpy vector store - add, search, filter by metadata, save and reload."""

import tempfile

from rag_common import SimpleVectorStore, handbook_chunks

if __name__ == "__main__":
    chunks = handbook_chunks()
    store = SimpleVectorStore()
    store.add([c.text for c in chunks], [c.metadata for c in chunks])
    print(f"Indexed {len(store)} chunks with {type(store.embedder).__name__}\n")

    query = "Is my data encrypted?"
    print(f"Query: {query}")
    for hit in store.search(query, k=3):
        print(f"  {hit.score:.3f}  {hit.metadata['chunk_id']:<20} {hit.text[:60]!r}")

    print("\nSame query, filtered to title='pricing':")
    for hit in store.search(query, k=2, where={"title": "pricing"}):
        print(f"  {hit.score:.3f}  {hit.metadata['chunk_id']}")

    with tempfile.TemporaryDirectory() as tmp:
        store.save(tmp)
        reloaded = SimpleVectorStore.load(tmp, embedder=store.embedder)
        print(f"\nSaved and reloaded: {len(reloaded)} chunks; top hit = {reloaded.search(query, 1)[0].metadata['chunk_id']}")
