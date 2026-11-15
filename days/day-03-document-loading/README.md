# Day 03 - Loading documents (Markdown, PDF, web pages)

**Goal:** turn messy real-world files into clean text plus metadata.

## In everyday life

Think of the evening before you file your income tax. The papers are everywhere: a bank statement PDF, a photo of a salary slip, a few emailed receipts, a Word note from your accountant. Before anyone can use them, someone must open each one, copy out the useful words, and write on a sticky note where it came from.

**Document loading** (reading files of many kinds and turning them into plain text) is that job for a RAG system. Each file becomes a **Document**: the text itself plus **metadata** (small labels about the text, such as file name, page number and date). The labels matter later. They let the system say "this came from page 3 of the statement" and notice when a file has changed.

Loading also means cleaning. A PDF brings page numbers and repeated headers, and a web page brings menus and cookie banners. If that junk goes in, it gets searched and quoted later. You can see at a glance what is junk on your desk. The program cannot, so you write the cleaning rules.

**Where you meet it.** A company help desk that wants to answer from old PDFs, wiki pages and Word files. If the loader keeps the cookie banner and page footers, search results fill up with that noise, and answers cannot name a source. A careful loader keeps clean text and a source label for every file.

```scene
title: Sorting papers before tax filing
step: 🗂️ You gather files of different kinds from different places | Sources: PDF, web, Markdown
step: 📄 You open each file with the right tool and copy out its words | Loader extracts the text
step: 🧹 You throw away page numbers, headers and banners | Cleaning boilerplate
step: 🏷️ You stick a note on each file with its name and page | Metadata: source and page
step: ✅ You skip a file that you already processed and did not change | Deduplicate and refresh
takeaway: Clean text with a source label on every piece is the base that everything later in RAG stands on.
```

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
