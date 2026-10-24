"""Run a literature-review agent over the arXiv MCP server and save review.md."""

import asyncio
import sys
from pathlib import Path

from rag_common.mcp_bridge import MCPServerSpec, run_mcp_agent

HERE = Path(__file__).resolve().parent
SYSTEM = """You are a research assistant writing a short literature review.
1. Search arXiv with 2-3 different phrasings of the topic.
2. Use search_library to find the most relevant abstracts.
3. Read the full text of at most 2 key papers for details.
4. Write a review in Markdown: overview, main approaches (grouped), key findings, open problems, and a
   reference list. Cite every claim as [arXiv:ID]. Only cite papers you actually retrieved."""

if __name__ == "__main__":
    topic = " ".join(sys.argv[1:]) or "contextual retrieval for retrieval-augmented generation"
    server = MCPServerSpec.python("arxiv", str(HERE / "arxiv_mcp_server.py"))
    review = asyncio.run(run_mcp_agent(f"Topic: {topic}", [server], system=SYSTEM, effort="high", max_turns=25))
    (HERE / "review.md").write_text(review)
    print(review, f"\n\nSaved to {HERE / 'review.md'}")
