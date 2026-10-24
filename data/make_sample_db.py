"""Create data/nimbus.db - a small, deterministic SQLite database used by Day 26 and Project 07."""

import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

DB = Path(__file__).resolve().parent / "nimbus.db"
PLANS = {"Starter": 19, "Pro": 79, "Enterprise": 1500}
REGIONS = ["us-east", "us-west", "eu-central", "ap-south", "ap-southeast"]
COMPANIES = ["Acme", "Globex", "Initech", "Umbrella", "Hooli", "Stark", "Wayne", "Wonka", "Tyrell", "Cyberdyne",
             "Soylent", "Aperture", "Vandelay", "Pied Piper", "Gringotts", "Monarch", "Oscorp", "Duff", "Krusty", "Nakatomi"]


def build(path: Path = DB) -> Path:
    rng = random.Random(42)
    path.unlink(missing_ok=True)
    con = sqlite3.connect(path)
    con.executescript("""
        CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, plan TEXT, region TEXT, signup_date TEXT);
        CREATE TABLE invoices  (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id),
                                month TEXT, amount_usd REAL, status TEXT);
        CREATE TABLE tickets   (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id),
                                opened TEXT, severity TEXT, topic TEXT, resolved INTEGER);
    """)
    for cid, name in enumerate(COMPANIES, 1):
        plan = rng.choices(list(PLANS), weights=[5, 10, 3])[0]
        signup = date(2025, 1, 1) + timedelta(days=rng.randint(0, 400))
        con.execute("INSERT INTO customers VALUES (?,?,?,?,?)", (cid, f"{name} Inc", plan, rng.choice(REGIONS), signup.isoformat()))
        for m in range(1, 13):
            amount = PLANS[plan] * (1 + rng.random() * 0.3)
            status = rng.choices(["paid", "overdue", "refunded"], weights=[90, 7, 3])[0]
            con.execute("INSERT INTO invoices (customer_id, month, amount_usd, status) VALUES (?,?,?,?)",
                        (cid, f"2026-{m:02d}", round(amount, 2), status))
        for _ in range(rng.randint(0, 6)):
            opened = date(2026, 1, 1) + timedelta(days=rng.randint(0, 290))
            con.execute("INSERT INTO tickets (customer_id, opened, severity, topic, resolved) VALUES (?,?,?,?,?)",
                        (cid, opened.isoformat(), rng.choices(["SEV1", "SEV2", "SEV3"], weights=[1, 3, 8])[0],
                         rng.choice(["billing", "api", "deploy", "database", "dns", "security"]), rng.random() > 0.2))
    con.commit()
    con.close()
    return path


if __name__ == "__main__":
    print(f"wrote {build()}")
