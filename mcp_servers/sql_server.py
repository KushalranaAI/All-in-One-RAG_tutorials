"""MCP server: read-only SQL access to a SQLite database."""

import argparse
import re
import sqlite3
from pathlib import Path

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from rag_common import ROOT_DIR

DEFAULT_DB = ROOT_DIR / "data" / "nimbus.db"


def build_server(db: Path = DEFAULT_DB, max_rows: int = 200) -> MCPServer:
    if not db.exists():
        raise SystemExit(f"{db} not found - run `python data/make_sample_db.py`")

    def connect():
        return sqlite3.connect(f"file:{db}?mode=ro", uri=True)  # the database itself refuses writes

    mcp = MCPServer("sql", instructions="Read-only SQL. Call get_schema before writing queries.")

    @mcp.tool()
    def get_schema() -> str:
        """Every table's CREATE statement plus two sample rows."""
        con = connect()
        try:
            out = []
            for name, sql in con.execute("SELECT name, sql FROM sqlite_master WHERE type='table'"):
                sample = con.execute(f'SELECT * FROM "{name}" LIMIT 2').fetchall()
                out.append(f"{sql};\n-- sample: {sample}")
            return "\n\n".join(out)
        finally:
            con.close()

    @mcp.tool()
    def run_sql(query: str) -> str:
        """Run ONE read-only SQLite SELECT (or WITH ... SELECT) query. Results are capped at 200 rows."""
        q = query.strip().rstrip(";")
        if ";" in q or not re.match(r"(?is)^\s*(select|with)\b", q):
            raise ToolError("Only a single SELECT statement is allowed.")
        con = connect()
        try:
            cur = con.execute(f"SELECT * FROM ({q}) LIMIT {max_rows}")
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
        except sqlite3.Error as exc:
            raise ToolError(f"SQL error: {exc}") from exc
        finally:
            con.close()
        return f"columns: {cols}\nrows ({len(rows)}): {rows}"

    return mcp


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--http", action="store_true")
    parser.add_argument("--port", type=int, default=8002)
    args = parser.parse_args()
    server = build_server(args.db)
    server.run("streamable-http", port=args.port) if args.http else server.run()
