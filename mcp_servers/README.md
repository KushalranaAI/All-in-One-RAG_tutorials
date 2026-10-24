# Reusable MCP servers

Production-style MCP servers used by several projects. Each runs over **stdio** by default (for Claude
Desktop, Claude Code and `rag_common.mcp_bridge`) or over **streamable HTTP** with `--http --port N`.

| Server | Tools | Used by |
|--------|-------|---------|
| `docs_server.py` | `search_docs`, `list_documents`, `get_document` (+ `docs://{title}` resources) | projects 07, 13, 15 |
| `sql_server.py` | `get_schema`, `run_sql` (read-only, single SELECT, row limit) | projects 07, 12, 15 |
| `tickets_server.py` | `find_customer`, `list_tickets`, `create_ticket`, `escalate_to_human` | projects 13, 15 |

```bash
python data/make_sample_db.py                                   # once: creates data/nimbus.db
claude mcp add nimbus-docs -- python $PWD/mcp_servers/docs_server.py
claude mcp add nimbus-sql  -- python $PWD/mcp_servers/sql_server.py --db $PWD/data/nimbus.db
python mcp_servers/docs_server.py --http --port 8001            # remote: http://localhost:8001/mcp
```

From Python:
```python
from rag_common.mcp_bridge import MCPServerSpec, run_mcp_agent
servers = [MCPServerSpec.python("docs", "mcp_servers/docs_server.py"),
           MCPServerSpec.python("sql", "mcp_servers/sql_server.py", "--db", "data/nimbus.db")]
print(asyncio.run(run_mcp_agent("Which Pro customers have overdue invoices, and what is the refund policy?", servers)))
```
