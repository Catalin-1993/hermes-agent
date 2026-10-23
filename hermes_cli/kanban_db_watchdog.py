"""The board's watchdog: work that looks stuck, read off the board on demand.

Nothing here changes a card; each finding names what looks wrong and since when, so the owner
(or the Inbox) can act on it. What counts as stuck:

- ``stalled``: a running card whose worker has not checked in for a while;
- ``slow``: a running card going on far longer than its agent's usual run;
- ``failing``: a card whose attempts keep failing;
- ``waiting``: a blocked or in-review card nothing has happened to for a day;
- ``unclaimed``: a ready card no agent has picked up for hours;
- ``budget_pace``: an agent spending fast enough to pass its monthly budget before the month ends.
"""

from __future__ import annotations

import sqlite3
import time
from typing import Optional

STALLED_S = 15 * 60
SLOW_FACTOR = 3
SLOW_MIN_S = 30 * 60
FAILING_RUNS = 2
WAITING_S = 24 * 3600
UNCLAIMED_S = 2 * 3600
_FAILED = ("crashed", "timed_out", "spawn_failed", "gave_up")
_MONTH_S = 30 * 86_400


def _finding(kind: str, row: Optional[sqlite3.Row], since: int, value: float = 0, profile: str = "") -> dict:
    task_id = row["id"] if row is not None else ""
    return {"id": f"{kind}:{task_id or profile}", "kind": kind, "task_id": task_id,
            "task_title": row["title"] if row is not None else "",
            "profile": (row["assignee"] if row is not None else profile) or "", "since": int(since),
            "value": value}


def _medians(conn: sqlite3.Connection, now: int) -> dict[str, int]:
    lengths: dict[str, list[int]] = {}
    for row in conn.execute(
            "SELECT profile, ended_at - started_at AS took FROM task_runs WHERE outcome = 'completed' "
            "AND profile IS NOT NULL AND ended_at >= ?", (now - _MONTH_S,)):
        lengths.setdefault(row["profile"], []).append(max(0, int(row["took"])))
    return {name: sorted(values)[len(values) // 2] for name, values in lengths.items()}


def _running(conn: sqlite3.Connection, now: int) -> list[dict]:
    medians = _medians(conn, now)
    found = []
    for row in conn.execute(
            "SELECT t.id, t.title, t.assignee, t.last_heartbeat_at, r.started_at FROM tasks t "
            "JOIN task_runs r ON r.id = t.current_run_id WHERE t.status = 'running'"):
        started = int(row["started_at"])
        seen = int(row["last_heartbeat_at"] or started)
        usual = medians.get(row["assignee"] or "")
        if now - seen >= STALLED_S:
            found.append(_finding("stalled", row, seen, (now - seen) / 60))
        elif usual and now - started >= max(SLOW_MIN_S, SLOW_FACTOR * usual):
            found.append(_finding("slow", row, started, round((now - started) / max(usual, 1), 1)))
    return found


def _failing(conn: sqlite3.Connection) -> list[dict]:
    marks = ",".join("?" for _ in _FAILED)
    rows = conn.execute(
        "SELECT t.id, t.title, t.assignee, t.consecutive_failures, "
        f"(SELECT MAX(ended_at) FROM task_runs r WHERE r.task_id = t.id AND r.outcome IN ({marks})) AS last "
        "FROM tasks t WHERE t.status NOT IN ('done', 'archived') AND t.consecutive_failures >= ?",
        (*_FAILED, FAILING_RUNS))
    return [_finding("failing", row, row["last"] or 0, row["consecutive_failures"]) for row in rows]


def _idle(conn: sqlite3.Connection, now: int) -> list[dict]:
    """Blocked / in-review cards untouched for a day, ready ones unclaimed for hours."""
    found = []
    for row in conn.execute(
            "SELECT t.id, t.title, t.assignee, t.status, "
            "COALESCE((SELECT MAX(created_at) FROM task_events e WHERE e.task_id = t.id), t.created_at) AS moved "
            "FROM tasks t WHERE t.status IN ('blocked', 'review', 'ready')"):
        quiet = now - int(row["moved"])
        if row["status"] == "ready" and quiet >= UNCLAIMED_S:
            found.append(_finding("unclaimed", row, row["moved"], quiet / 3600))
        elif row["status"] != "ready" and quiet >= WAITING_S:
            found.append(_finding("waiting", row, row["moved"], quiet / 3600))
    return found


def _budget_pace(agents: list[dict], month_start: int, now: int) -> list[dict]:
    """Agents on course to pass their budget: this month's spend, carried on at the same pace."""
    elapsed = max(now - month_start, 3600)
    found = []
    for agent in agents:
        budget, spend = agent.get("monthly_budget_usd"), agent.get("month_spend_usd")
        if not budget or spend is None or spend >= budget or agent.get("paused"):
            continue
        projected = spend * _MONTH_S / elapsed
        if projected > budget and spend >= budget * 0.25:
            found.append(_finding("budget_pace", None, 0, round(projected, 2), agent["profile"]))  # a pace, not a moment
    return found


def findings(conn: sqlite3.Connection, controls: Optional[dict] = None, *, now: Optional[int] = None) -> list[dict]:
    """Everything that looks stuck on this board, worst first (running work, then failures,
    then waiting, then spend). ``controls`` is :func:`kanban_db_controls.overview`."""
    now = int(time.time()) if now is None else now
    pace = _budget_pace(controls["agents"], controls["month_start"], now) if controls else []
    return [*_running(conn, now), *_failing(conn), *_idle(conn, now), *pace]
