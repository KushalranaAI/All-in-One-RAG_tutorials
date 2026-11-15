# Day 10 - Query transformation: multi-query, HyDE, decomposition

**Goal:** fix bad queries *before* retrieval. Users write short, vague or compound questions; your
documents are written differently.

## In everyday life

A customer walks into a hardware shop and says, "That thing that stops the tap from dripping." A good assistant does not hunt the shelves for those exact words. She rewords it in her head: tap washer, O-ring, tap repair kit. She checks a shelf for each name. If the customer adds "and paint for the door", she splits it into two errands.

**Query transformation** (rewriting the user's question before searching) does this. People write short, vague or double-barrelled questions, while documents use formal words. **Multi-query** asks the model for several paraphrases and searches for each one. **HyDE** (Hypothetical Document Embeddings: have the model write a pretend answer, then search with that) works because an answer looks more like a document than a question does. **Decomposition** (splitting a compound question into parts) handles requests like "compare X and Y".

Unlike the assistant, the model can reword a question in a way that drifts from what the customer meant. So you measure whether a technique helps on your own data (Day 14).

**Where you meet it.** A telecom's help search. A customer types "pls how cancel??" while the documents say "Terminating your subscription". Rewriting to a clean question first lets the right page come up.

```scene
title: The shop assistant who rewords requests
step: 🙋 A customer asks for the thing that stops the tap dripping | Vague user query
step: 💬 The assistant rewords it as washer, O-ring and repair kit | Multi-query paraphrases
step: ✂️ A two-part request is split into two separate errands | Decomposition into sub-questions
step: 🔎 She checks the shelves for each reworded request | Retrieve for each query
step: 🧺 She puts the finds together and removes duplicates | Fuse results with RRF
takeaway: Fix the question before you search, because documents are not written the way people ask.
```

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
