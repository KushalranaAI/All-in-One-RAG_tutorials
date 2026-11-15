# Day 12 - Parent-document and sentence-window retrieval ("small-to-big")

**Goal:** search with *small* precise chunks, but give the LLM the *bigger* surrounding context.

## In everyday life

You are reading a rental agreement and press Ctrl+F for "deposit". It jumps to one line: "The deposit is refundable within 30 days." You almost stop there. But the next line says "unless the flat is damaged", and the line before explains which deposit it means. One line found the spot. You needed the whole clause to answer.

**Small-to-big retrieval** (search with small pieces, then hand over the bigger text around them) works the same way. Small chunks, even single sentences, give focused **embeddings** (numbers that stand for meaning), so search finds the exact spot. But the model needs the **parent** (the larger section a small piece came from) to see conditions and exceptions. So you index the small **children**, and when one matches, you return its parent. A **sentence window** version returns the matched sentence plus a few neighbours.

The price is more text per question, so you send more tokens. Unlike your own reading, the system decides in advance how big the bigger piece is, when you split the document.

**Where you meet it.** An insurance help assistant. A question about the waiting period for existing illnesses matches one sentence. Alone, that sentence misses the exceptions. With its parent paragraph, the answer states the rule and the exceptions together.

```scene
title: Ctrl+F in a rental agreement
step: 📑 The agreement is cut into small lines, each linked to its clause | Children linked to parents
step: 🙋 You search for the word deposit | User question
step: 📍 Search jumps to the single best line | Small child chunk matched
step: 📖 You read the whole clause around that line | Parent section returned
step: ✅ The exception in the next line changes your answer | LLM sees the full context
takeaway: Search with small pieces to find the spot, then read the bigger piece to understand it.
```

## The chunk-size dilemma
- Small chunks (1-3 sentences) → embeddings are focused → **better retrieval**.
- Big chunks (whole sections) → the LLM sees definitions, conditions and exceptions → **better answers**.

Small-to-big retrieval gets both: **index children, return parents**.

```
Section "Refunds" (parent, sent to Claude)
 ├─ child 1: "Monthly plans: refunds are available within 14 days..."   ◄── matched by search
 ├─ child 2: "Annual plans: a prorated refund is available within 60 days."
 └─ child 3: "Add-on usage is never refunded."
```

## Variants
| Variant | Retrieve | Return |
|---------|----------|--------|
| **Parent document** | child chunks | the parent section / document (deduplicated) |
| **Sentence window** | single sentences | sentence ± N neighbouring sentences |
| **Hierarchical / auto-merging** | leaf chunks | merge up to the parent when most of its children matched |
| **Summary index** | LLM summaries of docs | the full document behind the best summary |

## Run it
```bash
python days/day-12-parent-document-retrieval/small_to_big.py
```
It indexes sentence-level children, shows the matched child, and prints the parent that would be sent
to Claude.

## Exercises
1. Implement sentence-window retrieval with `window=1` and compare with parent retrieval.
2. Implement auto-merging: if ≥ 2 children of one parent are in the top-k, return the parent; otherwise
   return only the children.
3. How many tokens do you send per question with each approach?
