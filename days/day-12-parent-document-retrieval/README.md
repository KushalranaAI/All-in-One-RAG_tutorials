# Day 12 - Parent-document and sentence-window retrieval ("small-to-big")

**Goal:** search with *small* precise chunks, but give the LLM the *bigger* surrounding context.

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
