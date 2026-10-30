"""One agent's file for the Kanban dashboard: what it did on this board, how often it
succeeded, what it is scheduled to do, which tools it may use, and its standing instructions.

Read-only over the board's attempt record (``task_runs``) and the profile's own files
(``cron/jobs.json``, ``config.yaml``, ``SOUL.md``); nothing here starts or changes work.
Editing the instructions writes ``SOUL.md`` atomically; like every system-prompt change it
takes effect from the agent's next conversation, never mid-conversation.
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Optional

from hermes_cli.kanban_db_activity import _OUTCOME_BUCKET

_SUMMARY_MAX = 240
INSTRUCTIONS_MAX = 64_000


def profile_dir(name: str) -> Path:
    """The profile's home; ``LookupError`` when it does not exist."""
    from hermes_cli import profiles as profiles_mod

    try:
        path = profiles_mod.get_profile_dir(profiles_mod.normalize_profile_name(name))
    except ValueError as exc:
        raise LookupError(name) from exc
    if not path.is_dir():
        raise LookupError(name)
    return path


def _recent_runs(conn: sqlite3.Connection, profile: str, limit: int) -> list[dict]:
    rows = conn.execute(
        "SELECT r.id, r.task_id, r.status, r.outcome, r.started_at, r.ended_at, r.summary, r.error, t.title "
        "FROM task_runs r LEFT JOIN tasks t ON t.id = r.task_id "
        "WHERE r.profile = ? ORDER BY r.started_at DESC, r.id DESC LIMIT ?", (profile, limit))
    runs = []
    for row in rows:
        note = (row["summary"] or row["error"] or "").strip()
        runs.append({
            "id": int(row["id"]), "task_id": row["task_id"], "task_title": row["title"] or row["task_id"],
            "outcome": row["outcome"] or ("running" if row["ended_at"] is None else row["status"]),
            "started_at": int(row["started_at"]),
            "ended_at": int(row["ended_at"]) if row["ended_at"] is not None else None,
            "note": note[:_SUMMARY_MAX],
        })
    return runs


def _stats(conn: sqlite3.Connection, profile: str, since: int) -> dict:
    """Finished runs since ``since`` by bucket, the success rate and the median run length."""
    counts = {"completed": 0, "failed": 0, "blocked": 0, "other": 0}
    lengths = []
    for row in conn.execute(
            "SELECT outcome, started_at, ended_at FROM task_runs "
            "WHERE profile = ? AND ended_at IS NOT NULL AND ended_at >= ?", (profile, since)):
        counts[_OUTCOME_BUCKET.get(row["outcome"] or "", "other")] += 1
        lengths.append(max(0, int(row["ended_at"]) - int(row["started_at"])))
    finished = counts["completed"] + counts["failed"] + counts["blocked"]
    lengths.sort()
    return {**counts,
            "success_rate": round(counts["completed"] / finished * 100, 1) if finished else None,
            "median_seconds": lengths[len(lengths) // 2] if lengths else None}


def _open_cards(conn: sqlite3.Connection, profile: str) -> dict[str, int]:
    return {row["status"]: int(row["n"]) for row in conn.execute(
        "SELECT status, COUNT(*) AS n FROM tasks WHERE assignee = ? "
        "AND status NOT IN ('done', 'archived') GROUP BY status", (profile,))}


def _schedule(home: Path) -> list[dict]:
    """The profile's scheduled jobs, read straight from its ``cron/jobs.json`` (no locks,
    no repairs: a file mid-write or unreadable just shows no schedule this time)."""
    try:
        data = json.loads((home / "cron" / "jobs.json").read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return []
    jobs = data.get("jobs") if isinstance(data, dict) else data
    out = []
    for job in jobs if isinstance(jobs, list) else []:
        if not isinstance(job, dict):
            continue
        schedule = job.get("schedule")
        shown = job.get("schedule_display") or (schedule.get("display") or schedule.get("expr")
                                                if isinstance(schedule, dict) else schedule)
        out.append({"id": str(job.get("id") or ""), "name": str(job.get("name") or job.get("id") or ""),
                    "schedule": str(shown or ""), "enabled": bool(job.get("enabled", True)),
                    "next_run_at": job.get("next_run_at"), "last_run_at": job.get("last_run_at"),
                    "last_status": job.get("last_status")})
    return out


def _toolsets(home: Path) -> Optional[list[str]]:
    """The toolsets the profile turned on for its own chats (``platform_toolsets.cli``);
    ``None`` when it never chose, i.e. it runs Hermes' standard set."""
    import hermes_yaml
    from hermes_cli.config_backend import read_config_doc_readonly

    try:
        doc = read_config_doc_readonly(home / "config.yaml")
    except (OSError, hermes_yaml.YAMLError):  # missing or broken config: the standard set, as before
        doc = None
    chosen = ((doc if isinstance(doc, dict) else {}).get("platform_toolsets") or {})
    cli = chosen.get("cli") if isinstance(chosen, dict) else None
    return sorted(str(t) for t in cli) if isinstance(cli, list) else None


def read_instructions(home: Path) -> Optional[str]:
    try:
        return (home / "SOUL.md").read_text(encoding="utf-8-sig")
    except FileNotFoundError:
        return None


def write_instructions(home: Path, content: str) -> None:
    from utils import atomic_write_text

    if len(content) > INSTRUCTIONS_MAX:
        raise ValueError(f"instructions longer than {INSTRUCTIONS_MAX} characters")
    atomic_write_text(home / "SOUL.md", content, preserve_mode=True, create_mode=0o644)


def agent_file(conn: sqlite3.Connection, profile: str, *, days: int = 30, limit: int = 12,
               now: Optional[int] = None) -> dict:
    """Everything the agent page shows that ``/profiles`` and ``/controls`` don't."""
    home = profile_dir(profile)
    now = int(time.time()) if now is None else now
    instructions = read_instructions(home)
    return {
        "profile": profile,
        "window_days": days,
        "stats": _stats(conn, profile, now - days * 86_400),
        "open_cards": _open_cards(conn, profile),
        "runs": _recent_runs(conn, profile, limit),
        "schedule": _schedule(home),
        "toolsets": _toolsets(home),
        "instructions": instructions or "",
        "has_instructions": instructions is not None,
        "now": now,
    }
