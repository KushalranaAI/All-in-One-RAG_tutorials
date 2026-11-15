# Day 26 - RAG over structured data: text-to-SQL agents

**Goal:** answer questions whose answers live in databases ("How many Pro customers have overdue
invoices?") - and combine them with document knowledge.

## In everyday life

The school office keeps a register with a row for every student: name, class, attendance, fees paid. The principal asks, "How many students in class 9 are below 75 percent attendance?" Nobody reads every row aloud and then guesses. The clerk looks at the column headings, works out the exact counting rule, and counts.

That is what a **text-to-SQL agent** does. **SQL** is a small language for asking questions of a **database**, which stores information in tables of rows and columns, like that register. The **schema** (the list of tables and columns, with what each column means) tells the model what the register looks like. The model writes a **query** (one precise question in SQL), your code runs it, and the numbers come back. Searching by meaning is poor at counting, adding and ranking, so those questions go to the database.

Unlike the clerk, the model can write a wrong query with total confidence. So it gets **read-only** access, which means it may look at the register but never change it.

**Where you meet it.** A support lead asks, "Which Pro customers opened urgent tickets this month, and what reply time does their plan promise?" The names sit in a database and the promise sits in a policy document. Without SQL, the bot guesses a number. With it, the agent queries the database, searches the document, and gives one grounded answer.

```scene
title: The clerk and the school register
step: 🙋 The principal asks how many class 9 students are below 75 percent | Question needing a count
step: 📖 The clerk reads the column headings of the register first | get_schema
step: ✍️ He writes the exact counting rule on a slip | Claude writes a SELECT query
step: 🔒 He counts from the register but may never write in it | run_sql on a read-only connection
step: 🔁 If a column name was wrong, he fixes the slip and recounts | Retry on errors
step: 💬 He tells the principal the number in one sentence | Answer from the rows
takeaway: For counts and totals, let the model write the question and let the database do the counting.
```

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
