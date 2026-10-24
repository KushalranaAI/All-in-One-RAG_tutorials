"""HTTP API: uvicorn enterprise_rag.api:app --app-dir projects/15-enterprise-rag-platform"""

from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from rag_common.mcp_bridge import MCPToolbox

from .config import SERVERS
from .orchestrator import Orchestrator
from .tracing import load_trace

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with MCPToolbox(SERVERS) as toolbox:  # MCP servers start once and stay connected
        state["orchestrator"] = Orchestrator(toolbox)
        yield


app = FastAPI(title="Enterprise RAG Platform", lifespan=lifespan)


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    role: Literal["customer", "employee"] = "customer"  # in production: derived from the authenticated user


@app.post("/chat")
async def chat(req: ChatRequest):
    return await state["orchestrator"].answer(req.message, session_id=req.session_id, role=req.role)


@app.get("/traces/{request_id}")
def trace(request_id: str):
    if (row := load_trace(request_id)) is None:
        raise HTTPException(404, "trace not found")
    return row


@app.get("/health")
def health():
    return {"status": "ok", "tools": len(state["orchestrator"].toolbox.tools)}
