"""Day 13: contextual retrieval - prepend LLM-written context to each chunk (with prompt caching)."""

import json

from rag_common import (
    FAST_MODEL,
    HANDBOOK_DIR,
    ROOT_DIR,
    SimpleVectorStore,
    create,
    handbook_chunks,
    text_of,
)

PROMPT = (
    "Here is a chunk from the document above:\n<chunk>\n{chunk}\n</chunk>\n"
    "Write one or two short sentences that situate this chunk within the overall document, to improve "
    "search retrieval of the chunk. Answer only with the context."
)


def contextualize(document: str, chunk: str) -> tuple[str, dict]:
    response = create(
        [{
            "role": "user",
            "content": [
                # Same for every chunk of this document -> cached after the first call.
                {"type": "text", "text": f"<document>\n{document}\n</document>", "cache_control": {"type": "ephemeral"}},
                {"type": "text", "text": PROMPT.format(chunk=chunk)},
            ],
        }],
        model=FAST_MODEL,
        max_tokens=300,
        effort="low",
    )
    u = response.usage
    return text_of(response), {"cache_write": u.cache_creation_input_tokens or 0, "cache_read": u.cache_read_input_tokens or 0}


def hit_rate(store: SimpleVectorStore, eval_set: list[dict], k: int = 3) -> float:
    hits = sum(any(h.metadata["title"] == ex["source"] for h in store.search(ex["question"], k)) for ex in eval_set)
    return hits / len(eval_set)


if __name__ == "__main__":
    chunks = handbook_chunks(max_size=400)  # small chunks lose the most context
    documents = {p.stem: p.read_text() for p in HANDBOOK_DIR.glob("*.md")}

    plain, contextual = SimpleVectorStore(), SimpleVectorStore()
    plain.add([c.text for c in chunks], [c.metadata for c in chunks])

    texts, totals = [], {"cache_write": 0, "cache_read": 0}
    for c in chunks:
        context, usage = contextualize(documents[c.metadata["title"]], c.text)
        texts.append(f"{context}\n\n{c.text}")
        totals = {k: totals[k] + usage[k] for k in totals}
    contextual.add(texts, [c.metadata for c in chunks])
    print("Example contextualised chunk:\n", texts[3], "\n")
    print(f"Prompt cache tokens: {totals}")

    eval_set = json.loads((ROOT_DIR / "data" / "eval_set.json").read_text())
    print(f"hit@3 plain      : {hit_rate(plain, eval_set):.0%}")
    print(f"hit@3 contextual : {hit_rate(contextual, eval_set):.0%}")
