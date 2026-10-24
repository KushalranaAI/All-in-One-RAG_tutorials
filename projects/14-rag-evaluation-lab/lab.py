"""RAG evaluation lab: synthetic test sets, retrieval grid search, judged answers, leaderboard."""

import argparse
import csv
import json
import random
import time
from pathlib import Path

from pydantic import BaseModel

from rag_common import (
    BM25,
    FAST_MODEL,
    RAG_SYSTEM,
    ROOT_DIR,
    HybridIndex,
    ask,
    handbook_chunks,
    parse,
)
from rag_common.index import HANDBOOK_DIR
from rag_common.prompts import format_context
from rag_common.vectorstore import Hit

HERE = Path(__file__).resolve().parent
TESTSET = HERE / "testset.json"


class QA(BaseModel):
    question: str
    answer: str


class QAs(BaseModel):
    pairs: list[QA]


class Verdict(BaseModel):
    reasoning: str
    correct: bool
    faithful: bool


def generate(docs: Path, n: int) -> None:
    chunks = handbook_chunks(directory=docs)
    random.Random(0).shuffle(chunks)
    rows = []
    for c in chunks[: max(1, n // 2)]:
        out = parse(f"<text>\n{c.text}\n</text>\n\nWrite 2 questions a real user might ask that this text answers, "
                    "phrased in their own words (not copying the text), with short reference answers.", QAs, model=FAST_MODEL)
        rows += [{"question": p.question, "answer": p.answer, "source": c.metadata["title"]} for p in out.pairs]
    rows.append({"question": "What is the name of Nimbus Cloud's CEO?", "answer": "UNANSWERABLE", "source": None})
    TESTSET.write_text(json.dumps(rows, indent=1))
    print(f"wrote {len(rows)} questions to {TESTSET}")


class Retriever:
    def __init__(self, docs: Path, chunk_size: int, kind: str):
        self.kind = kind
        self.index = HybridIndex(handbook_chunks(max_size=chunk_size, directory=docs))
        self.bm25 = BM25([c.text for c in self.index.chunks])

    def search(self, query: str, k: int):
        if self.kind == "dense":
            return [self.index.by_id[h.metadata["chunk_id"]] for h in self.index.dense.search(query, k)]
        if self.kind == "bm25":
            return [self.index.chunks[i] for i, _ in self.bm25.search(query, k)]
        hits = self.index.search(query, k=10 if self.kind == "hybrid+rerank" else k)
        return llm_rerank(query, hits, k) if self.kind == "hybrid+rerank" else hits


class Ranked(BaseModel):
    order: list[int]


def llm_rerank(query, chunks, k):
    listing = "\n\n".join(f"<c n={i}>\n{c.text}\n</c>" for i, c in enumerate(chunks))
    order = parse(f"{listing}\n\nQuery: {query}\nReturn chunk numbers ordered by relevance.", Ranked, model=FAST_MODEL).order
    return [chunks[i] for i in order if 0 <= i < len(chunks)][:k]


def retrieval(docs: Path, testset: Path, rerank: bool) -> list[dict]:
    qs = [q for q in json.loads(testset.read_text()) if q.get("source")]
    kinds = ["dense", "bm25", "hybrid"] + (["hybrid+rerank"] if rerank else [])
    results = []
    for size in (400, 800, 1500):
        for kind in kinds:
            r = Retriever(docs, size, kind)
            for k in (1, 3, 5):
                start, hits, rr = time.perf_counter(), 0, 0.0
                for q in qs:
                    titles = [c.metadata["title"] for c in r.search(q["question"], k)]
                    hits += q["source"] in titles
                    rr += 1 / (titles.index(q["source"]) + 1) if q["source"] in titles else 0
                ms = (time.perf_counter() - start) * 1000 / len(qs)
                results.append({"chunk_size": size, "retriever": kind, "k": k, "hit@k": round(hits / len(qs), 3),
                                "MRR": round(rr / len(qs), 3), "ms/query": round(ms, 1)})
                print(results[-1])
    with (HERE / "results.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(results[0]))
        w.writeheader()
        w.writerows(results)
    best = sorted(results, key=lambda r: (-r["MRR"], -r["hit@k"], r["ms/query"]))
    lines = ["| rank | chunk size | retriever | k | hit@k | MRR | ms/query |", "|---|---|---|---|---|---|---|"]
    lines += [f"| {i} | {r['chunk_size']} | {r['retriever']} | {r['k']} | {r['hit@k']} | {r['MRR']} | {r['ms/query']} |"
              for i, r in enumerate(best[:15], 1)]
    (HERE / "leaderboard.md").write_text("# Retrieval leaderboard\n\n" + "\n".join(lines) + "\n")
    print("\n" + "\n".join(lines))
    return best


def answers(docs: Path, testset: Path, top: int) -> None:
    rows = json.loads(testset.read_text())
    best = retrieval(docs, testset, rerank=False)[:top]
    for cfg in best:
        r = Retriever(docs, cfg["chunk_size"], cfg["retriever"])
        correct = faithful = 0
        for q in rows:
            chunks = r.search(q["question"], max(cfg["k"], 3))
            hits = [Hit(c.text, c.metadata, 0) for c in chunks]
            a = ask(f"<sources>\n{format_context(hits)}\n</sources>\n\nQuestion: {q['question']}", system=RAG_SYSTEM, effort="low")
            v = parse(f"<sources>{format_context(hits)}</sources>\n<question>{q['question']}</question>\n"
                      f"<reference>{q['answer']}</reference>\n<answer>{a}</answer>\n\ncorrect: same facts as the reference "
                      "(for UNANSWERABLE, correct means the answer declines). faithful: all claims supported by sources.", Verdict)
            correct += v.correct
            faithful += v.faithful
        n = len(rows)
        print(f"{cfg['retriever']} size={cfg['chunk_size']} k={cfg['k']}: correctness {correct / n:.0%}, faithfulness {faithful / n:.0%}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("cmd", choices=["generate", "retrieval", "answers"])
    parser.add_argument("--docs", type=Path, default=HANDBOOK_DIR)
    parser.add_argument("--testset", type=Path, default=None)
    parser.add_argument("--n", type=int, default=30)
    parser.add_argument("--top", type=int, default=2)
    parser.add_argument("--no-rerank", action="store_true")
    args = parser.parse_args()
    testset = args.testset or (TESTSET if TESTSET.exists() else ROOT_DIR / "data" / "eval_set.json")
    if args.cmd == "generate":
        generate(args.docs, args.n)
    elif args.cmd == "retrieval":
        retrieval(args.docs, testset, rerank=not args.no_rerank)
    else:
        answers(args.docs, testset, args.top)
