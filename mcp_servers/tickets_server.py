"""MCP server: a small ticketing system (customers from nimbus.db, tickets in support.db)."""

import argparse
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from rag_common import ROOT_DIR

CUSTOMERS_DB = ROOT_DIR / "data" / "nimbus.db"
TICKETS_DB = ROOT_DIR / "data" / "support.db"


def build_server(customers_db: Path = CUSTOMERS_DB, tickets_db: Path = TICKETS_DB) -> MCPServer:
    if not customers_db.exists():
        raise SystemExit(f"{customers_db} not found - run `python data/make_sample_db.py`")
    con = sqlite3.connect(tickets_db, check_same_thread=False)
    con.execute("""CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY, customer_id INTEGER, subject TEXT, severity TEXT, summary TEXT,
        status TEXT, created_at TEXT, escalation_reason TEXT)""")
    con.commit()
    customers = sqlite3.connect(f"file:{customers_db}?mode=ro", uri=True, check_same_thread=False)

    mcp = MCPServer("tickets", instructions="Look up customers and manage support tickets.")

    @mcp.tool()
    def find_customer(name: str) -> str:
        """Find customers whose name contains `name`. Returns id, name, plan, region."""
        rows = customers.execute(
            "SELECT id, name, plan, region FROM customers WHERE name LIKE ? LIMIT 5", (f"%{name}%",)
        ).fetchall()
        if not rows:
            raise ToolError(f"No customer matching {name!r}")
        return "\n".join(f"id={r[0]} name={r[1]} plan={r[2]} region={r[3]}" for r in rows)

    @mcp.tool()
    def list_tickets(customer_id: int) -> str:
        """Historical tickets (from the main DB) and open support tickets for a customer."""
        old = customers.execute(
            "SELECT opened, severity, topic, resolved FROM tickets WHERE customer_id=? ORDER BY opened DESC", (customer_id,)
        ).fetchall()
        new = con.execute(
            "SELECT id, subject, severity, status FROM support_tickets WHERE customer_id=?", (customer_id,)
        ).fetchall()
        return f"history: {old}\nsupport tickets: {new}"

    @mcp.tool()
    def create_ticket(customer_id: int, subject: str, severity: str, summary: str) -> str:
        """Create a support ticket. severity must be SEV1, SEV2 or SEV3."""
        if severity not in {"SEV1", "SEV2", "SEV3"}:
            raise ToolError("severity must be SEV1, SEV2 or SEV3")
        cur = con.execute(
            "INSERT INTO support_tickets (customer_id, subject, severity, summary, status, created_at) VALUES (?,?,?,?,?,?)",
            (customer_id, subject, severity, summary, "open", datetime.now(timezone.utc).isoformat()),
        )
        con.commit()
        return f"created ticket #{cur.lastrowid} ({severity}) for customer {customer_id}"

    @mcp.tool()
    def escalate_to_human(ticket_id: int, reason: str) -> str:
        """Hand a ticket to a human agent, with the reason."""
        cur = con.execute(
            "UPDATE support_tickets SET status='escalated', escalation_reason=? WHERE id=?", (reason, ticket_id)
        )
        con.commit()
        if cur.rowcount == 0:
            raise ToolError(f"No ticket #{ticket_id}")
        return f"ticket #{ticket_id} escalated to the human support queue"

    return mcp


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--http", action="store_true")
    parser.add_argument("--port", type=int, default=8003)
    args = parser.parse_args()
    server = build_server()
    server.run("streamable-http", port=args.port) if args.http else server.run()
