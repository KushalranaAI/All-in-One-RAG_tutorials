# Day 07 - Prompt engineering for RAG and built-in citations

**Goal:** get answers that are grounded, cite their sources, and admit when they don't know.

## A good RAG prompt has five parts
1. **Role & task** - "You answer questions about Nimbus Cloud using the provided sources."
2. **Sources, clearly delimited** - XML tags like `<source id="1" title="...">` work very well with Claude.
3. **Grounding rule** - "Use only the sources. If they don't contain the answer, say so."
4. **Citation format** - "Cite like [1]." Numbered sources make this easy to verify.
5. **Output format** - length, bullet points, JSON...

Put long documents **before** the question - models attend well to instructions at the end.

## Common failure modes and fixes
| Symptom | Fix |
|---------|-----|
| Answers from general knowledge, not the docs | explicit "only from the sources" rule + an "I don't know" escape hatch |
| Ignores a relevant source | fewer, better chunks (rerank, Day 09); put the best one last or first |
| Made-up citations | numbered sources; verify cited ids exist (see `verify_citations`) |
| Rambling | specify length/format; lower `effort` |

## Claude's built-in citations
Instead of asking for `[1]` markers in text, pass sources as **document blocks** with
`"citations": {"enabled": True}`. Claude returns text blocks that carry structured `citations`:
the exact `cited_text`, the `document_title`, and character offsets. You can render footnotes or
highlight the evidence - and the quotes are guaranteed to come from your documents.

```python
{"type": "document",
 "source": {"type": "text", "media_type": "text/plain", "data": chunk_text},
 "title": "refund_policy",
 "citations": {"enabled": True}}
```

## Run it
```bash
python days/day-07-prompting-and-citations/compare_prompts.py   # naive vs. engineered prompt
python days/day-07-prompting-and-citations/native_citations.py  # structured citations API
```

## Exercises
1. Ask the engineered prompt for JSON: `{"answer": ..., "sources": [ids], "confidence": "high|low"}`.
2. Write a test that fails if an answer cites a source id that wasn't provided.
3. With native citations, print each claim followed by its quoted evidence.
