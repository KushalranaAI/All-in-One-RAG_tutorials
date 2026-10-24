"""arXiv search, a persistent paper library, and full-PDF question answering."""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET

import requests

from rag_common import INDEX_DIR, Chunk, HybridIndex, create, text_of

LIBRARY = INDEX_DIR / "arxiv_library.json"
ATOM = {"a": "http://www.w3.org/2005/Atom"}


class PaperLibrary:
    def __init__(self):
        self.papers: dict[str, dict] = json.loads(LIBRARY.read_text()) if LIBRARY.exists() else {}
        self._index: HybridIndex | None = None

    def save(self) -> None:
        LIBRARY.parent.mkdir(exist_ok=True)
        LIBRARY.write_text(json.dumps(self.papers, indent=1))
        self._index = None  # rebuild lazily

    def search_arxiv(self, query: str, max_results: int = 8) -> str:
        resp = requests.get(
            "https://export.arxiv.org/api/query",
            params={"search_query": f"all:{query}", "max_results": min(max_results, 20), "sortBy": "relevance"},
            timeout=30,
        )
        resp.raise_for_status()
        found = []
        for entry in ET.fromstring(resp.text).findall("a:entry", ATOM):
            arxiv_id = entry.findtext("a:id", "", ATOM).rsplit("/abs/", 1)[-1]
            paper = {
                "id": arxiv_id,
                "title": " ".join(entry.findtext("a:title", "", ATOM).split()),
                "authors": [a.findtext("a:name", "", ATOM) for a in entry.findall("a:author", ATOM)],
                "published": entry.findtext("a:published", "", ATOM)[:10],
                "abstract": " ".join(entry.findtext("a:summary", "", ATOM).split()),
                "pdf": f"https://arxiv.org/pdf/{arxiv_id}",
            }
            self.papers[arxiv_id] = paper
            found.append(paper)
        self.save()
        return "\n".join(f"[arXiv:{p['id']}] {p['title']} ({p['published']})" for p in found) or "No results."

    def index(self) -> HybridIndex:
        if self._index is None:
            chunks = [
                Chunk(f"{p['title']}\n\n{p['abstract']}", {"chunk_id": f"arXiv:{pid}"}) for pid, p in self.papers.items()
            ]
            self._index = HybridIndex(chunks or [Chunk("empty library", {"chunk_id": "none"})])
        return self._index

    def search_library(self, question: str, k: int = 5) -> str:
        return self.index().search_text(question, k=k)

    def paper_details(self, arxiv_id: str) -> str:
        if arxiv_id not in self.papers:
            raise KeyError(f"{arxiv_id} is not in the library - search for it first")
        return json.dumps(self.papers[arxiv_id], indent=1)

    def read_paper(self, arxiv_id: str, question: str) -> str:
        if arxiv_id not in self.papers:
            raise KeyError(f"{arxiv_id} is not in the library - search for it first")
        response = create([{"role": "user", "content": [
            {"type": "document", "source": {"type": "url", "url": self.papers[arxiv_id]["pdf"]}},
            {"type": "text", "text": f"From this paper, answer concisely with page references: {question}"},
        ]}])
        return text_of(response)
