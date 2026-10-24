"""Expose the whole platform as ONE MCP tool, so any MCP host can ask the company assistant."""

from contextlib import asynccontextmanager

from enterprise_rag.config import SERVERS
from enterprise_rag.orchestrator import Orchestrator
from mcp.server.mcpserver import MCPServer

from rag_common.mcp_bridge import MCPToolbox

state: dict = {}


@asynccontextmanager
async def lifespan(server):
    async with MCPToolbox(SERVERS) as toolbox:  # downstream MCP servers live as long as this server
        state["orchestrator"] = Orchestrator(toolbox)
        yield {}


mcp = MCPServer("company-assistant", instructions="Ask Nimbus Cloud's internal assistant.", lifespan=lifespan)


@mcp.tool()
async def ask_company_assistant(question: str, session_id: str = "mcp") -> str:
    """Ask the company assistant. It researches policies, live business data and customer tickets with a team of agents."""
    result = await state["orchestrator"].answer(question, session_id=session_id, role="employee")
    return result["answer"]


if __name__ == "__main__":
    mcp.run()
