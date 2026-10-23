"""Each agent's rhythm on a board: a regular check-in, so the team keeps moving without the owner
having to start every piece of work.

A rhythm is an interval (every hour … every day), an optional window of active hours and a
weekdays-only switch. When a check-in is due, the dispatcher's tick (:func:`fire_due`) puts one
card on the board for the agent: look at your open cards and the goals you own, do the next most
useful thing (move work on, ask, delegate), and finish with a short note. It is an ordinary card,
so the agent's pause and monthly budget gate it like any other; a check-in is skipped while the
previous one is still open, or while the agent may not pick up work. Off unless the owner turns
it on, because every check-in is a paid run.
"""

from __future__ import annotations

import datetime as dt
import sqlite3
import time
from typing import Optional

from hermes_cli import kanban_db as _kb

AUTHOR = "rhythm"
MIN_EVERY, MAX_EVERY = 30, 7 * 24 * 60

_TABLE = (
    "CREATE TABLE IF NOT EXISTS agent_rhythm (profile TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0, "
    "every_minutes INTEGER NOT NULL DEFAULT 240, start_hour INTEGER NOT NULL DEFAULT 8, "
    "end_hour INTEGER NOT NULL DEFAULT 20, weekdays_only INTEGER NOT NULL DEFAULT 0, "
    "last_fired_at INTEGER, last_task_id TEXT)"
)
_DEFAULTS = {"enabled": False, "every_minutes": 240, "start_hour": 8, "end_hour": 20, "weekdays_only": False,
             "last_fired_at": None, "last_task_id": None}


def _ensure(conn: sqlite3.Connection) -> None:
    conn.execute(_TABLE)


def in_window(rhythm: dict, ts: float) -> bool:
    """Whether ``ts`` (local time) falls in the rhythm's active hours and days. Equal start and
    end hours mean all day; a start after the end wraps past midnight."""
    when = dt.datetime.fromtimestamp(ts)
    if rhythm["weekdays_only"] and when.weekday() >= 5:
        return False
    start, end = rhythm["start_hour"], rhythm["end_hour"]
    if start == end:
        return True
    return start <= when.hour < end if start < end else (when.hour >= start or when.hour < end)


def next_at(rhythm: dict, now: float) -> Optional[int]:
    """When the next check-in may fire: the interval after the last one, moved on to the next
    active hour. ``None`` while the rhythm is off."""
    if not rhythm["enabled"]:
        return None
    due = max(int(now), int(rhythm["last_fired_at"] or 0) + rhythm["every_minutes"] * 60)
    for _ in range(24 * 8):  # hour steps: a week and a day always reaches an active hour
        if in_window(rhythm, due):
            return due
        due = int((dt.datetime.fromtimestamp(due).replace(minute=0, second=0) + dt.timedelta(hours=1)).timestamp())
    return None


def _row(row: Optional[sqlite3.Row]) -> dict:
    if row is None:
        return dict(_DEFAULTS)
    return {"enabled": bool(row["enabled"]), "every_minutes": int(row["every_minutes"]),
            "start_hour": int(row["start_hour"]), "end_hour": int(row["end_hour"]),
            "weekdays_only": bool(row["weekdays_only"]), "last_fired_at": row["last_fired_at"],
            "last_task_id": row["last_task_id"]}


def get(conn: sqlite3.Connection, profile: str, *, now: Optional[float] = None) -> dict:
    _ensure(conn)
    rhythm = _row(conn.execute("SELECT * FROM agent_rhythm WHERE profile = ?", (profile,)).fetchone())
    return {"profile": profile, **rhythm, "next_at": next_at(rhythm, time.time() if now is None else now)}


def list_all(conn: sqlite3.Connection, *, now: Optional[float] = None) -> dict[str, dict]:
    _ensure(conn)
    now = time.time() if now is None else now
    out = {}
    for row in conn.execute("SELECT * FROM agent_rhythm"):
        rhythm = _row(row)
        out[row["profile"]] = {"profile": row["profile"], **rhythm, "next_at": next_at(rhythm, now)}
    return out


def set_rhythm(conn: sqlite3.Connection, profile: str, raw: dict) -> dict:
    """Update the passed fields; ``ValueError`` for an interval or hour out of range."""
    current = get(conn, profile)
    merged = {key: raw[key] if raw.get(key) is not None else current[key]
              for key in ("enabled", "every_minutes", "start_hour", "end_hour", "weekdays_only")}
    if not MIN_EVERY <= int(merged["every_minutes"]) <= MAX_EVERY:
        raise ValueError(f"every_minutes must be between {MIN_EVERY} and {MAX_EVERY}")
    if not (0 <= int(merged["start_hour"]) <= 23 and 0 <= int(merged["end_hour"]) <= 23):
        raise ValueError("hours must be between 0 and 23")
    with _kb.write_txn(conn):
        conn.execute(
            "INSERT INTO agent_rhythm (profile, enabled, every_minutes, start_hour, end_hour, weekdays_only) "
            "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(profile) DO UPDATE SET enabled = excluded.enabled, "
            "every_minutes = excluded.every_minutes, start_hour = excluded.start_hour, "
            "end_hour = excluded.end_hour, weekdays_only = excluded.weekdays_only",
            (profile, int(bool(merged["enabled"])), int(merged["every_minutes"]), int(merged["start_hour"]),
             int(merged["end_hour"]), int(bool(merged["weekdays_only"]))))
    return get(conn, profile)


def _body(conn: sqlite3.Connection, profile: str) -> str:
    from hermes_cli import kanban_db_objectives as kbobj

    owned = [g for g in kbobj.list_objectives(conn) if g["owner"] == profile and g["status"] == "active"]
    open_cards = conn.execute(
        "SELECT title, status FROM tasks WHERE assignee = ? AND status IN ('todo', 'ready', 'blocked', 'review') "
        "AND created_by IS NOT ? ORDER BY priority DESC, created_at LIMIT 10", (profile, AUTHOR)).fetchall()
    lines = ["Your regular check-in on this board.", ""]
    if owned:
        lines.append("Goals you own:")
        lines += [f"- {g['title']}: {g['done']} of {g['total']} cards done"
                  + (f", target {g['target_date']}" if g["target_date"] else "") for g in owned]
        lines.append("")
    if open_cards:
        lines.append("Your open cards:")
        lines += [f"- {row['title']} ({row['status']})" for row in open_cards]
        lines.append("")
    lines.append("Do the next most useful thing: move a card on, ask for what you are missing, or delegate "
                 "with `kanban_create` (a goal moves when its cards do). Keep it short. Finish this card with "
                 "one or two lines on what you did; when nothing needs you, say so and finish.")
    return "\n".join(lines)


def check_in(conn: sqlite3.Connection, profile: str, *, now: Optional[float] = None) -> str:
    """Put a check-in card on the board for ``profile`` now, and remember it."""
    now = int(time.time() if now is None else now)
    stamp = dt.datetime.fromtimestamp(now).strftime("%a %H:%M")
    task_id = _kb.create_task(conn, title=f"Check-in: {profile} · {stamp}", body=_body(conn, profile),
                              assignee=profile, created_by=AUTHOR,
                              idempotency_key=f"rhythm:{profile}:{now // 60}")
    _ensure(conn)
    with _kb.write_txn(conn):
        conn.execute("INSERT INTO agent_rhythm (profile) VALUES (?) ON CONFLICT(profile) DO NOTHING", (profile,))
        conn.execute("UPDATE agent_rhythm SET last_fired_at = ?, last_task_id = ? WHERE profile = ?",
                     (now, task_id, profile))
    return task_id


def _previous_open(conn: sqlite3.Connection, task_id: Optional[str]) -> bool:
    if not task_id:
        return False
    row = conn.execute("SELECT status FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return row is not None and row["status"] not in ("done", "archived")


def fire_due(conn: sqlite3.Connection, *, now: Optional[float] = None) -> list[str]:
    """Check-in cards for every agent whose rhythm is due (one dispatcher tick)."""
    from hermes_cli import kanban_db_controls as kbctl

    now = time.time() if now is None else now
    fired = []
    for profile, rhythm in list_all(conn, now=now).items():
        due = rhythm["next_at"]
        if due is None or due > now or not in_window(rhythm, now) or _previous_open(conn, rhythm["last_task_id"]):
            continue
        if kbctl.claim_block_reason(conn, profile) is None:
            fired.append(check_in(conn, profile, now=now))
    return fired


def tick(conn: sqlite3.Connection) -> list[str]:
    """:func:`fire_due` for the dispatcher: a broken rhythm never stops the board's dispatch."""
    try:
        return fire_due(conn)
    except Exception as exc:  # health: allow BLE001 -- check-ins are extra; dispatch must go on
        _kb._log.warning("kanban: agent check-ins skipped this tick (%s: %s)", type(exc).__name__, exc)
        return []
