# Day 28 - Cost and latency optimisation

**Goal:** make RAG cheap and fast enough for production without losing quality.

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
