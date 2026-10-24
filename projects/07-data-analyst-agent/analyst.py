"""A data analyst agent using the sql + docs MCP servers."""

import asyncio
import re
import sys
from datetime import datetime
from pathlib import Path

from rag_common import ROOT_DIR
from rag_common.mcp_bridge import MCPServerSpec, run_mcp_agent

HERE = Path(__file__).resolve().parent
SERVERS = ROOT_DIR / "mcp_servers"

SYSTEM = """You are a careful data analyst at Nimbus Cloud.
Process: 1) inspect the schema, 2) plan the queries, 3) run them (fix errors and sanity-check results,
e.g. totals and counts), 4) look up relevant policies with the docs tools, 5) write the report.

Report format (Markdown):
# <title>
## Answer            - 2-4 sentences with the key numbers
## Details           - tables of results
## Policy context    - relevant policy, cite chunk ids like [refund_policy#1]
## Method            - every SQL query you relied on, in ```sql blocks
## Caveats"""

if __name__ == "__main__":
    question = " ".join(sys.argv[1:]) or "Which Pro customers have overdue invoices, and what does our policy say happens next?"
    servers = [
        MCPServerSpec.python("sql", str(SERVERS / "sql_server.py"), "--db", str(ROOT_DIR / "data" / "nimbus.db")),
        MCPServerSpec.python("docs", str(SERVERS / "docs_server.py")),
    ]
    report = asyncio.run(run_mcp_agent(question, servers, system=SYSTEM, effort="high", max_turns=25))

    out = HERE / "reports" / f"{datetime.now():%Y%m%d-%H%M}-{re.sub(r'[^a-z0-9]+', '-', question.lower())[:40]}.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text(report)
    print(report, f"\n\nSaved to {out}")
