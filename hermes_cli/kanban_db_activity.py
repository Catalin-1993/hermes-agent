"""Board numbers: the per-status counts (``board_stats``), and for the Kanban overview what the
agents did lately.

Two read-only views over the attempt record (``task_runs``) and the audit trail
(``task_events``): finished runs per day, split by how they ended, with the
success rate over the window; and the most recent events a person would want to
see — a task created, taken, commented on, sent for review, finished or blocked —
each with its task's title and who did it.
"""

from __future__ import annotations

import datetime as dt
import json
import sqlite3
import time
from typing import Optional

from hermes_cli import kanban_db as _kb

# How a run ended, in the overview's three buckets (anything else is "other").
_OUTCOME_BUCKET = {
    "completed": "completed",
    "blocked": "blocked",
    "crashed": "failed",
    "timed_out": "failed",
    "spawn_failed": "failed",
    "gave_up": "failed",
}

# The events the activity feed shows: the moments a person follows, not the
# dispatcher's bookkeeping (heartbeats, reclaims, respawn guards, …).
FEED_KINDS = (
    "created", "assigned", "claimed", "commented", "review_requested", "completed",
    "blocked", "unblocked", "gave_up", "timed_out", "crashed",
)


def _local_day(ts: int) -> str:
    return dt.datetime.fromtimestamp(ts).date().isoformat()


def _runs_by_day(conn: sqlite3.Connection, start: int, days: list[str]) -> tuple[list[dict], dict[str, list[int]]]:
    """Finished runs per day by outcome, and per agent the finished runs per day (its sparkline)."""
    buckets = {day: {"date": day, "completed": 0, "failed": 0, "blocked": 0, "other": 0} for day in days}
    index = {day: i for i, day in enumerate(days)}
    by_profile: dict[str, list[int]] = {}
    rows = conn.execute(
        "SELECT ended_at, outcome, profile FROM task_runs WHERE ended_at IS NOT NULL AND ended_at >= ?", (start,))
    for row in rows:
        day = _local_day(int(row["ended_at"]))
        if day not in buckets:
            continue
        buckets[day][_OUTCOME_BUCKET.get(row["outcome"] or "", "other")] += 1
        if row["profile"]:
            by_profile.setdefault(row["profile"], [0] * len(days))[index[day]] += 1
    return [buckets[day] for day in days], by_profile


def _actor(payload: dict, run_profile: Optional[str], assignee: Optional[str]) -> str:
    for key in ("author", "assignee", "by"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    return run_profile or assignee or ""


def _feed(conn: sqlite3.Connection, limit: int) -> list[dict]:
    marks = ",".join("?" for _ in FEED_KINDS)
    rows = conn.execute(
        "SELECT e.id, e.task_id, e.kind, e.payload, e.created_at, t.title, t.assignee, r.profile "
        "FROM task_events e JOIN tasks t ON t.id = e.task_id "
        "LEFT JOIN task_runs r ON r.id = e.run_id "
        f"WHERE e.kind IN ({marks}) AND t.status != 'archived' "
        "ORDER BY e.id DESC LIMIT ?", (*FEED_KINDS, limit))
    feed = []
    for row in rows:
        try:
            payload = json.loads(row["payload"]) if row["payload"] else {}
        except (TypeError, ValueError):
            payload = {}
        payload = payload if isinstance(payload, dict) else {}
        feed.append({
            "id": int(row["id"]),
            "task_id": row["task_id"],
            "task_title": row["title"] or row["task_id"],
            "kind": row["kind"],
            "actor": _actor(payload, row["profile"], row["assignee"]),
            "created_at": int(row["created_at"]),
        })
    return feed


def board_activity(conn: sqlite3.Connection, *, days: int = 14, limit: int = 30,
                   now: Optional[int] = None) -> dict:
    """Runs per local day for the last ``days`` days (oldest first, every day present),
    their totals and success rate (completed over finished; ``None`` with none), each
    agent's finished runs per day, and the newest ``limit`` feed events."""
    now = int(time.time()) if now is None else now
    today = dt.datetime.fromtimestamp(now).date()
    first = today - dt.timedelta(days=days - 1)
    start = int(dt.datetime.combine(first, dt.time.min).timestamp())
    per_day, by_profile = _runs_by_day(conn, start, [(first + dt.timedelta(days=i)).isoformat() for i in range(days)])
    totals = {key: sum(day[key] for day in per_day) for key in ("completed", "failed", "blocked", "other")}
    finished = totals["completed"] + totals["failed"] + totals["blocked"]
    return {
        "days": per_day,
        "totals": totals,
        "success_rate": round(totals["completed"] / finished * 100, 1) if finished else None,
        "by_profile": by_profile,
        "events": _feed(conn, limit),
        "now": now,
    }


def board_stats(conn: sqlite3.Connection) -> dict:
    """Per-status + per-assignee counts and the oldest ``ready`` age (staleness signal)."""
    by_status: dict[str, int] = {}
    for row in conn.execute(
        "SELECT status, COUNT(*) AS n FROM tasks "
        "WHERE status != 'archived' GROUP BY status"
    ):
        by_status[row["status"]] = int(row["n"])

    by_assignee = _kb._counts_by_assignee(conn)

    oldest_row = conn.execute(
        "SELECT MIN(created_at) AS ts FROM tasks WHERE status = 'ready'"
    ).fetchone()
    now = int(time.time())
    oldest_ready_age = (
        (now - int(oldest_row["ts"]))
        if oldest_row and oldest_row["ts"] is not None else None
    )

    return {
        "by_status": by_status,
        "by_assignee": by_assignee,
        "oldest_ready_age_seconds": oldest_ready_age,
        "now": now,
    }
