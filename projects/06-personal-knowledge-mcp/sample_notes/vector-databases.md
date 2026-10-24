# Vector databases
#rag #infrastructure

Notes from comparing Chroma, Qdrant and pgvector. HNSW is the default index almost everywhere.
pgvector is attractive because we already run Postgres - see [[RAG evaluation]] for how we'd measure it.
Brute force numpy search is fine below ~100k vectors.
