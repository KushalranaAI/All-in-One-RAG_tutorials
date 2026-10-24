"""Day 05: the same index in Chroma, a real (persistent, HNSW-backed) vector database."""

import chromadb

from rag_common import get_embedder, handbook_chunks


class ChromaEmbedding(chromadb.EmbeddingFunction):
    """Use the course embedder so results are comparable with SimpleVectorStore."""

    def __init__(self):
        self.embedder = get_embedder()

    def __call__(self, input):
        return self.embedder.embed(list(input)).tolist()


if __name__ == "__main__":
    client = chromadb.PersistentClient(path="chroma_db")  # a folder on disk; survives restarts
    collection = client.get_or_create_collection(
        "handbook", embedding_function=ChromaEmbedding(), metadata={"hnsw:space": "cosine"}
    )

    chunks = handbook_chunks()
    collection.upsert(
        ids=[c.metadata["chunk_id"] for c in chunks],
        documents=[c.text for c in chunks],
        metadatas=[{k: v for k, v in c.metadata.items() if isinstance(v, (str, int, float))} for c in chunks],
    )
    print(f"Collection has {collection.count()} chunks\n")

    result = collection.query(query_texts=["What are the API rate limits on Pro?"], n_results=3)
    for id_, dist, doc in zip(result["ids"][0], result["distances"][0], result["documents"][0]):
        print(f"  distance={dist:.3f}  {id_:<22} {doc[:60]!r}")

    filtered = collection.query(query_texts=["support"], n_results=2, where={"title": "product_faq"})
    print("\nFiltered to product_faq:", filtered["ids"][0])
