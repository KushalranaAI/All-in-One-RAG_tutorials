"""Crawl a documentation site (same domain) and save a searchable index."""

import argparse
import json
import time
from collections import deque
from urllib.parse import urldefrag, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from rag_common import INDEX_DIR, SimpleVectorStore
from rag_common.chunking import chunk_recursive

HEADERS = {"User-Agent": "rag-tutorial-crawler/1.0 (+https://github.com/)"}


def crawl(start: str, max_pages: int, delay: float) -> list[dict]:
    domain, prefix = urlparse(start).netloc, start.rsplit("/", 1)[0]
    queue, seen, pages = deque([start]), {start}, []
    while queue and len(pages) < max_pages:
        url = queue.popleft()
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
        except requests.RequestException as exc:
            print(f"skip {url}: {exc}")
            continue
        if resp.status_code != 200 or "text/html" not in resp.headers.get("content-type", ""):
            continue
        soup = BeautifulSoup(resp.text, "html.parser")
        for a in soup.find_all("a", href=True):
            link = urldefrag(urljoin(url, a["href"]))[0]
            if urlparse(link).netloc == domain and link.startswith(prefix) and link not in seen:
                seen.add(link)
                queue.append(link)
        for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
            tag.decompose()
        main = soup.find("main") or soup.find("article") or soup.body or soup
        title = soup.title.get_text(strip=True) if soup.title else url
        pages.append({"url": url, "title": title, "text": main.get_text("\n", strip=True)})
        print(f"[{len(pages)}/{max_pages}] {title}")
        time.sleep(delay)
    return pages


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("--max-pages", type=int, default=30)
    parser.add_argument("--delay", type=float, default=0.5, help="seconds between requests")
    args = parser.parse_args()

    pages = crawl(args.url, args.max_pages, args.delay)
    store = SimpleVectorStore()
    for page in pages:
        pieces = chunk_recursive(page["text"], 1000)
        store.add([f"{page['title']}\n\n{p}" for p in pieces], [{"url": page["url"], "title": page["title"]} for _ in pieces])

    out = INDEX_DIR / urlparse(args.url).netloc
    store.save(out)
    (out / "pages.json").write_text(json.dumps([{k: p[k] for k in ("url", "title")} for p in pages], indent=1))
    print(f"\nSaved {len(store)} chunks from {len(pages)} pages to {out}")
