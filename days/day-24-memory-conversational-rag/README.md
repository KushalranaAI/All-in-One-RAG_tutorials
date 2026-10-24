# Day 24 - Memory and conversational RAG

**Goal:** build a chatbot that handles follow-ups ("and on Pro?") and remembers things about the user.

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
