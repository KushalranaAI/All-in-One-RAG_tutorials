"""Day 06: a complete, minimal RAG pipeline over the sample handbook."""

import argparse

from rag_common import RAG_SYSTEM, ask, build_handbook_index
from rag_common.prompts import rag_user_prompt


class RAG:
    def __init__(self, k: int = 4):
        self.k = k
        self.store = build_handbook_index()          # 1. index: load -> chunk -> embed -> store

    def answer(self, question: str, show_sources: bool = False) -> str:
        hits = self.store.search(question, k=self.k)  # 2. retrieve
        if show_sources:
            for i, h in enumerate(hits, 1):
                print(f"  [{i}] {h.score:.3f} {h.metadata['chunk_id']}")
        prompt = rag_user_prompt(question, hits)      # 3. augment
        return ask(prompt, system=RAG_SYSTEM)          # 4. generate


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("question", nargs="*")
    parser.add_argument("-k", type=int, default=4)
    parser.add_argument("--show-sources", action="store_true")
    args = parser.parse_args()

    rag = RAG(k=args.k)
    if args.question:
        print(rag.answer(" ".join(args.question), args.show_sources))
    else:
        print("Ask about Nimbus Cloud (empty line to quit).")
        while q := input("\n> ").strip():
            print(rag.answer(q, args.show_sources))
