"""Day 20: smoke-test the docs server in-process (no API key needed)."""

import asyncio

from mcp import Client
from rag_mcp_server import build_server


async def main():
    async with Client(build_server()) as client:
        print("tools:", [t.name for t in (await client.list_tools()).tools])
        print((await client.call_tool("list_documents", {})).content[0].text, "\n")
        result = await client.call_tool("search_docs", {"query": "refund annual plan", "k": 2})
        print(result.content[0].text[:400], "...\n")
        bad = await client.call_tool("get_document", {"title": "nope"})
        print("error handling ->", bad.is_error, bad.content[0].text[:80])


if __name__ == "__main__":
    asyncio.run(main())
