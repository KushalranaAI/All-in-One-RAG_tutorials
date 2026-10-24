# Day 25 - Multimodal RAG: PDFs, images, charts and scans

**Goal:** answer questions over documents that aren't plain text - slides, scanned PDFs, diagrams,
screenshots, charts.

## Three strategies
| Strategy | How | Good for |
|----------|-----|----------|
| **Text extraction** | `pypdf` / OCR → text → normal RAG | text-heavy PDFs |
| **Caption-then-embed** | a vision model describes each image/page → embed the description → at answer time send the *original image* to Claude | charts, diagrams, slides |
| **Native multimodal** | send the whole PDF (or page images) directly to Claude: it reads text *and* visuals | small/medium docs, complex layouts |
| *(advanced)* multimodal embeddings | embed page images directly (ColPali, Voyage multimodal) | large visual corpora |

## Claude's native document and image input
```python
{"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}}
{"type": "image",    "source": {"type": "base64", "media_type": "image/png",       "data": b64}}
```
- PDFs: up to 600 pages / 32 MB per request; Claude sees both text and page images.
- Combine with `"citations": {"enabled": True}` on PDF documents to get page-level citations.
- For repeated questions over the same file, upload once with the **Files API** and reference the `file_id`.

## Run it
Put some PNG/JPG images (charts, diagrams, screenshots) and/or PDFs into `data/multimodal/`, then:
```bash
python days/day-25-multimodal-rag/multimodal_rag.py index                  # caption every image (once)
python days/day-25-multimodal-rag/multimodal_rag.py ask "What does the architecture diagram show?"
python days/day-25-multimodal-rag/multimodal_rag.py pdf path/to/file.pdf "Summarise the key numbers"
```

## Exercises
1. Render PDF pages to images (`pymupdf`) and caption each page - a "page-level" visual index.
2. Store captions *and* extracted text per page; fuse both in hybrid search.
3. Ask for page citations on a PDF and print the page numbers.
