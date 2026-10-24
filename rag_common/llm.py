"""Thin wrapper around the Anthropic SDK used by every lesson.

- `create()` sends one Messages API request with sensible defaults.
- `ask()` is the one-liner: prompt in, text out.
- `run_tool_loop()` is a small, readable agent loop (Day 15 explains it line by line).
"""

from __future__ import annotations

import json
import os
from typing import Any, Callable, TypeVar

import anthropic

try:  # optional: load ANTHROPIC_API_KEY from a .env file
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

MODEL = os.getenv("RAG_MODEL", "claude-opus-5-5")
FAST_MODEL = os.getenv("RAG_FAST_MODEL", "claude-haiku-5-5")

# Models that accept the server-side refusal fallback. If a safety classifier
# declines a request, the API transparently re-runs it on a suitable model.
_FALLBACK_MODELS = {"claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"}

_client: anthropic.Anthropic | None = None
T = TypeVar("T")


def client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment
    return _client


def _params(messages, system, tools, model, max_tokens, effort, extra) -> dict[str, Any]:
    params: dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": messages,
        "output_config": {"effort": effort},
        **extra,
    }
    if system is not None:
        params["system"] = system
    if tools:
        params["tools"] = tools
    if model in _FALLBACK_MODELS:
        params["betas"] = [*params.get("betas", []), "server-side-fallback-2026-07-01"]
        params["fallbacks"] = "default"
    return params


def create(
    messages: list[dict],
    *,
    system: str | list[dict] | None = None,
    tools: list[dict] | None = None,
    model: str = MODEL,
    max_tokens: int = 16000,
    effort: str = "medium",
    **extra: Any,
):
    """One Messages API call. Returns the raw response object."""
    return client().beta.messages.create(**_params(messages, system, tools, model, max_tokens, effort, extra))


def parse(
    prompt: str | list[dict],
    schema: type[T],
    *,
    system: str | None = None,
    model: str = MODEL,
    max_tokens: int = 16000,
    effort: str = "low",
    **extra: Any,
) -> T:
    """Structured output: returns a validated instance of the Pydantic `schema`."""
    messages = [{"role": "user", "content": prompt}] if isinstance(prompt, str) else prompt
    response = client().beta.messages.parse(
        **_params(messages, system, None, model, max_tokens, effort, extra), output_format=schema
    )
    if response.stop_reason == "refusal":
        raise RuntimeError(f"Request declined: {getattr(response, 'stop_details', None)}")
    return response.parsed_output


def stream_text(messages: list[dict], *, system: str | None = None, model: str = MODEL, effort: str = "medium",
                max_tokens: int = 64000, **extra: Any):
    """Yield text deltas as they arrive (for chat UIs and server-sent events)."""
    with client().beta.messages.stream(**_params(messages, system, None, model, max_tokens, effort, extra)) as stream:
        yield from stream.text_stream


def text_of(response) -> str:
    """Join the text blocks of a response (ignores thinking / tool blocks)."""
    if response.stop_reason == "refusal":
        raise RuntimeError(f"Request declined: {getattr(response, 'stop_details', None)}")
    return "".join(b.text for b in response.content if b.type == "text").strip()


def ask(prompt: str, *, system: str | None = None, **kwargs: Any) -> str:
    """Prompt in, answer out."""
    return text_of(create([{"role": "user", "content": prompt}], system=system, **kwargs))


ToolHandler = Callable[..., Any]


def run_tool_loop(
    messages: list[dict],
    tools: list[dict],
    handlers: dict[str, ToolHandler],
    *,
    system: str | None = None,
    max_turns: int = 12,
    verbose: bool = True,
    **kwargs: Any,
) -> tuple[str, list[dict]]:
    """Let Claude call tools until it produces a final answer.

    `tools` are JSON-schema tool definitions; `handlers` maps tool name -> Python
    function called with the tool input as keyword arguments.
    Returns (final_text, full_message_history).
    """
    messages = list(messages)
    for _ in range(max_turns):
        response = create(messages, system=system, tools=tools, **kwargs)
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "pause_turn":
            continue
        if response.stop_reason != "tool_use":
            return text_of(response), messages

        # Run every tool call from this turn and send all results back together.
        results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            if verbose:
                print(f"  -> tool {block.name}({json.dumps(block.input)[:120]})")
            try:
                output = handlers[block.name](**block.input)
                content = output if isinstance(output, str) else json.dumps(output, default=str)
                results.append({"type": "tool_result", "tool_use_id": block.id, "content": content})
            except Exception as exc:  # report the failure to Claude instead of crashing
                results.append(
                    {"type": "tool_result", "tool_use_id": block.id, "content": f"Error: {exc}", "is_error": True}
                )
        messages.append({"role": "user", "content": results})
    raise RuntimeError(f"Agent did not finish within {max_turns} turns")
