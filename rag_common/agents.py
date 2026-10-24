"""A minimal Agent abstraction for the multi-agent lessons (Day 22+)."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Callable

from .llm import MODEL, ask, run_tool_loop


def tool(name: str, description: str, properties: dict, required: list[str] | None = None) -> dict:
    """Shorthand for a JSON-schema tool definition."""
    return {
        "name": name,
        "description": description,
        "input_schema": {"type": "object", "properties": properties, "required": required or list(properties)},
    }


@dataclass
class Agent:
    """An LLM with a role (system prompt) and optional tools."""

    name: str
    system: str
    tools: list[dict] = field(default_factory=list)
    handlers: dict[str, Callable[..., Any]] = field(default_factory=dict)
    model: str = MODEL
    effort: str = "medium"
    max_turns: int = 12

    def run(self, task: str, verbose: bool = False) -> str:
        if verbose:
            print(f"[{self.name}] {task[:100]}")
        if not self.tools:
            return ask(task, system=self.system, model=self.model, effort=self.effort)
        answer, _ = run_tool_loop(
            [{"role": "user", "content": task}],
            self.tools,
            self.handlers,
            system=self.system,
            model=self.model,
            effort=self.effort,
            max_turns=self.max_turns,
            verbose=verbose,
        )
        return answer

    def as_tool(self, description: str) -> tuple[dict, Callable[..., str]]:
        """Expose this agent as a tool another agent can call (agent-as-tool / delegation)."""
        definition = tool(
            f"ask_{self.name}",
            description,
            {"task": {"type": "string", "description": "A complete, self-contained instruction for this agent"}},
        )
        return definition, lambda task: self.run(task, verbose=True)


def run_parallel(jobs: list[tuple[Agent, str]], max_workers: int = 4) -> list[str]:
    """Run several (agent, task) pairs concurrently; results keep the input order."""
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        return list(pool.map(lambda job: job[0].run(job[1]), jobs))
