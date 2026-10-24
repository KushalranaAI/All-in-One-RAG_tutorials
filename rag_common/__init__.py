"""Shared building blocks for the all-in-one RAG tutorials.

Week 1 of the course builds each of these pieces from scratch; later days and
all 15 projects import them from here so the code stays short.
"""

from .agents import Agent, run_parallel, tool
from .chunking import Chunk, chunk_by_headings, chunk_fixed, chunk_recursive
from .embeddings import HashingEmbedder, get_embedder
from .index import (
    HANDBOOK_DIR,
    INDEX_DIR,
    ROOT_DIR,
    build_handbook_index,
    handbook_chunks,
)
from .llm import (
    FAST_MODEL,
    MODEL,
    ask,
    create,
    parse,
    run_tool_loop,
    stream_text,
    text_of,
)
from .loaders import Document, load_directory
from .prompts import RAG_SYSTEM, format_context
from .retrieval import BM25, HybridIndex, reciprocal_rank_fusion
from .vectorstore import Hit, SimpleVectorStore

__all__ = [
    "Agent", "HybridIndex", "run_parallel", "stream_text", "tool",
    "BM25", "Chunk", "HANDBOOK_DIR", "INDEX_DIR", "ROOT_DIR", "build_handbook_index", "handbook_chunks", "Document", "FAST_MODEL", "HashingEmbedder", "Hit", "MODEL",
    "RAG_SYSTEM", "SimpleVectorStore", "ask", "chunk_by_headings", "chunk_fixed",
    "chunk_recursive", "create", "format_context", "get_embedder", "load_directory", "parse",
    "reciprocal_rank_fusion", "run_tool_loop", "text_of",
]
