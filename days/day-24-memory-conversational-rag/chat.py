"""Day 24: conversational RAG with query condensation, short-term history and long-term memory."""

import argparse

from pydantic import BaseModel

from rag_common import (
    FAST_MODEL,
    RAG_SYSTEM,
    HybridIndex,
    SimpleVectorStore,
    create,
    handbook_chunks,
    parse,
    text_of,
)
from rag_common.prompts import format_context


class Condensed(BaseModel):
    standalone_question: str
    new_user_facts: list[str]  # durable facts about the user stated in the latest message, e.g. "user is on the Pro plan"


class ChatBot:
    def __init__(self, history_turns: int = 6):
        self.index = HybridIndex(handbook_chunks())
        self.memory = SimpleVectorStore()  # long-term memory: facts about the user
        self.history: list[dict] = []
        self.history_turns = history_turns

    def condense(self, message: str) -> Condensed:
        transcript = "\n".join(f"{m['role']}: {m['content']}" for m in self.history[-4:])
        return parse(
            f"<history>\n{transcript}\n</history>\n<latest>{message}</latest>\n\n"
            "Rewrite the latest message as a standalone search question (resolve 'it', 'that', 'and on Pro?'). "
            "Also extract any durable facts the user states about themselves.",
            Condensed,
            model=FAST_MODEL,
        )

    def chat(self, message: str) -> str:
        c = self.condense(message)
        print(f"   (search: {c.standalone_question!r})")
        if c.new_user_facts:
            print(f"   (remembering: {c.new_user_facts})")
            self.memory.add(c.new_user_facts)

        hits = self.index.dense.search(c.standalone_question, k=4)
        memories = [h.text for h in self.memory.search(c.standalone_question, k=3)]
        system = RAG_SYSTEM + "\n\nKnown facts about the user:\n" + "\n".join(f"- {m}" for m in memories or ["(none)"])
        turn = f"<sources>\n{format_context(hits)}\n</sources>\n\n{message}"

        messages = self.history[-self.history_turns:] + [{"role": "user", "content": turn}]
        reply = text_of(create(messages, system=system))
        # Store the plain message (not the sources) so history stays small.
        self.history += [{"role": "user", "content": message}, {"role": "assistant", "content": reply}]
        return reply


DEMO = [
    "Hi! We're a small team on the Pro plan.",
    "How long are backups kept for us?",
    "And on Enterprise?",
    "What's the rate limit on my plan?",
]

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true")
    bot = ChatBot()
    if parser.parse_args().demo:
        for msg in DEMO:
            print(f"\nuser> {msg}\nbot > {bot.chat(msg)}")
    else:
        while msg := input("\nuser> ").strip():
            print(f"bot > {bot.chat(msg)}")
