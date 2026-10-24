"""Day 08: dense vs. BM25 vs. hybrid (Reciprocal Rank Fusion) retrieval."""

from rag_common import BM25, SimpleVectorStore, handbook_chunks, reciprocal_rank_fusion


class HybridRetriever:
    def __init__(self, chunks):
        self.chunks = chunks
        self.ids = [c.metadata["chunk_id"] for c in chunks]
        self.dense = SimpleVectorStore()
        self.dense.add([c.text for c in chunks], [c.metadata for c in chunks])
        self.bm25 = BM25([c.text for c in chunks])

    def dense_ids(self, query, k):
        return [h.metadata["chunk_id"] for h in self.dense.search(query, k)]

    def bm25_ids(self, query, k):
        return [self.ids[i] for i, _ in self.bm25.search(query, k)]

    def search(self, query, k=4, candidates=20):
        fused = reciprocal_rank_fusion([self.dense_ids(query, candidates), self.bm25_ids(query, candidates)])
        return [doc_id for doc_id, _ in fused[:k]]


QUERIES = [
    "error 409",                          # exact code: BM25 shines
    "how do I get my money back",         # paraphrase: dense shines
    "SEV1 status page update frequency",
    "Mumbai region",
]

if __name__ == "__main__":
    r = HybridRetriever(handbook_chunks())
    for q in QUERIES:
        print(f"\nQuery: {q!r}")
        print(f"  dense : {r.dense_ids(q, 3)}")
        print(f"  bm25  : {r.bm25_ids(q, 3)}")
        print(f"  hybrid: {r.search(q, 3)}")
