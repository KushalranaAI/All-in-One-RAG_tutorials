"""Core logic for the document chat assistant (shared by the Streamlit app and the CLI)."""

from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel

from rag_common import FAST_MODEL, RAG_SYSTEM, Chunk, HybridIndex, parse, stream_text
from rag_common.chunking import chunk_by_headings, chunk_recursive


def chunks_from_file(name: str, data: bytes) -> list[Chunk]:
    title = Path(name).stem
    if name.lower().endswith(".pdf"):
        import io

        from pypdf import PdfReader

        out = []
        for page_no, page in enumerate(PdfReader(io.BytesIO(data)).pages, 1):
            for piece in chunk_recursive(page.extract_text() or "", 1000):
                out.append(Chunk(piece, {"title": title, "page": page_no}))
    else:
        out = chunk_by_headings(data.decode("utf-8", errors="ignore"))
        for c in out:
            c.metadata["title"] = title
    for i, c in enumerate(out):
        c.metadata["chunk_id"] = f"{title}#{i}"
    return out


class Standalone(BaseModel):
    question: str


class DocChat:
    def __init__(self, files: list[tuple[str, bytes]]):
        chunks = [c for name, data in files for c in chunks_from_file(name, data)]
        if not chunks:
            raise ValueError("No text found in the uploaded files.")
        self.index = HybridIndex(chunks)
        self.history: list[dict] = []

    def standalone(self, question: str) -> str:
        if not self.history:
            return question
        recent = "\n".join(f"{m['role']}: {m['content'][:300]}" for m in self.history[-4:])
        return parse(
            f"{recent}\n\nRewrite this follow-up as a standalone question: {question}", Standalone, model=FAST_MODEL
        ).question

    def ask(self, question: str):
        """Returns (sources, generator of text deltas)."""
        sources = self.index.search(self.standalone(question), k=5)
        context = "\n\n".join(
            f'<source id="{i}" title="{c.metadata["title"]}"'
            + (f' page="{c.metadata["page"]}"' if "page" in c.metadata else "")
            + f">\n{c.text}\n</source>"
            for i, c in enumerate(sources, 1)
        )
        messages = self.history[-6:] + [{"role": "user", "content": f"<sources>\n{context}\n</sources>\n\n{question}"}]

        def generate():
            answer = ""
            for delta in stream_text(messages, system=RAG_SYSTEM):
                answer += delta
                yield delta
            self.history += [{"role": "user", "content": question}, {"role": "assistant", "content": answer}]

        return sources, generate()
