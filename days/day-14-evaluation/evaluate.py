"""Day 14: retrieval metrics (hit@k, MRR) and LLM-as-judge answer grading."""

import argparse
import json

from pydantic import BaseModel

from rag_common import RAG_SYSTEM, ROOT_DIR, ask, build_handbook_index, parse
from rag_common.prompts import format_context, rag_user_prompt

EVAL_SET = json.loads((ROOT_DIR / "data" / "eval_set.json").read_text())


class Verdict(BaseModel):
    reasoning: str
    correct: bool   # matches the reference answer
    faithful: bool  # every claim is supported by the sources


def retrieval_metrics(store, k: int = 3) -> dict:
    hits, rr = 0, 0.0
    for ex in EVAL_SET:
        titles = [h.metadata["title"] for h in store.search(ex["question"], k=10)]
        if ex["source"] in titles[:k]:
            hits += 1
        if ex["source"] in titles:
            rr += 1 / (titles.index(ex["source"]) + 1)
    return {f"hit@{k}": hits / len(EVAL_SET), "MRR": rr / len(EVAL_SET)}


def judge(question: str, reference: str, answer: str, context: str) -> Verdict:
    return parse(
        f"<sources>\n{context}\n</sources>\n<question>{question}</question>\n"
        f"<reference_answer>{reference}</reference_answer>\n<candidate_answer>{answer}</candidate_answer>\n\n"
        "Grade the candidate. correct: it conveys the same facts as the reference (wording may differ). "
        "faithful: every claim in it is supported by the sources. Explain briefly first.",
        Verdict,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--judge", action="store_true", help="also generate and grade answers (uses the API)")
    parser.add_argument("-k", type=int, default=3)
    args = parser.parse_args()

    store = build_handbook_index()
    print("Retrieval:", {m: f"{v:.2f}" for m, v in retrieval_metrics(store, args.k).items()})

    if args.judge:
        correct = faithful = 0
        for ex in EVAL_SET:
            hits = store.search(ex["question"], k=args.k)
            answer = ask(rag_user_prompt(ex["question"], hits), system=RAG_SYSTEM)
            v = judge(ex["question"], ex["answer"], answer, format_context(hits))
            correct += v.correct
            faithful += v.faithful
            mark = "✓" if v.correct else "✗"
            print(f"{mark} {ex['question'][:60]:<60} faithful={v.faithful}")
        n = len(EVAL_SET)
        print(f"\nCorrectness {correct / n:.0%}   Faithfulness {faithful / n:.0%}")
