# Day 27 - Serving RAG as an API with streaming

**Goal:** turn your pipeline into a web service: a JSON endpoint, a streaming endpoint, and a tiny UI.

## Endpoints
| Method | Path | Returns |
|--------|------|---------|
| `POST` | `/ask` `{"question": "..."}` | `{"answer", "sources": [{"id", "score"}], "latency_ms"}` |
| `GET`  | `/ask/stream?q=...` | **Server-Sent Events**: `sources` event, then text deltas, then `done` |
| `GET`  | `/` | a one-file HTML chat page using `EventSource` |
| `GET`  | `/health` | `{"status": "ok", "chunks": N}` |

## Why stream?
Users perceive latency as *time to first token*. Streaming starts showing the answer after ~1 s instead
of waiting for the whole response. With the SDK:
```python
with client.beta.messages.stream(...) as stream:
    for text in stream.text_stream:
        yield text
```
(`rag_common.stream_text` wraps this.)

## Production notes
- Build the index **once at startup** (FastAPI `lifespan`), not per request.
- The Anthropic client is thread-safe - share one instance.
- Send sources first so the UI can show them while the answer streams.
- Put auth, rate limiting and request ids in front of `/ask` (Day 29).

## Run it
```bash
pip install fastapi uvicorn
uvicorn app:app --app-dir days/day-27-serving-api --reload
# open http://localhost:8000  or:
curl -s localhost:8000/ask -H 'content-type: application/json' -d '{"question":"Which plan has SSO?"}'
curl -N "localhost:8000/ask/stream?q=How+do+refunds+work"
```

## Exercises
1. Add `/ask` request logging with a request id and latency.
2. Add a `top_k` query parameter with validation (1-10).
3. Deploy behind `gunicorn -k uvicorn.workers.UvicornWorker -w 4`.
