# Day 13 - Contextual retrieval and prompt caching

**Goal:** make every chunk self-explanatory by prepending LLM-written context, and use prompt caching
to make that cheap.

## The problem: chunks lose their context
A chunk that says *"Daily backups are kept for 7 days on Starter, 30 days on Pro..."* is fine. But
*"Price: $79 per month"* doesn't say **which plan** or **which company**. Its embedding can't match
"how much is Nimbus Pro?" well.

## Contextual retrieval (Anthropic, 2024)
For each chunk, ask a fast model: *"Here is the whole document. Here is a chunk. Write 1-2 sentences
situating this chunk within the document."* Then embed (and BM25-index) `context + chunk`.

```
Before: "- Price: $79 per month, or $790 per year (two months free)."
After:  "This chunk describes the price of the Nimbus Cloud Pro plan, the mid-tier plan.
         - Price: $79 per month, or $790 per year (two months free)."
```
Anthropic reported this cut retrieval failures by ~35% (embeddings), ~49% with contextual BM25, and
~67% when adding reranking.

## Prompt caching makes it affordable
Every chunk of a document repeats the same long prefix (the whole document). Mark it with
`cache_control` and the API caches it: later requests read the prefix at a fraction of the price and
with lower latency.

```python
content = [
    {"type": "text", "text": f"<document>{doc}</document>", "cache_control": {"type": "ephemeral"}},
    {"type": "text", "text": f"<chunk>{chunk}</chunk> Situate this chunk..."},   # varies per chunk
]
```
- Stable content first, varying content last - caching is a **prefix match**.
- Check `response.usage.cache_creation_input_tokens` and `cache_read_input_tokens`.
- Prefixes below the model's minimum cacheable length (~1-4k tokens) are not cached - our sample docs
  are small, so you'll see caching kick in with real, longer documents.

## Run it
```bash
python days/day-13-contextual-retrieval/contextualize.py
```
It contextualises every chunk with Claude Haiku, then compares hit-rate on `data/eval_set.json` with and
without context.

## Exercises
1. Also build contextual BM25 and fuse it with contextual dense search (Day 08).
2. Save the contextualised chunks to disk so you only pay once.
3. Use the Message Batches API (50% cheaper) to contextualise a large corpus offline.
