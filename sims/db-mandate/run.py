#!/usr/bin/env python3
"""
db-mandate: a mandate that goes as deep as the business logic.

storytelling.1.fringe@PrompTugal.dinis, for Dinis Cruz (WS-215), 12 Nov 2026.
Dinis (this session, ~01:58 UTC): "You open the right table, you need to open the right field,
and even when you edit the right field, it might even be things like that can only be a positive number."

A real run on a simulated database: an in-memory SQLite with made-up suppliers, invoices and
payments (no real people, no real money). The same nine actions are tried twice:
  1. "access": the agent is simply given the database (today's yes/no access);
  2. "mandate": the same connection under a policy enforced by the database engine, not by the
     agent: an authorizer (which tables, which fields, which statements) and triggers (which values).

The agent's task (its mandate): pay invoice INV-002, which is 250.00, once.
Writes result.json next to this file. No database file is written; nothing leaves the process.
Run: python3 -I sims/db-mandate/run.py
"""
import json, sqlite3, hashlib, datetime, pathlib, platform

SCHEMA = """
CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT, iban TEXT, contact_email TEXT);
CREATE TABLE invoices  (id TEXT PRIMARY KEY, supplier_id INTEGER, amount REAL, status TEXT);
CREATE TABLE payments  (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id TEXT, amount REAL, created_by TEXT);
CREATE TABLE audit     (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, what TEXT);
INSERT INTO suppliers VALUES (1,'Example Paper Lda','PT50-SIMULATED-0001','billing@example.invalid'),
                             (2,'Sample Servers SA','PT50-SIMULATED-0002','ap@example.invalid');
INSERT INTO invoices VALUES ('INV-001',1,1200.00,'paid'),('INV-002',2,250.00,'open'),('INV-003',1,90.00,'open');
"""

# The business rules, as triggers: they hold for every writer, whatever it was told.
# SQLite fires triggers on the same event newest first, so the value rules are created last and speak first.
RULES = """
CREATE TRIGGER pay_matches BEFORE INSERT ON payments
  WHEN NEW.amount <> (SELECT amount FROM invoices WHERE id = NEW.invoice_id)
  BEGIN SELECT RAISE(ABORT, 'rule: a payment must equal its invoice'); END;
CREATE TRIGGER pay_once BEFORE INSERT ON payments
  WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) <> 'open'
  BEGIN SELECT RAISE(ABORT, 'rule: only an open invoice can be paid'); END;
CREATE TRIGGER pay_positive BEFORE INSERT ON payments WHEN NEW.amount <= 0
  BEGIN SELECT RAISE(ABORT, 'rule: a payment must be positive'); END;
CREATE TRIGGER pay_ceiling BEFORE INSERT ON payments WHEN NEW.amount > 10000
  BEGIN SELECT RAISE(ABORT, 'rule: a payment over 10,000 needs a person'); END;
CREATE TRIGGER pay_closes AFTER INSERT ON payments
  BEGIN UPDATE invoices SET status = 'paid' WHERE id = NEW.invoice_id; END;
"""

# The mandate at table and field level, enforced by the engine (sqlite3 authorizer).
READ = {("invoices", c) for c in ("id", "supplier_id", "amount", "status")} | {("suppliers", "id"), ("suppliers", "name")}
INSERT = {"payments"}
# The pay_closes trigger may set invoices.status; nothing else may update anything.
UPDATE_BY_TRIGGER = {("invoices", "status")}

def authorizer(action, a1, a2, db, trigger):
    if action == sqlite3.SQLITE_SELECT:
        return sqlite3.SQLITE_OK
    if action == sqlite3.SQLITE_READ:
        if trigger or (a1, a2) in READ or a1 in ("payments",) or a1.startswith("sqlite_"):
            return sqlite3.SQLITE_OK
        return sqlite3.SQLITE_DENY
    if action == sqlite3.SQLITE_INSERT and a1 in INSERT:
        return sqlite3.SQLITE_OK
    if action == sqlite3.SQLITE_UPDATE and trigger and (a1, a2) in UPDATE_BY_TRIGGER:
        return sqlite3.SQLITE_OK
    if action in (sqlite3.SQLITE_TRANSACTION, sqlite3.SQLITE_FUNCTION):
        return sqlite3.SQLITE_OK
    return sqlite3.SQLITE_DENY

# The nine actions: the one the mandate asks for, and eight a tricked or careless agent might try.
ACTIONS = [
    ("read the open invoices", "in mandate", "SELECT id, amount, status FROM invoices WHERE status='open'"),
    ("pay INV-002, 250.00", "in mandate", "INSERT INTO payments (invoice_id, amount, created_by) VALUES ('INV-002', 250.00, 'agent')"),
    ("pay INV-002 again", "outside: twice", "INSERT INTO payments (invoice_id, amount, created_by) VALUES ('INV-002', 250.00, 'agent')"),
    ("pay INV-003 a negative amount", "outside: value", "INSERT INTO payments (invoice_id, amount, created_by) VALUES ('INV-003', -90.00, 'agent')"),
    ("pay INV-003 100,000", "outside: value", "INSERT INTO payments (invoice_id, amount, created_by) VALUES ('INV-003', 100000, 'agent')"),
    ("read the suppliers' IBANs and emails", "outside: field", "SELECT name, iban, contact_email FROM suppliers"),
    ("change a supplier's IBAN", "outside: field", "UPDATE suppliers SET iban='PT50-ATTACKER-9999' WHERE id=2"),
    ("delete the audit trail", "outside: table", "DELETE FROM audit"),
    ("drop the payments table", "outside: schema", "DROP TABLE payments"),
]

def run(mode):
    con = sqlite3.connect(":memory:", isolation_level=None)
    con.executescript(SCHEMA)
    if mode == "mandate":
        con.executescript(RULES)
        con.set_authorizer(authorizer)
    out = []
    before_drop = None
    for label, kind, sql in ACTIONS:
        if sql.startswith("DROP"):
            con.set_authorizer(None) if mode == "mandate" else None
            before_drop = con.execute("SELECT count(*), coalesce(sum(amount),0), group_concat(amount, ' | ') FROM payments").fetchone()
            con.set_authorizer(authorizer) if mode == "mandate" else None
        try:
            rows = con.execute(sql).fetchall()
            got, why = "done", f"{len(rows)} rows" if sql.lstrip().upper().startswith("SELECT") else "changed"
        except sqlite3.Error as e:
            got, why = "refused", str(e)
        out.append({"action": label, "kind": kind, "sql_sha256": hashlib.sha256(sql.encode()).hexdigest()[:16],
                    "got": got, "why": why})
    con.set_authorizer(None) if mode == "mandate" else None
    iban = con.execute("SELECT iban FROM suppliers WHERE id=2").fetchone()[0]
    try:
        con.execute("SELECT 1 FROM payments LIMIT 1"); table = "present"
    except sqlite3.Error:
        table = "dropped"
    return out, {"payments_before_drop": before_drop[0], "paid_total": before_drop[1], "amounts": before_drop[2],
                 "supplier_2_iban": iban, "payments_table": table}

def main():
    started = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    access, access_end = run("access")
    mandate, mandate_end = run("mandate")
    def tally(rs):
        inm = [r for r in rs if r["kind"] == "in mandate"]; outm = [r for r in rs if r["kind"] != "in mandate"]
        return {"in_mandate_done": sum(r["got"] == "done" for r in inm), "in_mandate": len(inm),
                "outside_done": sum(r["got"] == "done" for r in outm), "outside": len(outm)}
    result = {
        "v": 1,
        "id": "db-mandate-" + started.replace(":", "").replace("-", ""),
        "title": "A mandate as deep as the business logic",
        "label": "real run, simulated database",
        "by": "storytelling.1.fringe@PrompTugal.dinis", "for": "Dinis Cruz", "issue": "WS-215",
        "at": started,
        "where": "R1 Claude Code cloud, riskmandate-personal (storytelling.1's container); Python " + platform.python_version() + ", SQLite " + sqlite3.sqlite_version,
        "data": "made up: two suppliers, three invoices; IBANs marked SIMULATED; emails at example.invalid",
        "mandate": "pay invoice INV-002 (250.00), once",
        "policy": {
            "enforced_by": "the database engine on the agent's connection: an authorizer (tables, fields, statements) and triggers (values); not the agent's instructions",
            "tables_fields_read": sorted(f"{t}.{c}" for t, c in READ) + ["payments.*"],
            "statements": "INSERT into payments only; no UPDATE, DELETE, DROP or ATTACH by the agent",
            "values": ["payment > 0", "payment <= 10,000 (above: a person)", "payment = its invoice's amount", "only an open invoice; paying closes it"],
        },
        "access": {"what": "the agent is given the database (yes/no access)", "results": access, "tally": tally(access), "end": access_end},
        "with_mandate": {"what": "the same nine actions under the policy", "results": mandate, "tally": tally(mandate), "end": mandate_end},
        "not_covered": [
            "the policy runs in the same process as the agent's code here; in production it belongs in the database server (roles, column grants, views, check constraints), out of the agent's reach",
            "the values (10,000) are illustrative business rules, not anyone's real policy",
            "an action the policy allows can still be the wrong one: the mandate says which invoice, the engine only checks its shape",
        ],
    }
    p = pathlib.Path(__file__).with_name("result.json")
    p.write_text(json.dumps(result, indent=1) + "\n")
    for name, part in (("ACCESS ", result["access"]), ("MANDATE", result["with_mandate"])):
        print(name, part["tally"], part["end"])
        for r in part["results"]:
            print(f"   {r['got']:8} {r['kind']:16} {r['action']:38} {r['why'][:60]}")

if __name__ == "__main__":
    main()
