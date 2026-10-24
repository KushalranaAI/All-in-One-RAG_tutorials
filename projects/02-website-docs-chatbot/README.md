# Project 02 - Website Docs Chatbot

**Level:** beginner+ · **Uses:** Days 03, 06, 07, 08 · **Stack:** requests, BeautifulSoup, hybrid search

Point it at a documentation site; it crawls the pages, builds an index on disk, and answers questions
with links to the exact pages it used.

```
crawl (BFS, same domain, max N pages) ─► clean HTML ─► chunk ─► embed ─► save to .rag_index/<site>
question ─► hybrid search ─► Claude ─► answer with [title](url) citations
```

## Run
```bash
python projects/02-website-docs-chatbot/crawl.py https://docs.python.org/3/tutorial/ --max-pages 40
python projects/02-website-docs-chatbot/chat.py docs.python.org "How do list comprehensions work?"
```

## Things this project teaches
- Polite crawling: same-domain only, URL normalisation, a page limit, a delay, a User-Agent.
  Respect `robots.txt` and the site's terms - only crawl sites you're allowed to.
- Removing boilerplate (nav, header, footer, scripts) before chunking.
- Persisting the index so chatting doesn't re-crawl.
- URL-level citations that users can click.

## Extend it
- Use the site's `sitemap.xml` instead of crawling.
- Re-crawl nightly and re-index only changed pages (Day 30 `refresh_index.py`).
- Expose the index as an MCP server (copy `mcp_servers/docs_server.py`).
