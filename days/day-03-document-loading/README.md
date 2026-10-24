# Day 03 - Loading documents (Markdown, PDF, web pages)

**Goal:** turn messy real-world files into clean text plus metadata.

## Why loading matters
"Garbage in, garbage out" applies doubly to RAG. If your loader keeps navigation menus, cookie banners,
page numbers or broken tables, those fragments get embedded and retrieved instead of real content.

## A document = text + metadata
```python
@dataclass
class Document:
    text: str
    metadata: dict   # {"source": "data/pricing.md", "title": "pricing", "page": 3, ...}
```
Metadata is what lets you **cite sources**, **filter** (Day 11) and **refresh** changed files.
Always keep at least `source`; add `title`, `page`, `url`, `updated_at`, `department`... as needed.

## Common sources and tools
| Source | Tool | Watch out for |
|--------|------|---------------|
| `.md` / `.txt` | `Path.read_text()` | encoding (use `utf-8`, `errors="ignore"`) |
| PDF | `pypdf` (simple), `pymupdf`, `unstructured`, or Claude's native PDF input (Day 25) | multi-column layouts, tables, scanned pages need OCR |
| HTML | `requests` + `BeautifulSoup` | strip `script/style/nav/footer` |
| Word / PowerPoint | `python-docx`, `python-pptx` | headers/footers repeated on every page |
| Databases / APIs | your own code | turn rows into readable sentences (Day 26) |

## Run it
```bash
python days/day-03-document-loading/load_docs.py
python days/day-03-document-loading/load_docs.py --url https://en.wikipedia.org/wiki/Retrieval-augmented_generation
python days/day-03-document-loading/load_docs.py --pdf path/to/file.pdf
```

## Cleaning checklist
- Collapse repeated whitespace and blank lines.
- Remove boilerplate that repeats on every page (headers, footers, legal text).
- Keep structure: headings and list markers help both chunking and the LLM.
- Deduplicate identical documents (hash the text).

## Exercises
1. Add `.html` support to `load_file` using BeautifulSoup.
2. Store a SHA-256 of each document's text in metadata, and skip re-indexing unchanged files.
3. Load a PDF one page at a time and keep `page` in metadata so answers can cite page numbers.
