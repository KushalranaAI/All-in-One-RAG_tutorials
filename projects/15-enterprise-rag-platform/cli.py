"""Ask the platform from the terminal."""

import argparse
import asyncio
import json

from enterprise_rag.config import SERVERS
from enterprise_rag.orchestrator import Orchestrator
from enterprise_rag.tracing import load_trace

from rag_common.mcp_bridge import MCPToolbox


async def main(question: str, role: str) -> None:
    async with MCPToolbox(SERVERS) as toolbox:
        result = await Orchestrator(toolbox).answer(question, role=role)
    print(f"\nagents: {result['agents']}\n\n{result['answer']}\n")
    print("trace:", json.dumps(load_trace(result["request_id"])["steps"], indent=1)[:1500])


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("question", nargs="+")
    parser.add_argument("--role", choices=["customer", "employee"], default="employee")
    args = parser.parse_args()
    asyncio.run(main(" ".join(args.question), args.role))
