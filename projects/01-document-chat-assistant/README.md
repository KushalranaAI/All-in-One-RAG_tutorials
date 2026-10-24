# Project 01 - Document Chat Assistant (PDF / Markdown / text)

**Level:** beginner · **Uses:** Days 03-08, 27 · **Stack:** Streamlit, hybrid search, streaming, citations

Upload your own files and chat with them. Every answer streams in and cites the passages it used,
which you can expand to verify.

```
upload ─► load (pypdf / text) ─► chunk by headings/pages ─► HybridIndex (dense + BM25)
question ─► hybrid top-k ─► prompt with numbered sources ─► Claude (streamed) ─► answer [1][2] + source panel
```

## Features
- PDF (page-level metadata), Markdown and text files
- Hybrid retrieval (BM25 + embeddings, RRF fusion)
- Streaming answers with `st.write_stream`
- Clickable source panel showing the exact chunks used
- Conversation history with follow-up rewriting

## Run
```bash
pip install streamlit pypdf
streamlit run projects/01-document-chat-assistant/app.py
# no browser? use the CLI version:
python projects/01-document-chat-assistant/cli.py data/company_handbook "What does the Pro plan include?"
```

## Extend it
- Persist indexes per upload (hash the files) so re-opening is instant.
- Use Claude's native PDF input for scanned PDFs (Day 25).
- Add a "summarise this document" button with a map-reduce summary.
