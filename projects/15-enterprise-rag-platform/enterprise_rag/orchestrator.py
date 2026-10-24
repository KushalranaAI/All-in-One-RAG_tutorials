"""Router → parallel specialist agents (MCP tools, least privilege) → synthesiser → critic."""

from __future__ import annotations

import asyncio

from pydantic import BaseModel

from rag_common import FAST_MODEL, SimpleVectorStore, llm
from rag_common.mcp_bridge import MCPToolbox, run_mcp_agent

from .config import AGENTS, ROLE_AGENTS
from .guardrails import redact, screen_input
from .memory import SessionMemory
from .tracing import Trace


class Task(BaseModel):
    agent: str
    instruction: str


class Route(BaseModel):
    tasks: list[Task]  # empty when the question needs no research (greetings, chit-chat)


class Critique(BaseModel):
    grounded: bool
    unsupported_claims: list[str]


class SemanticCache:
    def __init__(self, threshold: float = 0.95):
        self.store, self.threshold = SimpleVectorStore(), threshold

    def get(self, key: str) -> str | None:
        hits = self.store.search(key, 1)
        return hits[0].metadata["answer"] if hits and hits[0].score >= self.threshold else None

    def put(self, key: str, answer: str) -> None:
        self.store.add([key], [{"answer": answer}])


class Orchestrator:
    def __init__(self, toolbox: MCPToolbox):
        self.toolbox = toolbox
        self.memory = SessionMemory()
        self.caches = {role: SemanticCache() for role in ROLE_AGENTS}  # never share cached answers across roles

    def route(self, question: str, allowed: set[str]) -> list[Task]:
        menu = "\n".join(f"- {name}: {AGENTS[name]['description']}" for name in sorted(allowed))
        route = llm.parse(
            f"Agents:\n{menu}\n\nQuestion: {question}\n\nChoose the agents needed (only from the list) and give each a "
            "complete, self-contained instruction. Use several agents when the question spans their areas.",
            Route,
            model=FAST_MODEL,
        )
        return [t for t in route.tasks if t.agent in allowed]  # RBAC enforced in code, not by the model

    async def run_task(self, task: Task, trace: Trace) -> str:
        spec = AGENTS[task.agent]
        result = await run_mcp_agent(task.instruction, toolbox=self.toolbox, allowed_tools=spec["tools"],
                                     system=spec["system"], model=FAST_MODEL, effort="low", verbose=False)
        trace.log("agent_done", agent=task.agent, chars=len(result))
        return result

    async def answer(self, message: str, *, session_id: str = "default", role: str = "customer") -> dict:
        trace = Trace()
        allowed = ROLE_AGENTS.get(role, set())
        message = redact(message)
        screen = await asyncio.to_thread(screen_input, message)
        trace.log("screen", is_attack=screen.is_attack, reason=screen.reason)
        if screen.is_attack:
            trace.save()
            return {"request_id": trace.request_id, "answer": "Sorry, I can't help with that request.", "agents": []}

        question = await asyncio.to_thread(self.memory.condense, session_id, message)
        trace.log("condense", question=question)
        if (cached := self.caches[role].get(question)) is not None:
            trace.log("cache_hit")
            trace.save()
            return {"request_id": trace.request_id, "answer": cached, "agents": [], "cached": True}

        tasks = await asyncio.to_thread(self.route, question, allowed)
        trace.log("route", role=role, tasks=[t.model_dump() for t in tasks])
        findings = await asyncio.gather(*(self.run_task(t, trace) for t in tasks))  # specialists in parallel
        report = "\n\n".join(f"<findings agent='{t.agent}'>\n{f}\n</findings>" for t, f in zip(tasks, findings))

        synth_prompt = (f"{report}\n\nUser question: {question}\n\nAnswer the user from the findings only. Keep citations "
                        "and key numbers. If findings are missing or empty, answer briefly and say what you couldn't find.")
        history = self.memory.history(session_id)
        answer = await asyncio.to_thread(llm.ask, synth_prompt) if not history else await asyncio.to_thread(
            lambda: llm.text_of(llm.create(history + [{"role": "user", "content": synth_prompt}])))
        trace.log("synthesise", chars=len(answer))

        if tasks:
            critique = await asyncio.to_thread(
                llm.parse, f"{report}\n\n<answer>{answer}</answer>\n\nIs every claim in the answer supported by the findings?",
                Critique, model=FAST_MODEL)
            trace.log("critic", grounded=critique.grounded, unsupported=critique.unsupported_claims)
            if not critique.grounded:
                answer = await asyncio.to_thread(
                    llm.ask, synth_prompt + "\nDo NOT include these unsupported claims: " + "; ".join(critique.unsupported_claims))
                trace.log("revised")

        self.memory.add(session_id, message, answer)
        self.caches[role].put(question, answer)
        trace.save()
        return {"request_id": trace.request_id, "answer": answer, "agents": [t.agent for t in tasks]}
