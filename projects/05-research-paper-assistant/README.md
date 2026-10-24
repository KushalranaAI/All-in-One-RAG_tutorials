# Project 05 - Research Paper Assistant (arXiv + MCP)

**Level:** intermediate · **Uses:** Days 16, 20, 21, 25 · **Stack:** arXiv API, MCP server, native PDF reading

An MCP server that lets Claude **search arXiv**, keep a **personal library** of papers, do **RAG over
the abstracts** it collected, and **read full PDFs** on demand. Use it from Claude Desktop / Claude Code,
or run the included literature-review agent.

| MCP tool | What it does |
|----------|--------------|
| `search_arxiv(query, max_results)` | queries the arXiv API, adds results to the library |
| `search_library(question, k)` | hybrid search over every abstract collected so far |
| `paper_details(arxiv_id)` | title, authors, date, abstract, links |
| `read_paper(arxiv_id, question)` | sends the full PDF to Claude (document block with a URL source) and answers the question |

```
literature_review.py "retrieval augmented generation evaluation"
   └─ agent ─► search_arxiv (several phrasings) ─► search_library ─► read_paper (top 2) ─► review.md with [arXiv:ID] citations
```

## Run
```bash
python projects/05-research-paper-assistant/literature_review.py "contextual retrieval for RAG"
claude mcp add arxiv -- python $PWD/projects/05-research-paper-assistant/arxiv_mcp_server.py
```
The library persists in `.rag_index/arxiv_library.json`.

## Extend it
- Add Semantic Scholar for citation counts and "papers that cite this".
- Cache `read_paper` answers per (paper, question).
- Generate a comparison table across papers with structured outputs.
