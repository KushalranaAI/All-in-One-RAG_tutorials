# Day 28 - Cost and latency optimisation

**Goal:** make RAG cheap and fast enough for production without losing quality.

## In everyday life

A clinic receptionist hears the same question all day: "What time does the doctor come?" She does not walk into the doctor's room each time. She keeps a sticky note with the answer. Harder questions go to the junior doctor, and only a serious case goes to the senior specialist. She also hands over just the relevant pages of a patient's file, not the whole cupboard.

That is **cost and latency** work in RAG. **Cost** is what you pay per call, counted in **tokens** (small pieces of text the model reads and writes, each one billed). **Latency** is how long the user waits. Most tokens are the retrieved text you send in, so the big savings come from sending less, from a **cache** (a saved answer reused when the same question comes again), and from **model routing** (sending easy questions to a small cheap model and hard ones to a big one).

Unlike the sticky note, a cache can match wrongly. A new question that only looks similar may get an old answer, so you tune how close the match must be.

**Where you meet it.** A product's help chatbot gets many near-identical questions like "how do I reset my password". Without these tricks, every one pays for a big model plus ten pasted pages. With a cache and a small model for simple questions, the bill and the wait drop, and hard questions still reach the strong model.

```scene
title: The receptionist who protects the doctor
step: 🙋 A patient asks what time the clinic opens | Incoming question
step: 🗒️ She checks her sticky notes for the same question | Semantic cache lookup
step: ✅ If she finds one, she answers and the doctor is never disturbed | Cache hit saves a model call
step: 👩‍⚕️ If not, easy cases go to the junior and hard ones to the senior | Model routing
step: 📄 She passes on only the relevant pages of the file | Send less context
step: 📊 She adds the cost to a daily tally sheet | Usage tracker
takeaway: Cheapest call is the one you skip, and the next cheapest sends less to a smaller model.
```

## Where the money and time go
`cost ≈ input_tokens × input_price + output_tokens × output_price`, per call, times calls per question.
In RAG, **input tokens dominate** (retrieved context), and agentic RAG multiplies the number of calls.

## The levers, in order of "free" to "trade-off"
| Lever | Saves | How |
|-------|-------|-----|
| **Prompt caching** | up to ~90% on repeated prefixes, lower latency | stable system prompt / documents first, `cache_control` (Day 13) |
| **Send less context** | input tokens | rerank and keep top 3 instead of 10; threshold low scores; smaller chunks |
| **Semantic cache** | whole calls | if a new question ≈ a previously answered one (cosine > threshold), return the cached answer |
| **Exact cache** | whole calls | hash(question + doc version) → answer |
| **Model routing** | price per token | Claude Haiku for rewriting, grading, simple FAQs; Opus for hard reasoning |
| **Effort** | output/thinking tokens | `output_config={"effort": "low"}` for simple tasks |
| **Batch API** | 50% | offline jobs: contextualising chunks, evals, nightly reports |
| **Streaming** | perceived latency | first token in ~1 s (Day 27) |
| **Parallel calls** | latency | run independent retrievals / sub-agents concurrently |

Always **measure** cost per *successful answer*, not per request: a cheap setup that answers wrong is expensive.

## Run it
```bash
python days/day-28-cost-latency/optimizations.py
```
Demonstrates a semantic cache, a Haiku/Opus router, and a usage tracker that prints token counts and
estimated dollars per question.

## Exercises
1. Put the semantic cache in front of the Day 27 API.
2. Find the best similarity threshold: too low returns wrong cached answers, too high never hits.
3. Re-run Day 14's eval with Haiku for generation. Is the quality drop acceptable for the savings?
