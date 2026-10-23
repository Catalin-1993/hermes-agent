"""A board's approval rules: which finished work must be checked before it counts as Done.

Each rule names the cards it covers (finished by some agents, mentioning some words, at or above
a priority; empty = any) and who checks them: the owner, or a verifier agent. When a worker
calls ``kanban_complete`` and a rule covers its card, the card goes to Review instead of Done
(:func:`route_completion`): for a verifier, reassigned to that agent, which the review lane then
dispatches like any review; for the owner, *held* (``owner_holds``), so the review lane never
hands it to an agent (:func:`claim_hold`) and it waits in the owner's Inbox until they approve
it (Done) or send it back. A reviewer's own verdict is never re-routed, so a verifier's Done is
final. Rules live in the board's DB; the two tables are created on first use.
"""

from __future__ import annotations

import json
import sqlite3
import time
from typing import Any, Optional

from hermes_cli import kanban_db as _kb

ACTIONS = ("owner", "verifier")

_TABLES = (
    "CREATE TABLE IF NOT EXISTS board_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, "
    "enabled INTEGER NOT NULL DEFAULT 1, agents TEXT, keywords TEXT, min_priority INTEGER, "
    "action TEXT NOT NULL, verifier TEXT, created_at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS owner_holds (task_id TEXT PRIMARY KEY, rule_id INTEGER, rule_name TEXT, "
    "created_at INTEGER NOT NULL)",
)


def _ensure(conn: sqlite3.Connection) -> None:
    for sql in _TABLES:
        conn.execute(sql)


def _words(raw: Any) -> list[str]:
    items = raw if isinstance(raw, list) else str(raw or "").split(",")
    return list(dict.fromkeys(str(item).strip() for item in items if str(item).strip()))


def clean_rule(raw: dict) -> dict:
    """A rule as stored; ``ValueError`` for one that cannot work."""
    name = str(raw.get("name") or "").strip()[:80]
    action = raw.get("action")
    if not name:
        raise ValueError("a rule needs a name")
    if action not in ACTIONS:
        raise ValueError(f"action must be one of {', '.join(ACTIONS)}")
    verifier = str(raw.get("verifier") or "").strip() or None
    if action == "verifier" and not verifier:
        raise ValueError("a verifier rule needs the agent that checks")
    priority = raw.get("min_priority")
    return {"name": name, "enabled": bool(raw.get("enabled", True)), "agents": _words(raw.get("agents")),
            "keywords": _words(raw.get("keywords")),
            "min_priority": None if priority in (None, "") else int(priority),
            "action": action, "verifier": verifier if action == "verifier" else None}


def _row(row: sqlite3.Row) -> dict:
    return {"id": int(row["id"]), "name": row["name"], "enabled": bool(row["enabled"]),
            "agents": json.loads(row["agents"] or "[]"), "keywords": json.loads(row["keywords"] or "[]"),
            "min_priority": row["min_priority"], "action": row["action"], "verifier": row["verifier"]}


def list_rules(conn: sqlite3.Connection) -> list[dict]:
    _ensure(conn)
    return [_row(row) for row in conn.execute("SELECT * FROM board_rules ORDER BY id")]


def save_rule(conn: sqlite3.Connection, raw: dict, rule_id: Optional[int] = None) -> dict:
    """Add a rule, or replace rule ``rule_id`` (``LookupError`` when it is gone)."""
    rule = clean_rule(raw)
    values = (rule["name"], int(rule["enabled"]), json.dumps(rule["agents"]), json.dumps(rule["keywords"]),
              rule["min_priority"], rule["action"], rule["verifier"])
    _ensure(conn)
    with _kb.write_txn(conn):
        if rule_id is None:
            cur = conn.execute(
                "INSERT INTO board_rules (name, enabled, agents, keywords, min_priority, action, verifier, "
                "created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (*values, int(time.time())))
            rule_id = int(cur.lastrowid)
        elif conn.execute(
                "UPDATE board_rules SET name = ?, enabled = ?, agents = ?, keywords = ?, min_priority = ?, "
                "action = ?, verifier = ? WHERE id = ?", (*values, rule_id)).rowcount != 1:
            raise LookupError(rule_id)
    return {"id": rule_id, **rule}


def delete_rule(conn: sqlite3.Connection, rule_id: int) -> bool:
    _ensure(conn)
    with _kb.write_txn(conn):
        return conn.execute("DELETE FROM board_rules WHERE id = ?", (rule_id,)).rowcount == 1


def covers(rule: dict, *, agent: Optional[str], text: str, priority: int) -> bool:
    """Whether ``rule`` applies to work by ``agent`` whose card and handoff read ``text``."""
    if not rule["enabled"]:
        return False
    if rule["agents"] and agent not in rule["agents"]:
        return False
    if rule["min_priority"] is not None and priority < rule["min_priority"]:
        return False
    lowered = text.casefold()
    return not rule["keywords"] or any(word.casefold() in lowered for word in rule["keywords"])


def holds(conn: sqlite3.Connection) -> dict[str, dict]:
    """Cards waiting for the owner by task id (``{rule_id, rule_name, created_at}``); a hold whose
    card has left Review (approved, sent back, moved) is dropped here."""
    _ensure(conn)
    with _kb.write_txn(conn):
        conn.execute("DELETE FROM owner_holds WHERE task_id NOT IN "
                     "(SELECT id FROM tasks WHERE status IN ('review', 'running'))")
    return {row["task_id"]: {"rule_id": row["rule_id"], "rule_name": row["rule_name"],
                             "created_at": int(row["created_at"])}
            for row in conn.execute("SELECT task_id, rule_id, rule_name, created_at FROM owner_holds")}


def claim_hold(conn: sqlite3.Connection, task_id: str, lane: str) -> Optional[str]:
    """``owner_approval`` when the review lane must leave this card to the owner."""
    if lane != "review":
        return None
    _ensure(conn)
    row = conn.execute("SELECT 1 FROM owner_holds WHERE task_id = ?", (task_id,)).fetchone()
    return "owner_approval" if row else None


def _hold(conn: sqlite3.Connection, task_id: str, rule: Optional[dict]) -> None:
    with _kb.write_txn(conn):
        if rule is None:
            conn.execute("DELETE FROM owner_holds WHERE task_id = ?", (task_id,))
        else:
            conn.execute("INSERT OR REPLACE INTO owner_holds (task_id, rule_id, rule_name, created_at) "
                         "VALUES (?, ?, ?, ?)", (task_id, rule["id"], rule["name"], int(time.time())))


def route_completion(conn: sqlite3.Connection, task_id: str, *, summary: Optional[str],
                     result: Optional[str], metadata: Optional[dict],
                     run_id: Optional[int]) -> Optional[dict]:
    """Send a worker's finished card to Review when a rule covers it; ``None`` lets the
    completion go on to Done. The hold is written before the move, so no dispatcher tick can
    hand an owner's card to an agent in between."""
    task = _kb.get_task(conn, task_id)
    if task is None or task.status != "running" or _kb._retry_status_for_run(conn, task_id) == "review":
        return None
    from hermes_cli.kanban_db_rhythm import AUTHOR as CHECK_IN

    if task.created_by == CHECK_IN:  # a routine check-in is never held; the cards it creates are
        return None
    text = " ".join(part for part in (task.title, task.body, summary, result) if part)
    rule = next((r for r in list_rules(conn)
                 if covers(r, agent=task.assignee, text=text, priority=int(task.priority or 0))), None)
    # A verifier never checks its own work: such a card waits for the owner instead.
    owner = rule is not None and (rule["action"] == "owner" or rule["verifier"] == task.assignee)
    _hold(conn, task_id, rule if owner else None)
    if rule is None:
        return None
    reviewer = None if owner else rule["verifier"]
    handoff = dict(metadata or {})
    if result:
        handoff.setdefault("result", result)
    ok, _reason = _kb.request_review(conn, task_id, summary=summary or result, metadata=handoff or None,
                                    reviewer=reviewer, expected_run_id=run_id, with_reason=True)
    if not ok:
        _hold(conn, task_id, None)
        return None
    with _kb.write_txn(conn):
        _kb._append_event(conn, task_id, "approval_rule", {"rule": rule["name"], "checker": reviewer or "owner"})
    return {"rule": rule["name"], "checker": reviewer or "owner"}
