# Day 04 - Chunking strategies

**Goal:** split documents into pieces that are small enough to retrieve precisely and big enough to
make sense on their own.

## In everyday life

Before an exam, you turn a thick textbook chapter into flashcards. If each card holds a whole chapter, you cannot find the one fact you need. If each card holds half a sentence, like "It costs 79 rupees", you cannot tell what costs 79 rupees. A good card holds one idea, with just enough around it to make sense.

**Chunking** (cutting documents into pieces for search) is making those flashcards. A **chunk** is one piece. Each chunk gets its own **embedding** (numbers that stand for its meaning, from Day 02), so a chunk about one topic is easy to match with a question about that topic.

Good cutters follow the document. They split at headings and paragraph ends instead of every fixed number of characters. They let neighbouring chunks **overlap** (share a few lines) so an idea cut at the edge still appears whole in one of them. And they write the heading on top of every card, so "Pro plan" is never lost. Unlike paper cards, you can try several cutting styles on the same text and compare them.

**Where you meet it.** A 200-page company handbook that staff search by asking questions. With one giant piece per file, the answer to "how many leave days do I get?" is buried in noise. With chunks cut at headings and labelled with their section, the leave policy comes back on its own.

```scene
title: Turning a chapter into flashcards
step: 📖 You take one long chapter from the textbook | Long document
step: ✂️ You cut it at headings and paragraph ends, not mid-sentence | Structure-aware splitting
step: 🔁 You repeat a line or two at each cut so ideas do not break | Chunk overlap
step: 🏷️ You write the chapter and section name on top of each card | Heading path added to chunk
step: 🃏 Each card now stands on its own and can be found by its topic | Chunks ready to embed
takeaway: A good chunk holds one idea, small enough to find and big enough to understand alone.
```

## Why chunk at all?
- Embedding models have input limits and a single vector can't represent a 50-page PDF well.
- Retrieving a whole document wastes context and dilutes the relevant sentence.
- Smaller units → more precise retrieval → cheaper, more focused prompts.

But chunks that are **too small** lose context ("It costs $79" - *what* costs $79?).

## Strategies
| Strategy | How | Pros | Cons |
|----------|-----|------|------|
| **Fixed-size** | every N characters/tokens, with overlap | simple, predictable | cuts sentences and tables in half |
| **Recursive** | split on `\n\n`, then `\n`, then `. `, then spaces until pieces fit | respects natural boundaries | still unaware of document structure |
| **Structure-aware** | split on Markdown headings / HTML sections / PDF pages | chunks are coherent topics; keep the heading path | needs structured input |
| **Semantic** | start a new chunk where embedding similarity between sentences drops | topic-coherent chunks | slower, needs tuning |
| **Contextual** | prepend an LLM-written summary of where the chunk sits in the doc (Day 13) | big retrieval gains | costs an LLM call per chunk (cache it) |

## Rules of thumb
- Start with **300-800 tokens** (~1,200-3,000 chars) and **10-20% overlap**; tune with evaluation (Day 14).
- Prepend the **title / section path** to each chunk - cheap and very effective.
- Never split tables or code blocks mid-way if you can avoid it.

## Run it
```bash
python days/day-04-chunking/chunking_demo.py
```
It chunks `pricing.md` three ways and prints sizes and the first chunk of each, so you can see how
heading-aware chunks carry "Nimbus Cloud Pricing > Plans > Pro" with them.

## Exercises
1. Implement **semantic chunking**: split into sentences, embed each, start a new chunk when the cosine
   similarity between neighbours drops below a threshold.
2. Count tokens instead of characters (`client.messages.count_tokens`) and chunk by tokens.
3. Plot a histogram of chunk lengths across the whole handbook for each strategy.
