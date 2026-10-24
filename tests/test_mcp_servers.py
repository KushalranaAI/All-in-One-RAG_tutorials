import asyncio
import sys
from pathlib import Path

import pytest
from mcp import Client

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "mcp_servers"))

import docs_server  # noqa: E402
import sql_server  # noqa: E402
import tickets_server  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def sample_db():
    sys.path.insert(0, str(ROOT / "data"))
    import make_sample_db

    make_sample_db.build()


def call(server, tool, args):
    async def go():
        async with Client(server) as c:
            return await c.call_tool(tool, args)

    return asyncio.run(go())


def test_docs_search_and_filter():
    s = docs_server.build_server()
    r = call(s, "search_docs", {"query": "backups", "k": 2, "title": "security"})
    assert "[security#" in r.content[0].text and "[pricing#" not in r.content[0].text
    assert call(s, "get_document", {"title": "missing"}).is_error


def test_sql_read_only():
    s = sql_server.build_server()
    assert "customers" in call(s, "get_schema", {}).content[0].text
    assert "rows (3)" in call(s, "run_sql", {"query": "SELECT plan, COUNT(*) FROM customers GROUP BY plan"}).content[0].text
    assert call(s, "run_sql", {"query": "DROP TABLE customers"}).is_error
    assert call(s, "run_sql", {"query": "SELECT nope FROM customers"}).is_error


def test_tickets_flow(tmp_path):
    s = tickets_server.build_server(tickets_db=tmp_path / "support.db")
    assert "Acme" in call(s, "find_customer", {"name": "Acme"}).content[0].text
    created = call(s, "create_ticket", {"customer_id": 1, "subject": "x", "severity": "SEV2", "summary": "y"}).content[0].text
    assert "ticket #1" in created
    assert "escalated" in call(s, "escalate_to_human", {"ticket_id": 1, "reason": "angry"}).content[0].text
    assert call(s, "create_ticket", {"customer_id": 1, "subject": "x", "severity": "P0", "summary": "y"}).is_error
