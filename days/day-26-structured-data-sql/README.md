# Day 26 - RAG over structured data: text-to-SQL agents

**Goal:** answer questions whose answers live in databases ("How many Pro customers have overdue
invoices?") - and combine them with document knowledge.

## Why not embed the database?
Embedding rows works for *lookup* ("find the customer named Acme") but fails at **aggregation**
(counts, sums, averages, top-N, joins). For those, let the LLM **write SQL** and run it.

## The text-to-SQL agent loop
```
question ─► get_schema() ─► Claude writes SELECT ─► run_sql() ─► rows ─► (fix errors / refine) ─► answer
```
Give the model:
- the **schema** with column meanings and sample values,
- a **read-only** connection (never trust generated SQL with write access),
- row limits and timeouts,
- the ability to see errors and retry.

## Combining SQL + documents
"Which customers opened SEV1 tickets, and what response time are they entitled to?"
→ SQL for *which customers and plans*, document search for *SLA per plan*. One agent, two tools.

## Safety checklist
- Open SQLite with `mode=ro` (or a DB user with only `SELECT` grants).
- Allow a single statement that starts with `SELECT`/`WITH`; reject `;`-chained statements.
- Add `LIMIT`; set a statement timeout.
- Row-level security for multi-tenant data - filter in the database, not the prompt.

## Run it
```bash
python data/make_sample_db.py        # creates data/nimbus.db (customers, invoices, tickets)
python days/day-26-structured-data-sql/sql_agent.py "Which region has the most Pro customers?"
python days/day-26-structured-data-sql/sql_agent.py "Which customers opened SEV1 tickets, what plan are they on, and what support response time does that plan promise?"
```

## Exercises
1. Add a `describe_column(table, column)` tool returning distinct values.
2. Log every generated SQL query; build a small eval of 10 questions with expected numbers.
3. Point it at your own Postgres database with a read-only user.
