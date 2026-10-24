# Project 07 - Data Analyst Agent (SQL + docs over MCP)

**Level:** intermediate+ · **Uses:** Days 21, 26 · **Stack:** two MCP servers, text-to-SQL, report writing

A business analyst agent that answers questions by combining **live data** (read-only SQL through the
`sql` MCP server) with **company knowledge** (policies and plan details through the `docs` MCP server),
then writes a Markdown report with the queries it ran.

```
            ┌─ MCP: sql  (get_schema, run_sql — read-only)   ◄── data/nimbus.db
analyst ────┤
 (Claude)   └─ MCP: docs (search_docs, get_document)          ◄── data/company_handbook
     │
     └─► plan → query → check → combine with policy → report.md
```

Example questions:
- "Which Pro customers have overdue invoices, and what does our policy say happens next?"
- "Which customers opened SEV1 tickets this year, and did we meet the response targets their plan promises?"
- "Estimate monthly recurring revenue by plan and region."

## Run
```bash
python data/make_sample_db.py
python projects/07-data-analyst-agent/analyst.py "Which Pro customers have overdue invoices, and what does our policy say?"
```
The report is saved to `projects/07-data-analyst-agent/reports/`.

## Why MCP here?
The same two servers work in Claude Desktop and Claude Code with zero changes, and you can swap SQLite for
Postgres by changing one server - the agent doesn't change.

## Extend it
- Add a `make_chart(sql, kind)` tool that saves a matplotlib PNG and embeds it in the report.
- Add a verification step: a second agent re-derives each key number with an independent query.
- Schedule a weekly KPI report.
