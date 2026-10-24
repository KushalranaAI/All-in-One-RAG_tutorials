"""Session memory with query condensation."""

from collections import defaultdict

from pydantic import BaseModel

from rag_common import FAST_MODEL, llm


class Standalone(BaseModel):
    question: str


class SessionMemory:
    def __init__(self, max_turns: int = 6):
        self.sessions: dict[str, list[dict]] = defaultdict(list)
        self.max_turns = max_turns

    def history(self, session_id: str) -> list[dict]:
        return self.sessions[session_id][-self.max_turns:]

    def condense(self, session_id: str, message: str) -> str:
        history = self.history(session_id)
        if not history:
            return message
        transcript = "\n".join(f"{m['role']}: {m['content'][:400]}" for m in history)
        return llm.parse(f"<history>\n{transcript}\n</history>\nRewrite as a standalone question: {message}",
                         Standalone, model=FAST_MODEL).question

    def add(self, session_id: str, user: str, assistant: str) -> None:
        self.sessions[session_id] += [{"role": "user", "content": user}, {"role": "assistant", "content": assistant}]
