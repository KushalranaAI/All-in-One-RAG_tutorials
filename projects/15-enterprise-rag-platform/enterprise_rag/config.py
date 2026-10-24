"""Agents, their MCP tools, and which user roles may use them."""

from rag_common import INDEX_DIR, ROOT_DIR
from rag_common.mcp_bridge import MCPServerSpec

SERVERS = [
    MCPServerSpec.python("docs", str(ROOT_DIR / "mcp_servers" / "docs_server.py")),
    MCPServerSpec.python("sql", str(ROOT_DIR / "mcp_servers" / "sql_server.py"), "--db", str(ROOT_DIR / "data" / "nimbus.db")),
    MCPServerSpec.python("tickets", str(ROOT_DIR / "mcp_servers" / "tickets_server.py")),
]

AGENTS = {
    "docs": {
        "description": "company policies, pricing, plans, security, product FAQ, runbooks, HR handbook",
        "tools": {"docs__search_docs", "docs__get_document", "docs__list_documents"},
        "system": "You research the company handbook. Search (several queries if needed) and report facts with "
                  "chunk-id citations like [pricing#2]. Say what you could not find.",
    },
    "data": {
        "description": "live business data: customers, plans, regions, invoices, tickets (SQL)",
        "tools": {"sql__get_schema", "sql__run_sql"},
        "system": "You are a data analyst. Inspect the schema, run read-only SQL, sanity-check results, and report "
                  "the numbers with the SQL you used.",
    },
    "support": {
        "description": "a specific customer's account, ticket history, or opening a support ticket",
        "tools": {"tickets__find_customer", "tickets__list_tickets", "tickets__create_ticket"},
        "system": "You handle customer accounts and tickets. Look the customer up before acting. Report ticket numbers.",
    },
}

ROLE_AGENTS = {
    "customer": {"docs", "support"},          # customers never reach the internal database
    "employee": {"docs", "data", "support"},
}

TRACE_FILE = INDEX_DIR / "platform_traces.jsonl"
