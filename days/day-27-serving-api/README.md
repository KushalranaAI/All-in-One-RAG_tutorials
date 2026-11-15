# Day 27 - Serving RAG as an API with streaming

**Goal:** turn your pipeline into a web service: a JSON endpoint, a streaming endpoint, and a tiny UI.

## In everyday life

Think of two restaurants. In the first, you order and stare at an empty table for ten minutes, then everything arrives together. In the second, the waiter takes your order, puts water down at once, and brings each dish as it is ready. The cooking takes equally long, but the second restaurant feels much faster.

Serving a RAG pipeline works the same way. An **API** (a doorway that other programs and web pages use to send a request to your code and get a reply) puts your pipeline behind a web address such as `/ask`. **Streaming** (sending the answer in small pieces as the model writes it, instead of in one lump) makes the first words appear in about a second. The browser receives the pieces through **Server-Sent Events** (a simple way for a server to keep pushing messages down one open connection). You also open the kitchen once in the morning, which means building the index at startup, not for every order.

Unlike a dish, an answer is written word by word, so it really can be served while it is unfinished.

**Where you meet it.** A company's internal help page with a chat box. If the page waits for the full answer, staff see a spinner for many seconds and think it is broken. With streaming, the sources appear first, then the answer types itself out, and people start reading right away.

```scene
title: A restaurant that serves as it cooks
step: 🍳 In the morning the kitchen prepares everything once | Build the index at startup
step: 🙋 A customer places an order at the counter | POST request to ask
step: 📋 The waiter shows which ingredients will be used | Sources event sent first
step: 🍽️ Dishes arrive one by one as they are ready | Text deltas streamed
step: 🔔 The waiter says that is everything | Done event
takeaway: Start showing the answer early, because waiting feels slower than the work really is.
```

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
