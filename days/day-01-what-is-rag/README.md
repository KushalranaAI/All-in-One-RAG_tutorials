# Day 01 - What is RAG and why does it exist?

**Goal:** understand the problem RAG solves and make your first Claude API call.

## In everyday life

Imagine your first day at a call centre for an internet provider. A customer asks, "What is the refund window on the annual plan?" You were hired yesterday, so you do not know. A good agent does not guess. She opens the policy binder, finds the right page, reads it, and then answers.

That is **RAG** (Retrieval-Augmented Generation: look up the relevant text first, then let the model write the answer from it). The **LLM** (large language model, the kind of AI that writes text, like Claude) plays the agent. It is clever and speaks well, but it only knows what it read during training. It has never seen your company's binder. Without a lookup it may produce a **hallucination** (a confident answer that is made up). The lookup is done by the **retriever** (the part that searches your documents and returns the best pieces).

Unlike a human agent, the model does not keep the page in its head after the chat ends, so the lookup runs again for every question.

**Where you meet it.** A bank's help chatbot that answers from the bank's own policy documents. Without RAG it answers from general knowledge and may quote a rule the bank does not follow. With RAG it first fetches the bank's current rule, so the reply matches the document and can point to it.

```scene
title: The new agent and the policy binder
step: 🙋 A customer asks a question the new agent cannot answer from memory | User question
step: 📚 The agent searches the binder for the pages that matter | Retriever finds top-k chunks
step: 📖 She reads those pages together with the question | Chunks added to the prompt
step: 🧠 She writes a reply using only what the pages say | LLM writes a grounded answer
step: 🔖 She tells the customer which page the rule came from | Answer with citations
takeaway: RAG lets the model look things up in your documents before it answers, instead of guessing from memory.
```

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
