# Day 07 - Prompt engineering for RAG and built-in citations

**Goal:** get answers that are grounded, cite their sources, and admit when they don't know.

## In everyday life

At school, a teacher hands you three printed pages and a worksheet. The rules say: answer only from these pages, write the page number after each answer, and if the pages do not say, write "not covered". You follow the rules, and the teacher can check any answer in seconds by turning to that page.

A good **RAG prompt** (the message you send the model, holding the question and the retrieved text) gives Claude the same rules. The pages are the **sources**, numbered and wrapped in tags so the model can tell where one ends. The "only from these pages" rule is the **grounding rule** (an instruction to answer only from the supplied text). The page numbers are **citations** (pointers from each claim to the source that backs it). The "not covered" rule is an escape hatch that stops the model from inventing.

Claude can also return **native citations** (structured references that quote the exact sentence from your document). Unlike a careful student, a model given a plain prompt can still write a wrong page number, so you check the ids or use native citations.

**Where you meet it.** An HR assistant that answers leave questions. Without clear rules it mixes company policy with general internet advice, and nobody can check it. With a grounded, cited prompt, each answer points to a policy paragraph that a reviewer can open.

```scene
title: The worksheet with strict rules
step: 📄 The teacher hands out three numbered pages | Numbered sources in tags
step: 📝 The rules say to answer only from these pages | Grounding rule
step: ✍️ You write each answer with a page number after it | Citation format
step: 🤷 For a question the pages skip, you write not covered | Escape hatch for unknown answers
step: 🔍 The teacher turns to the page and checks the quote | Verify citations
takeaway: Clear rules in the prompt make answers grounded, checkable, and honest when the sources are silent.
```

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
