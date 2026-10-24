# Project 04 - Support Reply Copilot

**Level:** intermediate · **Uses:** Days 08, 09, 11, 17 · **Stack:** structured outputs, hybrid search, LLM reranking, escalation

Paste a customer email; get a ready-to-send reply grounded in your help docs, a confidence score, and an
automatic escalation to a human when the copilot isn't sure (or the customer is upset).

```
email ─► triage (intent, urgency, sentiment, search queries)       [Claude Haiku, structured]
      ─► hybrid search per query ─► LLM rerank ─► top 4 chunks
      ─► draft reply {reply, cited_chunks, confidence, needs_human, reason}  [Claude Opus, structured]
      ─► guard: confidence < 0.7 or angry customer or refund > policy ─► escalation queue (JSONL)
```

## What it demonstrates
- **Structured outputs end to end** - triage and replies are Pydantic objects, not free text.
- **Multi-query retrieval** - triage writes the search queries.
- **Reranking** before generation.
- **Business rules outside the LLM** - the escalation decision combines model confidence with hard rules.

## Run
```bash
python projects/04-support-reply-copilot/copilot.py samples/refund.txt
python projects/04-support-reply-copilot/copilot.py samples/angry_outage.txt
echo "Do you support Go and can I use my own domain?" | python projects/04-support-reply-copilot/copilot.py -
```
Escalations are appended to `.rag_index/escalations.jsonl`.

## Extend it
- Connect to your helpdesk (Zendesk, Freshdesk) - or use the tickets MCP server (Project 13).
- Track agent edits to drafts and use them as evaluation data.
- Add multilingual replies: detect the language in triage and answer in it.
