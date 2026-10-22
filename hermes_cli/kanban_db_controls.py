"""Who may pick up cards: the owner's controls over a board's agents (pause, and a monthly
spend limit), and this home's claim allowlist ``kanban.dispatch_profiles``.

A pause stops an agent (or, under the profile ``*``, everyone) from picking up new
cards on this board; work already running is left alone unless the owner stops it.
A monthly budget is checked against what the agent spent this calendar month across
all its conversations (its own ``state.db``); once reached, the agent is paused with
the reason ``budget`` and stays paused until the owner raises the limit or the month
turns. Both live in the board's ``agent_controls`` table and gate every claim in the
dispatcher (:func:`claim_block_reason`).
"""

from __future__ import annotations

import datetime as dt
import sqlite3
import time
from pathlib import Path
from collections.abc import Mapping
from typing import Optional

from hermes_cli import kanban_db as _kb

ALL = "*"
_SPEND_TTL_S = 30
# (state.db path, month start) -> (read at, spend, sessions with no known cost)
_spend_cache: dict[tuple[str, int], tuple[float, Optional[float], int]] = {}


def month_start(now: Optional[float] = None) -> int:
    today = dt.datetime.fromtimestamp(time.time() if now is None else now)
    return int(today.replace(day=1, hour=0, minute=0, second=0, microsecond=0).timestamp())


def _state_db(profile: str) -> Optional[Path]:
    from hermes_cli.profiles import get_profile_dir

    try:
        path = get_profile_dir(profile) / "state.db"
    except (ValueError, FileNotFoundError):
        return None
    return path if path.is_file() else None


def month_spend(profile: str, *, now: Optional[float] = None) -> tuple[Optional[float], int]:
    """What ``profile`` spent this month in USD (actual cost where known, else the
    estimate) and how many of its conversations carry no cost at all. ``None`` when
    the profile has no conversation store. Read-only, cached for half a minute."""
    path = _state_db(profile)
    if path is None:
        return None, 0
    start = month_start(now)
    key = (str(path), start)
    cached = _spend_cache.get(key)
    if cached and time.time() - cached[0] < _SPEND_TTL_S:
        return cached[1], cached[2]
    try:
        with sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=2) as conn:
            row = conn.execute(
                "SELECT COALESCE(SUM(COALESCE(actual_cost_usd, estimated_cost_usd)), 0), "
                "SUM(CASE WHEN actual_cost_usd IS NULL AND estimated_cost_usd IS NULL THEN 1 ELSE 0 END) "
                "FROM sessions WHERE started_at >= ?", (start,)).fetchone()
    except sqlite3.Error:
        return None, 0
    spend, unknown = float(row[0] or 0.0), int(row[1] or 0)
    _spend_cache[key] = (time.time(), spend, unknown)
    return spend, unknown


def controls(conn: sqlite3.Connection) -> dict[str, dict]:
    """Every row by profile: ``{paused, pause_reason, paused_at, monthly_budget_usd}``."""
    rows = conn.execute(
        "SELECT profile, paused, pause_reason, paused_at, monthly_budget_usd FROM agent_controls")
    return {row["profile"]: {"paused": bool(row["paused"]), "pause_reason": row["pause_reason"],
                             "paused_at": row["paused_at"], "monthly_budget_usd": row["monthly_budget_usd"]}
            for row in rows}


def set_paused(conn: sqlite3.Connection, profile: str, paused: bool, *, reason: str = "manual") -> None:
    with _kb.write_txn(conn):
        conn.execute(
            "INSERT INTO agent_controls (profile, paused, pause_reason, paused_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(profile) DO UPDATE SET paused = excluded.paused, "
            "pause_reason = excluded.pause_reason, paused_at = excluded.paused_at",
            (profile, int(paused), reason if paused else None, int(time.time()) if paused else None))


def set_budget(conn: sqlite3.Connection, profile: str, usd: Optional[float]) -> None:
    """Set (or, with ``None``, clear) the monthly limit; raising it above this month's
    spend lifts a budget pause."""
    with _kb.write_txn(conn):
        conn.execute(
            "INSERT INTO agent_controls (profile, monthly_budget_usd) VALUES (?, ?) "
            "ON CONFLICT(profile) DO UPDATE SET monthly_budget_usd = excluded.monthly_budget_usd",
            (profile, usd))
        conn.execute(
            "UPDATE agent_controls SET paused = 0, pause_reason = NULL, paused_at = NULL "
            "WHERE profile = ? AND pause_reason = 'budget'", (profile,))


def claim_block_reason(conn: sqlite3.Connection, profile: str) -> Optional[str]:
    """Why ``profile`` may not pick up a card now: ``paused_all``, ``paused``, ``budget``
    (pausing it, so the owner sees it), or ``None`` when it may. A budget pause lifts
    itself once spend is back under the limit (a new month, a raised limit)."""
    rows = controls(conn)
    if rows.get(ALL, {}).get("paused"):
        return "paused_all"
    row = rows.get(profile)
    if row is None:
        return None
    if row["paused"] and row["pause_reason"] != "budget":
        return "paused"
    budget = row["monthly_budget_usd"]
    spend = month_spend(profile)[0] if budget is not None else None
    over = spend is not None and budget is not None and spend >= budget
    if over and not row["paused"]:
        set_paused(conn, profile, True, reason="budget")
    elif row["paused"] and not over:
        set_paused(conn, profile, False)  # a budget pause belongs to its month, or to a lower limit
    return "budget" if over else None


def overview(conn: sqlite3.Connection, profiles: list[str]) -> dict:
    """The controls panel: each agent's pause state, budget and this month's spend."""
    rows = controls(conn)
    agents = []
    for name in sorted(set(profiles) | (set(rows) - {ALL})):
        row = rows.get(name, {})
        spend, unknown = month_spend(name)
        agents.append({"profile": name, "paused": bool(row.get("paused")), "pause_reason": row.get("pause_reason"),
                       "paused_at": row.get("paused_at"), "monthly_budget_usd": row.get("monthly_budget_usd"),
                       "month_spend_usd": spend, "unpriced_sessions": unknown})
    everyone = rows.get(ALL, {})
    return {"all_paused": bool(everyone.get("paused")), "all_paused_at": everyone.get("paused_at"),
            "month_start": month_start(), "agents": agents}


def dispatch_profile_allowlist(normalize_profile_name) -> Optional[frozenset]:
    """Per-home claim allowlist ``kanban.dispatch_profiles`` (#110995).

    On a shared board (one ``kanban.db`` mounted across several Hermes homes),
    every home's ``profile_exists`` returns True for ``default`` — the root
    profile every home has — so a card assigned to ``default`` is claimable by
    every home's dispatcher. A home opts out of foreign claims by declaring
    which assignees it may claim::

        kanban:
          dispatch_profiles: ["sage", "researcher"]   # or "sage,researcher"

    Returns ``None`` only when the key is absent from the user config (upstream
    behavior: any existing profile is claimable). A present value is
    fail-closed: an empty list, ``null`` or a bare ``dispatch_profiles:`` claims
    nothing. The user layer is read without the ``DEFAULT_CONFIG`` merge (whose
    ``None`` placeholder would make the key look present in every home), and a
    config read that raises also claims nothing — a corrupt config on a shared
    board must never widen this home's claim scope silently (#113620).
    """
    try:
        from hermes_cli.config_effective import load_user_config_effective
        kanban = (load_user_config_effective(fail_closed=True) or {}).get("kanban", {})
    except Exception as exc:
        _kb._log.warning(
            "kanban: could not read kanban.dispatch_profiles (%s: %s) — "
            "this home claims no cards until the config is readable",
            type(exc).__name__, exc,
        )
        return frozenset()
    if not isinstance(kanban, Mapping) or "dispatch_profiles" not in kanban:
        return None
    raw = kanban["dispatch_profiles"]
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        _kb._log.warning(
            "kanban: kanban.dispatch_profiles is present but empty — this home "
            "claims no cards; omit the key to allow any existing profile"
        )
        return frozenset()
    names = [str(n) for n in raw] if isinstance(raw, (list, tuple)) else str(raw).split(",")
    allowed = set()
    for n in names:
        try:
            allowed.add(normalize_profile_name(n))
        except ValueError:
            continue
    return frozenset(allowed)


def dispatch_profile_allowlist_summary() -> str:
    """Human-readable resolution of ``kanban.dispatch_profiles`` for this home.

    Surfaced by ``hermes kanban diagnostics`` so an operator on a shared board
    can see what a home believes it may claim (#113620): ``any`` (key absent),
    the sorted allowed names, or ``none (fail-closed: ...)``.
    """
    try:
        from hermes_cli.profiles import normalize_profile_name
    except Exception as exc:
        return f"none (fail-closed: profiles unavailable: {exc})"
    allowlist = dispatch_profile_allowlist(normalize_profile_name)
    if allowlist is None:
        return "any"
    if allowlist:
        return ", ".join(sorted(allowlist))
    return ("none (fail-closed: kanban.dispatch_profiles is present but names no valid "
            "profile, or the config could not be read — omit the key to allow any)")
