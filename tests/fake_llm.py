"""A scripted stand-in for the Claude API so the plumbing can be tested offline (no API key)."""

from __future__ import annotations

import itertools
from types import SimpleNamespace as NS

_ids = itertools.count(1)


def text_response(text: str):
    return NS(stop_reason="end_turn", content=[NS(type="text", text=text, citations=None)], usage=NS(input_tokens=1, output_tokens=1))


def tool_response(*calls: tuple[str, dict]):
    blocks = [NS(type="tool_use", id=f"toolu_{next(_ids)}", name=name, input=args) for name, args in calls]
    return NS(stop_reason="tool_use", content=blocks, usage=NS(input_tokens=1, output_tokens=1))


class ScriptedLLM:
    """Callable replacement for rag_common.llm.create. `script` is a list of responses or callables(messages, tools)."""

    def __init__(self, script):
        self.script = list(script)
        self.calls = []

    def __call__(self, messages, **kwargs):
        self.calls.append({"messages": list(messages), **kwargs})
        step = self.script.pop(0)
        return step(messages, kwargs.get("tools")) if callable(step) else step
