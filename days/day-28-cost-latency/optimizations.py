"""Day 28: semantic cache, model routing and cost tracking."""

import time
from typing import Literal

from pydantic import BaseModel

from rag_common import (
    FAST_MODEL,
    MODEL,
    RAG_SYSTEM,
    HybridIndex,
    SimpleVectorStore,
    create,
    handbook_chunks,
    parse,
    text_of,
)
from rag_common.embeddings import HashingEmbedder
from rag_common.prompts import format_context
from rag_common.vectorstore import Hit

# $ per million tokens (input, output). Check current pricing before relying on these.
PRICES = {MODEL: (4.00, 20.00), FAST_MODEL: (0.10, 0.50)}


class UsageTracker:
    def __init__(self):
        self.rows = []

    def record(self, label: str, model: str, usage) -> None:
        inp, out = PRICES.get(model, (0, 0))
        cost = usage.input_tokens / 1e6 * inp + usage.output_tokens / 1e6 * out
        self.rows.append((label, model, usage.input_tokens, usage.output_tokens, cost))

    def report(self) -> None:
        print(f"\n{'step':<28}{'model':<18}{'in':>7}{'out':>7}{'$':>10}")
        for label, model, i, o, c in self.rows:
            print(f"{label[:27]:<28}{model:<18}{i:>7}{o:>7}{c:>10.5f}")
        print(f"{'TOTAL':<53}{sum(r[4] for r in self.rows):>17.5f}")


class SemanticCache:
    def __init__(self, threshold: float):
        self.store = SimpleVectorStore()
        self.threshold = threshold

    def get(self, question: str) -> str | None:
        hits = self.store.search(question, k=1)
        if hits and hits[0].score >= self.threshold:
            return hits[0].metadata["answer"]
        return None

    def put(self, question: str, answer: str) -> None:
        self.store.add([question], [{"answer": answer}])


class Difficulty(BaseModel):
    level: Literal["simple", "complex"]  # simple = single fact lookup


class OptimizedRAG:
    def __init__(self):
        self.index = HybridIndex(handbook_chunks())
        # Real embeddings separate paraphrases well at ~0.9; the lexical fallback needs a lower bar.
        hashing = isinstance(self.index.dense.embedder, HashingEmbedder)
        self.cache = SemanticCache(threshold=0.75 if hashing else 0.92)
        self.usage = UsageTracker()

    def answer(self, question: str) -> str:
        start = time.perf_counter()
        if (cached := self.cache.get(question)) is not None:
            print(f"cache HIT  ({(time.perf_counter() - start) * 1000:.0f} ms): {question}")
            return cached

        level = parse(f"Is this a simple single-fact lookup or a complex question? {question}", Difficulty, model=FAST_MODEL).level
        model = FAST_MODEL if level == "simple" else MODEL
        chunks = self.index.search(question, k=3 if level == "simple" else 5)  # less context for simple questions
        prompt = f"<sources>\n{format_context([Hit(c.text, c.metadata, 0) for c in chunks])}\n</sources>\n\n{question}"
        response = create([{"role": "user", "content": prompt}], system=RAG_SYSTEM, model=model,
                          effort="low" if level == "simple" else "medium")
        self.usage.record(question, model, response.usage)
        answer = text_of(response)
        self.cache.put(question, answer)
        print(f"cache MISS ({(time.perf_counter() - start) * 1000:.0f} ms, {level} -> {model}): {question}")
        return answer


if __name__ == "__main__":
    rag = OptimizedRAG()
    for q in [
        "How much is the Pro plan per month?",
        "How much does the Pro plan cost per month?",  # paraphrase -> semantic cache hit
        "Compare security features and support between Pro and Enterprise for a healthcare startup.",
    ]:
        rag.answer(q)
    rag.usage.report()
