# Day 10 - Query transformation: multi-query, HyDE, decomposition

**Goal:** fix bad queries *before* retrieval. Users write short, vague or compound questions; your
documents are written differently.

## Techniques
| Technique | Idea | Helps when |
|-----------|------|-----------|
| **Rewrite** | clean up the question ("pls how cancel??" → "How do I cancel my subscription?") | messy chat input |
| **Multi-query** | generate 3-5 paraphrases, retrieve for each, fuse with RRF | vocabulary mismatch |
| **HyDE** (Hypothetical Document Embeddings) | ask the LLM to *write a fake answer*, embed that instead of the question | questions look nothing like answers |
| **Decomposition** | split a compound question into sub-questions, retrieve for each | "Compare X and Y", multi-hop |
| **Step-back** | ask a more general question first ("What is the refund policy?") | very specific questions |
| **Conversational rewrite** | turn "what about Pro?" into a standalone question using chat history (Day 24) | multi-turn chat |

All of them cost one extra (fast, cheap) LLM call - use `FAST_MODEL` (Claude Haiku) for these.

## Run it
```bash
python days/day-10-query-transformation/query_transform.py
```
Prints the generated queries and what each technique retrieves for a compound question.

## Exercises
1. Combine HyDE + original query in one RRF fusion.
2. Add a router: decide with one LLM call whether a question needs decomposition at all.
3. Evaluate each technique with the Day 14 harness - which wins on *your* data?
