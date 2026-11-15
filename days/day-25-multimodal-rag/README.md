# Day 25 - Multimodal RAG: PDFs, images, charts and scans

**Goal:** answer questions over documents that aren't plain text - slides, scanned PDFs, diagrams,
screenshots, charts.

## In everyday life

You photograph your electricity bill, a club notice and a chart from a class handout. A week later you try to find "the March bill" in your phone gallery. The search is useless, because a photo has no words for a computer to look up. It would work if you had written a short note on the back of each one.

That is the problem of **multimodal** documents (documents made of more than plain text: pictures, charts, scans, slides). A normal RAG system only handles text, so there are three ways around it. You can pull the words out of a scan with **OCR** (software that reads printed letters from an image). You can ask a **vision model** (an AI that can look at pictures) to write a **caption** (a one-line description) for each image, then search the captions. Or you can hand the whole PDF to Claude and let it read the text and the pictures together.

The caption method is like labelling a shoebox of bills: you search the labels, then open the original to read the actual number. Unlike a person, the model can describe a chart badly, so the caption only helps you find the page. The original image gives the answer.

**Where you meet it.** A finance team keeps years of scanned invoices and slide decks full of charts. Someone asks, "What did the Q3 revenue chart show?" A plain text search finds nothing, because the answer is a bar chart. Captions make the chart findable, and sending the original image lets Claude read the bars.

```scene
title: Labelling a shoebox of scanned bills
step: 🧾 You have a pile of scanned bills and charts with no text | Images and scanned PDFs
step: ✍️ A helper writes a one-line label on the back of each | Vision model captions
step: 🗂️ The labels are filed so they can be searched later | Embed the captions
step: 🙋 You ask for the March electricity bill | Question embedded and compared
step: 🔎 The best matching label points to one scan | Retrieve by caption
step: 👀 You pull out the original scan and read the number | Send original image to Claude
takeaway: Search with a text label, but answer from the original image.
```

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
