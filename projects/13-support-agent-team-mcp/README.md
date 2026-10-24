# Project 13 - Customer Support Agent Team (multi-agent + MCP)

**Level:** advanced · **Uses:** Days 17, 21, 22, 29 · **Stack:** router, specialist agents with least-privilege MCP tools, QA reviewer, human handoff

A support desk run by a team of agents that share **two MCP servers** - the knowledge base and a
ticketing system - but each agent can only use the tools its job needs.

```
customer message
   └─► Triage (Haiku, structured): category, severity, customer name, needs_account_lookup
          └─► Specialist (one of):
                billing   tools: docs__search_docs, tickets__find_customer, tickets__list_tickets
                technical tools: docs__search_docs, tickets__find_customer, tickets__create_ticket
                account   tools: tickets__find_customer, tickets__list_tickets, tickets__create_ticket
              └─► QA reviewer (structured): grounded? policy-compliant? tone? ──fail──► revise once
                     └─► escalate? ──► tickets__escalate_to_human (only the supervisor may call it)
```

## What it demonstrates
- **One MCP connection pool, many agents**: `MCPToolbox` is opened once and shared.
- **Least privilege** via `allowed_tools` - a billing agent physically can't create tickets.
- **Separation of duties**: the agent that writes the reply is not the one that approves it.
- **Human in the loop**: SEV1, angry customers, or failed QA go to a person, with a ticket and a reason.

## Run
```bash
python data/make_sample_db.py
python projects/13-support-agent-team-mcp/support_team.py "Hi, this is Acme. Our deploys fail with 409 errors since this morning."
python projects/13-support-agent-team-mcp/support_team.py "Globex here - we were charged twice in September, I want a refund."
```
Tickets created by the agents land in `data/support.db`.

## Extend it
- Point the tickets server at a real helpdesk (Zendesk/Jira MCP servers exist).
- Add a "sales" specialist with a CRM MCP server.
- Log a trace per conversation (Day 29) and review failed QA cases weekly.
