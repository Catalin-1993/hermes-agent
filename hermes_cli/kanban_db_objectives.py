"""A board's goals: what the work is for.

A goal (called *objective* in code, so it never reads as the per-card ``goal_mode`` loop) has a
title, why it matters, an owner agent and an optional target date. Cards are linked to it
directly, and every card created from a linked card (its children in ``task_links``, at any
depth) counts toward it too, so a lead who plans a goal into sub-cards grows the goal by
itself. Progress is the share of those cards that are done.

Workers see the goal their card serves (:func:`objective_context`), and the owner can hand a
goal to its owner agent to plan (:func:`plan`): one card, linked to the goal, asking for the
steps as child cards.
"""

from __future__ import annotations

import datetime as dt
import sqlite3
import time
from typing import Optional

from hermes_cli import kanban_db as _kb

STATUSES = ("active", "achieved", "dropped")
PLAN_AUTHOR = "goals"

_TABLES = (
    "CREATE TABLE IF NOT EXISTS board_objectives (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, "
    "why TEXT, owner TEXT, target_date TEXT, status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS objective_cards (task_id TEXT PRIMARY KEY, objective_id INTEGER NOT NULL)",
)

# Every card serving an objective: the linked ones and, at any depth, the cards created from them.
_TREE = (
    "WITH RECURSIVE tree(id) AS (SELECT task_id FROM objective_cards WHERE objective_id = ? "
    "UNION SELECT l.child_id FROM task_links l JOIN tree ON l.parent_id = tree.id) "
    "SELECT t.id, t.title, t.status, t.assignee, t.created_by, t.completed_at FROM tasks t JOIN tree ON tree.id = t.id "
    "WHERE t.status != 'archived'"
)


def _ensure(conn: sqlite3.Connection) -> None:
    for sql in _TABLES:
        conn.execute(sql)


def _exists(conn: sqlite3.Connection) -> bool:
    """Whether this board has goals at all. Read paths ask this instead of creating the tables:
    a worker's context is built on connections that may not write (descendant scopes)."""
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'objective_cards'").fetchone() is not None


def clean(raw: dict) -> dict:
    """A goal as stored; ``ValueError`` for one that cannot be kept."""
    title = str(raw.get("title") or "").strip()[:120]
    if not title:
        raise ValueError("a goal needs a title")
    status = raw.get("status") or "active"
    if status not in STATUSES:
        raise ValueError(f"status must be one of {', '.join(STATUSES)}")
    target = str(raw.get("target_date") or "").strip() or None
    if target:
        dt.date.fromisoformat(target)  # ValueError for anything but YYYY-MM-DD
    return {"title": title, "why": str(raw.get("why") or "").strip()[:1000],
            "owner": str(raw.get("owner") or "").strip() or None, "target_date": target, "status": status}


def _progress(conn: sqlite3.Connection, objective_id: int) -> dict:
    cards = [dict(row) for row in conn.execute(_TREE, (objective_id,))]
    counts = {"done": 0, "running": 0, "blocked": 0, "open": 0}
    for card in cards:
        status = card["status"]
        counts[status if status in ("done", "running", "blocked") else "open"] += 1
    total = len(cards)
    return {**counts, "total": total, "percent": round(counts["done"] / total * 100) if total else 0,
            "cards": sorted(cards, key=lambda c: (c["status"] == "done", c["title"] or ""))}


def list_objectives(conn: sqlite3.Connection) -> list[dict]:
    """Every goal with its progress and cards (open ones first), active goals first."""
    if not _exists(conn):
        return []
    rows = conn.execute("SELECT * FROM board_objectives ORDER BY CASE status WHEN 'active' THEN 0 "
                        "WHEN 'achieved' THEN 1 ELSE 2 END, COALESCE(target_date, '9999'), id").fetchall()
    linked = {}
    for row in conn.execute("SELECT task_id, objective_id FROM objective_cards"):
        linked.setdefault(row["objective_id"], []).append(row["task_id"])
    return [{"id": int(row["id"]), "title": row["title"], "why": row["why"] or "", "owner": row["owner"],
             "target_date": row["target_date"], "status": row["status"], "created_at": int(row["created_at"]),
             "linked": sorted(linked.get(row["id"], [])), **_progress(conn, int(row["id"]))}
            for row in rows]


def save(conn: sqlite3.Connection, raw: dict, objective_id: Optional[int] = None) -> int:
    goal = clean(raw)
    values = (goal["title"], goal["why"], goal["owner"], goal["target_date"], goal["status"])
    _ensure(conn)
    with _kb.write_txn(conn):
        if objective_id is None:
            return int(conn.execute(
                "INSERT INTO board_objectives (title, why, owner, target_date, status, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)", (*values, int(time.time()))).lastrowid)
        if conn.execute("UPDATE board_objectives SET title = ?, why = ?, owner = ?, target_date = ?, status = ? "
                        "WHERE id = ?", (*values, objective_id)).rowcount != 1:
            raise LookupError(objective_id)
    return objective_id


def delete(conn: sqlite3.Connection, objective_id: int) -> bool:
    """Drop the goal; its cards stay on the board, unlinked."""
    _ensure(conn)
    with _kb.write_txn(conn):
        conn.execute("DELETE FROM objective_cards WHERE objective_id = ?", (objective_id,))
        return conn.execute("DELETE FROM board_objectives WHERE id = ?", (objective_id,)).rowcount == 1


def link(conn: sqlite3.Connection, objective_id: Optional[int], task_ids: list[str]) -> None:
    """Point each card at ``objective_id`` (a card serves one goal), or unlink it with ``None``."""
    _ensure(conn)
    with _kb.write_txn(conn):
        if objective_id is not None and conn.execute(
                "SELECT 1 FROM board_objectives WHERE id = ?", (objective_id,)).fetchone() is None:
            raise LookupError(objective_id)
        for task_id in task_ids:
            if objective_id is None:
                conn.execute("DELETE FROM objective_cards WHERE task_id = ?", (task_id,))
            elif _kb.get_task(conn, task_id) is not None:
                conn.execute("INSERT OR REPLACE INTO objective_cards (task_id, objective_id) VALUES (?, ?)",
                             (task_id, objective_id))


def serving(conn: sqlite3.Connection, task_id: str) -> Optional[dict]:
    """The goal a card serves: its own link, else the nearest linked ancestor's."""
    if not _exists(conn):
        return None
    row = conn.execute(
        "WITH RECURSIVE up(id, depth) AS (SELECT ?, 0 UNION SELECT l.parent_id, up.depth + 1 FROM task_links l "
        "JOIN up ON l.child_id = up.id WHERE up.depth < 50) "
        "SELECT o.* FROM up JOIN objective_cards c ON c.task_id = up.id "
        "JOIN board_objectives o ON o.id = c.objective_id WHERE o.status = 'active' ORDER BY up.depth LIMIT 1",
        (task_id,)).fetchone()
    return dict(row) if row else None


def objective_context(conn: sqlite3.Connection, task_id: str) -> list[str]:
    """The worker-context section naming the goal this card serves, or nothing."""
    goal = serving(conn, task_id)
    if goal is None:
        return []
    progress = _progress(conn, int(goal["id"]))
    lines = ["## The goal this serves", f"**{goal['title']}**"
             + (f" (target {goal['target_date']})" if goal["target_date"] else "")]
    if goal["why"]:
        lines.append(f"Why it matters: {goal['why']}")
    lines += [f"Progress: {progress['done']} of {progress['total']} cards done. Keep this card's work aimed "
              "at the goal; new work you create from it counts toward it.", ""]
    return lines


def plan(conn: sqlite3.Connection, objective_id: int) -> str:
    """Hand the goal to its owner agent: one card, linked to the goal, asking for the plan."""
    goal = next((g for g in list_objectives(conn) if g["id"] == objective_id), None)
    if goal is None:
        raise LookupError(objective_id)
    if not goal["owner"]:
        raise ValueError("the goal has no owner agent to plan it")
    body = (f"Plan the goal **{goal['title']}**"
            + (f" (target {goal['target_date']})" if goal["target_date"] else "") + ".\n\n"
            + (f"Why it matters: {goal['why']}\n\n" if goal["why"] else "")
            + "Break it into 3-7 concrete cards with `kanban_create`, each assigned to the right agent and "
              "with `parents` set to this card's id, so they count toward the goal and start once you "
              "finish this one. Then finish this card with the plan in two or three lines.")
    task_id = _kb.create_task(conn, title=f"Plan: {goal['title']}", body=body, assignee=goal["owner"],
                              created_by=PLAN_AUTHOR)
    link(conn, objective_id, [task_id])
    return task_id
