"""Document loaders (Day 03)."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Document:
    text: str
    metadata: dict = field(default_factory=dict)


def load_file(path: str | Path) -> Document:
    path = Path(path)
    if path.suffix.lower() == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    else:
        text = path.read_text(encoding="utf-8", errors="ignore")
    return Document(text=text, metadata={"source": str(path), "title": path.stem})


def load_directory(path: str | Path, exts: tuple[str, ...] = (".md", ".txt", ".pdf")) -> list[Document]:
    return [load_file(p) for p in sorted(Path(path).rglob("*")) if p.suffix.lower() in exts]


def load_url(url: str) -> Document:
    import requests
    from bs4 import BeautifulSoup

    html = requests.get(url, timeout=30, headers={"User-Agent": "rag-tutorial/1.0"}).text
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    title = soup.title.string.strip() if soup.title and soup.title.string else url
    return Document(text=soup.get_text("\n", strip=True), metadata={"source": url, "title": title})
