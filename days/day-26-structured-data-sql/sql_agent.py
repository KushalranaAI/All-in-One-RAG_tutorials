"""Day 26: a text-to-SQL agent (read-only) that can also search documents."""

import re
import sqlite3
import sys

from rag_common import ROOT_DIR, HybridIndex, handbook_chunks, run_tool_loop, tool

DB_PATH = ROOT_DIR / "data" / "nimbus.db"
INDEX = HybridIndex(handbook_chunks())


def connect() -> sqlite3.Connection:
    if not DB_PATH.exists():
        sys.exit("Run `python data/make_sample_db.py` first.")
    return sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)  # read-only at the database level


def get_schema() -> str:
    with connect() as con:
        tables = con.execute("SELECT name, sql FROM sqlite_master WHERE type='table'").fetchall()
        out = []
        for name, sql in tables:
            sample = con.execute(f"SELECT * FROM {name} LIMIT 2").fetchall()
            out.append(f"{sql};\n-- sample rows: {sample}")
    return "\n\n".join(out)


def run_sql(query: str) -> str:
    q = query.strip().rstrip(";")
    if ";" in q or not re.match(r"(?is)^\s*(select|with)\b", q):
        raise ValueError("Only a single SELECT statement is allowed.")
    with connect() as con:
        cur = con.execute(f"SELECT * FROM ({q}) LIMIT 200")
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()
    return f"columns: {cols}\nrows ({len(rows)}): {rows}"


TOOLS = [
    tool("get_schema", "Get the database schema with sample rows. Call this first.", {}),
    tool("run_sql", "Run one read-only SQLite SELECT query and return the rows.", {"query": {"type": "string"}}),
    tool("search_docs", "Search company documents (pricing, policies, SLAs, runbooks).", {"query": {"type": "string"}}),
]
HANDLERS = {"get_schema": get_schema, "run_sql": run_sql, "search_docs": lambda query: INDEX.search_text(query, k=3)}
SYSTEM = (
    "You answer business questions. Use SQL for anything about customers, invoices or tickets, and search_docs "
    "for policies and plan details. Check the schema first. If a query errors, fix it and retry. "
    "Show the key numbers and mention which SQL produced them."
)

if __name__ == "__main__":
    question = " ".join(sys.argv[1:]) or "Which region has the most Pro customers?"
    answer, _ = run_tool_loop([{"role": "user", "content": question}], TOOLS, HANDLERS, system=SYSTEM)
    print("\n" + answer)
