# Day 24 - Memory and conversational RAG

**Goal:** build a chatbot that handles follow-ups ("and on Pro?") and remembers things about the user.

## In everyday life

You walk up to your usual chai stall and say, "Same as yesterday, but less sugar." The owner does not ask what "same" means. He remembers yesterday's cup and the one you ordered a minute ago. Then you ask, "And the bigger cup?" He knows you mean the bigger masala chai, so he checks the price board.

A chatbot has none of this by default. It reads each message alone, so "And on Pro?" means nothing to it. The fix has two parts. First, **condense** (rewrite a follow-up using the earlier chat so it can stand on its own). "And on Pro?" becomes "How long are backups kept on the Pro plan?", and now the search works. Second, **memory** (what the bot keeps between messages). **Short-term memory** is the last few turns of the chat. **Long-term memory** is a fact saved about you, like "I am on the Pro plan", which the bot looks up again in later chats.

Unlike the chai seller, the bot remembers only what your code saves and sends back to it each time.

**Where you meet it.** A software company's support chat. A customer asks about backups on the Starter plan, then types "and on Pro?". Without rewriting, the search returns random pages and the bot asks the customer to repeat the question. With it, the bot answers at once, and next week it already knows the customer's plan.

```scene
title: The chai stall that remembers you
step: 🙋 You ask "And the bigger cup?" with no mention of chai | Follow-up question
step: 🧠 The owner recalls what you two just talked about | Short-term memory, recent turns
step: ✏️ In his head it becomes "price of a big masala chai" | Condense into a standalone query
step: 📋 He reads that exact item off the price board | Retrieve from documents
step: 📒 He notes that you always want less sugar for next time | Long-term memory saved
takeaway: A follow-up only makes sense with the chat around it, so rewrite it before you search.
```

## Problem 1: follow-up questions
Turn 1: "How long are backups kept on Starter?" → Turn 2: "**And on Pro?**"
Searching for "And on Pro?" retrieves nothing useful. Fix: **condense** the question with the chat
history into a standalone query before retrieval:
```
history + "And on Pro?"  ──fast LLM──►  "How long are backups kept on the Pro plan?"  ──► retrieve
```

## Problem 2: memory
| Memory type | What | Implementation |
|-------------|------|----------------|
| **Short-term** | the current conversation | send the last N turns |
| **Summary** | older turns, compressed | summarise when the history gets long (or use the API's compaction feature) |
| **Long-term** | facts about the user across sessions ("I'm on the Pro plan", "I prefer short answers") | extract facts with an LLM → store in a vector store → retrieve relevant memories each turn |

Long-term memory is *RAG over the user's own history*. Production options: Claude's memory tool
(`memory_20250818`), Mem0, Zep, or a table in your database.

## Run it
```bash
python days/day-24-memory-conversational-rag/chat.py          # interactive
python days/day-24-memory-conversational-rag/chat.py --demo   # scripted 4-turn conversation
```
In the demo, notice the rewritten queries and that the bot later remembers the user's plan.

## Exercises
1. Persist long-term memories to disk per user id.
2. Summarise history once it exceeds 6 turns; keep only the summary + last 2 turns.
3. Let the user say "forget that" - delete matching memories.
