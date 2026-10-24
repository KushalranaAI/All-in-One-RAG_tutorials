"""Ask questions about a crawled site: python chat.py <domain> "question" """

import sys

from rag_common import (
    BM25,
    INDEX_DIR,
    SimpleVectorStore,
    ask,
    reciprocal_rank_fusion,
)

SYSTEM = """Answer from the provided documentation pages only. After each claim, cite the page as a
Markdown link like [Page title](url). If the pages don't answer the question, say so."""


def search(store: SimpleVectorStore, bm25: BM25, query: str, k: int = 5):
    dense = [str(i) for i, _ in sorted(enumerate(store.vectors @ store.embedder.embed([query])[0]), key=lambda x: -x[1])[:20]]
    sparse = [str(i) for i, _ in bm25.search(query, 20)]
    return [int(i) for i, _ in reciprocal_rank_fusion([dense, sparse])[:k]]


if __name__ == "__main__":
    domain, question = sys.argv[1], " ".join(sys.argv[2:])
    store = SimpleVectorStore.load(INDEX_DIR / domain)
    bm25 = BM25(store.texts)
    ids = search(store, bm25, question)
    context = "\n\n".join(
        f'<page title="{store.metadatas[i]["title"]}" url="{store.metadatas[i]["url"]}">\n{store.texts[i]}\n</page>' for i in ids
    )
    print(ask(f"{context}\n\nQuestion: {question}", system=SYSTEM))
