"""Extract invoices (PDF / image / text) into SQLite with Claude, then answer questions over them."""

import argparse
import asyncio
import base64
import mimetypes
import sqlite3
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel

from rag_common import FAST_MODEL, ROOT_DIR, Chunk, HybridIndex, parse
from rag_common.mcp_bridge import MCPServerSpec, run_mcp_agent

HERE = Path(__file__).resolve().parent
DB = ROOT_DIR / "data" / "invoices.db"


class LineItem(BaseModel):
    description: str
    quantity: float
    unit_price: float
    amount: float


class Invoice(BaseModel):
    vendor: str
    invoice_number: str
    invoice_date: str  # YYYY-MM-DD
    due_date: Optional[str]
    currency: str
    subtotal: Optional[float]
    tax: Optional[float]
    total: float
    status: Literal["paid", "unpaid", "unknown"]
    notes: Optional[str]
    line_items: list[LineItem]


def file_block(path: Path) -> dict | str:
    mime = mimetypes.guess_type(path.name)[0] or ""
    data = base64.standard_b64encode(path.read_bytes()).decode()
    if mime == "application/pdf":
        return {"type": "document", "source": {"type": "base64", "media_type": mime, "data": data}}
    if mime.startswith("image/"):
        return {"type": "image", "source": {"type": "base64", "media_type": mime, "data": data}}
    return {"type": "text", "text": f"<invoice_text>\n{path.read_text(errors='ignore')}\n</invoice_text>"}


def extract_invoice(path: Path) -> Invoice:
    content = [file_block(path), {"type": "text", "text": "Extract this invoice. Dates as YYYY-MM-DD. Numbers without currency symbols."}]
    return parse([{"role": "user", "content": content}], Invoice, model=FAST_MODEL)


def save(invoices: list[tuple[Path, Invoice]]) -> None:
    con = sqlite3.connect(DB)
    con.executescript("""
        CREATE TABLE IF NOT EXISTS invoices (file TEXT PRIMARY KEY, vendor TEXT, invoice_number TEXT, invoice_date TEXT,
            due_date TEXT, currency TEXT, subtotal REAL, tax REAL, total REAL, status TEXT, notes TEXT);
        CREATE TABLE IF NOT EXISTS line_items (file TEXT, description TEXT, quantity REAL, unit_price REAL, amount REAL);
    """)
    for path, inv in invoices:
        con.execute("DELETE FROM line_items WHERE file=?", (path.name,))
        con.execute("INSERT OR REPLACE INTO invoices VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (path.name, inv.vendor, inv.invoice_number, inv.invoice_date, inv.due_date, inv.currency,
                     inv.subtotal, inv.tax, inv.total, inv.status, inv.notes))
        con.executemany("INSERT INTO line_items VALUES (?,?,?,?,?)",
                        [(path.name, li.description, li.quantity, li.unit_price, li.amount) for li in inv.line_items])
    con.commit()
    con.close()


def extract_folder(folder: Path) -> None:
    from concurrent.futures import ThreadPoolExecutor

    paths = [p for p in sorted(folder.iterdir()) if p.suffix.lower() in {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt"}]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(extract_invoice, paths))
    for path, inv in zip(paths, results):
        items_sum = sum(li.amount for li in inv.line_items)
        check = "" if inv.subtotal is None or abs(items_sum - inv.subtotal) < 0.01 else f"  ⚠ items sum {items_sum:.2f} != subtotal"
        print(f"✓ {path.name}: {inv.vendor} #{inv.invoice_number} {inv.total} {inv.currency} [{inv.status}]{check}")
    save(list(zip(paths, results)))
    print(f"Saved {len(results)} invoices to {DB}")


def answer(question: str, folder: Path) -> str:
    texts = [Chunk(p.read_text(errors="ignore"), {"chunk_id": p.name}) for p in folder.glob("*.txt")]
    index = HybridIndex(texts) if texts else None
    servers = [MCPServerSpec.python("sql", str(ROOT_DIR / "mcp_servers" / "sql_server.py"), "--db", str(DB))]
    local_tools = [{"name": "search_invoice_text", "description": "Search the raw text of text invoices (notes, terms).",
                    "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}]
    handlers = {"search_invoice_text": lambda query: index.search_text(query, 3) if index else "No text invoices."}
    return asyncio.run(run_mcp_agent(
        question, servers, local_tools=local_tools, local_handlers=handlers,
        system="You are an accounts-payable analyst. Use SQL over the invoices and line_items tables for numbers. "
               "Show a small table and the SQL you used.",
    ))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("extract")
    e.add_argument("folder", type=Path, nargs="?", default=HERE / "samples")
    a = sub.add_parser("ask")
    a.add_argument("question", nargs="+")
    a.add_argument("--folder", type=Path, default=HERE / "samples")
    args = parser.parse_args()
    if args.cmd == "extract":
        folder = args.folder if args.folder.exists() else HERE / args.folder
        extract_folder(folder)
    else:
        print("\n" + answer(" ".join(args.question), args.folder))
