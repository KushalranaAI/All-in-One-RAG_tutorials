"""Offline smoke test: exercise every tool against a temporary copy of sample_notes."""

import asyncio
import shutil
import tempfile
from pathlib import Path

from mcp import Client
from notes_server import build_server


async def main():
    with tempfile.TemporaryDirectory() as tmp:
        shutil.copytree(Path(__file__).parent / "sample_notes", tmp, dirs_exist_ok=True)
        async with Client(build_server(Path(tmp))) as c:
            show = lambda r: print(r.content[0].text[:300], "\n")  # noqa: E731
            show(await c.call_tool("list_notes", {"tag": "rag"}))
            show(await c.call_tool("search_notes", {"query": "how to measure retrieval quality"}))
            show(await c.call_tool("related_notes", {"name": "vector-databases"}))
            show(await c.call_tool("create_note", {"title": "MCP ideas", "content": "Expose notes over MCP.", "tags": ["mcp"]}))
            show(await c.call_tool("search_notes", {"query": "expose notes", "tag": "mcp"}))
            dup = await c.call_tool("create_note", {"title": "MCP ideas", "content": "again"})
            print("duplicate refused:", dup.is_error)
            print("prompt:", (await c.get_prompt("weekly_review", {})).messages[0].content.text[:120])


if __name__ == "__main__":
    asyncio.run(main())
