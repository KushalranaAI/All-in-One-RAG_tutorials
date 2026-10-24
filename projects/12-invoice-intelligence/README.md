# Project 12 - Invoice Intelligence (multimodal extraction + SQL RAG)

**Level:** intermediate+ · **Uses:** Days 25, 26 · **Stack:** Claude vision / PDF input, structured outputs, SQLite, MCP

Turn a folder of invoices - **PDFs, photos/scans, or text** - into a queryable database, then ask
questions in plain English: *"How much did we spend with each vendor in Q3?"*, *"Which invoices are
overdue?"*, *"Show the line items on the Acme invoice."*

```
invoices/ (pdf | png/jpg | txt)
   └─► Claude reads the file natively (document / image blocks) ─► Invoice (Pydantic, validated)
          └─► SQLite: invoices + line_items   (data/invoices.db)
                 └─► analyst agent ◄── MCP sql server (read-only) + raw-text search tool
```

Why structured extraction instead of embedding the invoices? Questions about invoices are mostly
**aggregations** (sums by vendor, overdue counts). Extract once into tables, then use SQL (Day 26); keep
text search for "what did the note on invoice X say?".

## Run
```bash
python projects/12-invoice-intelligence/invoices.py extract samples/    # add your own PDFs/images too
python projects/12-invoice-intelligence/invoices.py ask "What is our total spend per vendor, and which invoices are unpaid?"
```

## Extend it
- Validate totals: sum(line items) + tax == total; flag mismatches for review.
- Detect duplicate invoices (same vendor + number or same amount and date).
- Watch an email inbox and extract attachments automatically.
