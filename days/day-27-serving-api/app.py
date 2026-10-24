"""Day 27: FastAPI service with a JSON endpoint and a streaming (SSE) endpoint."""

import json
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel

from rag_common import RAG_SYSTEM, HybridIndex, ask, handbook_chunks, stream_text
from rag_common.prompts import format_context

state = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    state["index"] = HybridIndex(handbook_chunks())  # build once at startup
    yield


app = FastAPI(title="Nimbus RAG API", lifespan=lifespan)


class Question(BaseModel):
    question: str
    k: int = 4


def retrieve(question: str, k: int):
    chunks = state["index"].search(question, k=k)
    prompt = f"<sources>\n{format_context(_as_hits(chunks))}\n</sources>\n\nQuestion: {question}"
    return chunks, prompt


def _as_hits(chunks):
    from rag_common import Hit

    return [Hit(c.text, c.metadata, 0.0) for c in chunks]


@app.get("/health")
def health():
    return {"status": "ok", "chunks": len(state["index"].chunks)}


@app.post("/ask")
def ask_endpoint(q: Question):
    start = time.perf_counter()
    chunks, prompt = retrieve(q.question, q.k)
    answer = ask(prompt, system=RAG_SYSTEM)
    return {
        "answer": answer,
        "sources": [c.metadata["chunk_id"] for c in chunks],
        "latency_ms": round((time.perf_counter() - start) * 1000),
    }


@app.get("/ask/stream")
def ask_stream(q: str, k: int = 4):
    chunks, prompt = retrieve(q, k)

    def events():
        yield f"event: sources\ndata: {json.dumps([c.metadata['chunk_id'] for c in chunks])}\n\n"
        for delta in stream_text([{"role": "user", "content": prompt}], system=RAG_SYSTEM):
            yield f"data: {json.dumps(delta)}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@app.get("/", response_class=HTMLResponse)
def home():
    return """<!doctype html><meta charset=utf-8><title>Nimbus RAG</title>
<style>body{font:16px system-ui;max-width:720px;margin:40px auto;padding:0 16px}#a{white-space:pre-wrap}</style>
<h2>Ask the Nimbus handbook</h2><form id=f><input id=q size=60 autofocus> <button>Ask</button></form>
<p id=s style="color:#666"></p><div id=a></div>
<script>
f.onsubmit = e => { e.preventDefault(); a.textContent = ""; s.textContent = "";
  const es = new EventSource("/ask/stream?q=" + encodeURIComponent(q.value));
  es.addEventListener("sources", e => s.textContent = "Sources: " + JSON.parse(e.data).join(", "));
  es.onmessage = e => a.textContent += JSON.parse(e.data);
  es.addEventListener("done", () => es.close());
};
</script>"""
