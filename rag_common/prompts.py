"""Prompt templates shared across lessons (Day 07)."""

from __future__ import annotations

from .vectorstore import Hit

RAG_SYSTEM = """You answer questions using only the provided sources.

Rules:
- Base every claim on the sources. Cite them inline like [1] or [2][3].
- If the sources do not contain the answer, say "I don't know based on the provided documents."
  and briefly say what is missing. Do not guess.
- Be concise and direct."""


def format_context(hits: list[Hit]) -> str:
    """Number each retrieved chunk so the model can cite it."""
    blocks = []
    for i, hit in enumerate(hits, 1):
        source = hit.metadata.get("title") or hit.metadata.get("source", "unknown")
        blocks.append(f'<source id="{i}" title="{source}">\n{hit.text}\n</source>')
    return "\n\n".join(blocks)


def rag_user_prompt(question: str, hits: list[Hit]) -> str:
    return f"<sources>\n{format_context(hits)}\n</sources>\n\nQuestion: {question}"
