"""A support team of agents sharing MCP servers with per-agent tool allow-lists."""

import asyncio
import sys
from typing import Literal

from pydantic import BaseModel

from rag_common import FAST_MODEL, ROOT_DIR, parse
from rag_common.mcp_bridge import MCPServerSpec, MCPToolbox, run_mcp_agent

SERVERS = [
    MCPServerSpec.python("docs", str(ROOT_DIR / "mcp_servers" / "docs_server.py")),
    MCPServerSpec.python("tickets", str(ROOT_DIR / "mcp_servers" / "tickets_server.py")),
]

SPECIALISTS = {
    "billing": {
        "tools": {"docs__search_docs", "tickets__find_customer", "tickets__list_tickets"},
        "role": "billing specialist: plans, invoices, refunds, discounts. Quote the exact policy.",
    },
    "technical": {
        "tools": {"docs__search_docs", "tickets__find_customer", "tickets__create_ticket"},
        "role": "technical support engineer: API errors, deploys, outages, rate limits. Open a ticket for real faults.",
    },
    "account": {
        "tools": {"tickets__find_customer", "tickets__list_tickets", "tickets__create_ticket"},
        "role": "account manager: customer history and account questions.",
    },
}


class Triage(BaseModel):
    category: Literal["billing", "technical", "account"]
    severity: Literal["SEV1", "SEV2", "SEV3"]
    customer_name: str
    sentiment: Literal["calm", "frustrated", "angry"]


class QA(BaseModel):
    grounded: bool        # claims supported by retrieved policy/docs
    policy_compliant: bool
    tone_ok: bool
    feedback: str


async def handle(message: str) -> str:
    triage = parse(f"Triage this support message:\n{message}", Triage, model=FAST_MODEL)
    print(f"[triage] {triage.model_dump()}")
    spec = SPECIALISTS[triage.category]

    async with MCPToolbox(SERVERS) as toolbox:  # opened once, shared by every agent below
        draft_prompt = (f"Customer message:\n{message}\n\nTriage: {triage.model_dump_json()}\n"
                        "Look up the customer, research the issue, take any action your tools allow, and draft the reply. "
                        "End with a line 'INTERNAL NOTE:' summarising what you did (ticket numbers etc).")
        system = f"You are the Nimbus Cloud {spec['role']} Only state facts found with your tools; cite doc chunk ids."
        draft = await run_mcp_agent(draft_prompt, toolbox=toolbox, allowed_tools=spec["tools"], system=system)

        qa = parse(f"<customer>{message}</customer>\n<draft>{draft}</draft>\n\nReview this support reply.", QA)
        print(f"[qa] {qa.model_dump()}")
        if not (qa.grounded and qa.policy_compliant and qa.tone_ok):
            draft = await run_mcp_agent(f"{draft_prompt}\n\nYour previous draft failed review: {qa.feedback}\nRewrite it.",
                                        toolbox=toolbox, allowed_tools=spec["tools"], system=system)
            qa = parse(f"<customer>{message}</customer>\n<draft>{draft}</draft>\n\nReview this support reply.", QA)

        escalate = triage.severity == "SEV1" or triage.sentiment == "angry" or not qa.grounded
        if escalate:
            supervisor = await run_mcp_agent(
                f"Escalate this case to a human. Find the customer, create a ticket if none was created "
                f"(see the draft's internal note), then escalate it with a one-line reason.\n\nTriage: {triage.model_dump_json()}\n\nDraft:\n{draft}",
                toolbox=toolbox,
                allowed_tools={"tickets__find_customer", "tickets__create_ticket", "tickets__escalate_to_human"},
                system="You are the support supervisor.",
                model=FAST_MODEL,
                effort="low",
            )
            draft += f"\n\n[SUPERVISOR] {supervisor}"
    return draft


if __name__ == "__main__":
    msg = " ".join(sys.argv[1:]) or "Hi, this is Acme. Our deploys fail with 409 errors since this morning."
    print("\n" + asyncio.run(handle(msg)))
