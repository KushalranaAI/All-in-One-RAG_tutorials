# Day 01 - What is RAG and why does it exist?

**Goal:** understand the problem RAG solves and make your first Claude API call.

## The problem
A large language model (LLM) like Claude knows a lot, but only what was in its training data. It does
**not** know:
- your company's private documents (pricing, policies, runbooks),
- anything that happened after its training cutoff,
- facts that change often (stock, prices, tickets).

Ask it anyway and it either says "I don't know" or, worse, invents a plausible answer (a *hallucination*).

## The idea: Retrieval-Augmented Generation
Instead of hoping the model memorised your data, **look up the relevant text first and give it to the
model with the question**.

```
             ┌──────────────┐   top-k chunks   ┌──────────────┐
question ───►│  Retriever   │─────────────────►│     LLM      │───► grounded answer
             │ (search your │                  │ (reads the   │     with citations
             │  documents)  │                  │  sources)    │
             └──────────────┘                  └──────────────┘
```

RAG has two phases:

| Phase | When | Steps |
|-------|------|-------|
| **Indexing** (offline) | once, or when docs change | load → chunk → embed → store in a vector DB |
| **Querying** (online)  | every question | embed question → retrieve top-k chunks → prompt the LLM → answer |

You will build each box over the next six days, then make every box smarter in weeks 2-4.

## RAG vs. alternatives
| Approach | Good for | Weak at |
|----------|----------|---------|
| Prompt stuffing (paste all docs) | a few small docs | cost and latency grow with every doc; context limits |
| Fine-tuning | style, format, narrow skills | adding *facts*; updating data means retraining |
| **RAG** | large, private, changing knowledge | needs a good retriever |

Modern Claude models have a 1M-token context window, so stuffing works for small corpora - and it's a
fine baseline. RAG wins once you have more documents than you want to pay for on every request, or you
need citations and freshness.

## Run it
```bash
pip install -r requirements.txt && pip install -e .   # once, from the repo root
export ANTHROPIC_API_KEY=sk-ant-...                    # or put it in .env
python days/day-01-what-is-rag/hello_claude.py
```
The script asks the same question three ways:
1. **No context** - Claude can't know a fictional company's refund window.
2. **Wrong context** - it should refuse rather than guess.
3. **Right context** - the correct answer, citing the document. That's RAG in miniature.

## Key API concepts
- `client.messages.create(model=..., max_tokens=..., messages=[...])` - one request, one response.
- `system=` - instructions that frame the whole conversation.
- `response.content` - a list of blocks; read the ones where `block.type == "text"`.
- `output_config={"effort": "low"|"medium"|"high"}` - how hard the model thinks (cost vs. quality).

## Exercises
1. Change the question to something about pricing and paste `pricing.md` as context.
2. Remove the "say I don't know" rule from the system prompt. Does the no-context answer change?
3. Print `response.usage` and note input vs. output tokens - you'll care about this on Day 28.
