"""The Kanban dashboard's Team-mode routes, mounted into the plugin router
(``plugins/kanban/dashboard/plugin_api.py``) at ``/api/plugins/kanban/``.

The owner's controls (pause, monthly budget, stop), the org chart, each agent's file, the
board's approval rules, the watchdog and the ready-made teams. Each handler is a thin wrapper
over its ``hermes_cli`` module; the plugin binds its board-connection helper (``?board=``
resolution, 400/404 on a bad slug) with :func:`bind` before including :data:`router`.
"""

from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Any, Callable, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from hermes_cli import kanban_db
from hermes_cli import kanban_db_controls as kbctl
from hermes_cli import kanban_db_rules as kbrules
from hermes_cli import kanban_db_watchdog as kbwatch

router = APIRouter()
_board_conn: Optional[Callable[[Optional[str]], AbstractContextManager]] = None


def bind(board_conn: Callable[[Optional[str]], AbstractContextManager]) -> None:
    global _board_conn
    _board_conn = board_conn


def _conn(board: Optional[str]) -> AbstractContextManager:
    assert _board_conn is not None, "kanban_team_routes.bind() was not called"
    return _board_conn(board)


def _not_found(what: Any) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{what} not found")


# --- Owner controls: pause and monthly budget per agent ---------------------

class ControlBody(BaseModel):
    profile: str  # an agent's profile name, or "*" for everyone on the board
    paused: Optional[bool] = None
    monthly_budget_usd: Optional[float] = None
    clear_budget: bool = False


def _control_profiles(conn) -> list[str]:
    from hermes_cli import profiles as profiles_mod

    names = {row["assignee"] for row in conn.execute("SELECT DISTINCT assignee FROM tasks WHERE assignee IS NOT NULL")}
    return sorted(names | {p.name for p in profiles_mod.list_profiles()})


@router.get("/controls")
def get_controls(board: Optional[str] = Query(None)):
    """Each agent's pause state, monthly budget and this month's spend, and the board-wide pause."""
    with _conn(board) as (board, conn):
        return kbctl.overview(conn, _control_profiles(conn))


@router.post("/controls")
def set_controls(payload: ControlBody, board: Optional[str] = Query(None)):
    if not payload.profile.strip():
        raise HTTPException(status_code=400, detail="profile is required")
    if payload.monthly_budget_usd is not None and not 0 < payload.monthly_budget_usd < 1_000_000:
        raise HTTPException(status_code=400, detail="monthly_budget_usd must be a positive amount")
    with _conn(board) as (board, conn):
        if payload.clear_budget or payload.monthly_budget_usd is not None:
            kbctl.set_budget(conn, payload.profile, None if payload.clear_budget else payload.monthly_budget_usd)
        if payload.paused is not None:
            kbctl.set_paused(conn, payload.profile, payload.paused)
        return kbctl.overview(conn, _control_profiles(conn))


@router.post("/controls/stop")
def stop_agent_work(payload: ControlBody, board: Optional[str] = Query(None)):
    """Stop what an agent (or, with "*", everyone) is running now: each live run is reclaimed
    the way the Terminate button does it, and the card goes back to Ready."""
    with _conn(board) as (board, conn):
        rows = conn.execute(
            "SELECT DISTINCT r.task_id FROM task_runs r JOIN tasks t ON t.id = r.task_id "
            "WHERE r.ended_at IS NULL AND t.status = 'running' AND (? = '*' OR r.profile = ? OR t.assignee = ?)",
            (payload.profile, payload.profile, payload.profile)).fetchall()
        stopped = [row["task_id"] for row in rows
                   if kanban_db.reclaim_task(conn, row["task_id"], reason="stopped by the owner")]
        return {"stopped": stopped}


# --- Org chart and agent files ----------------------------------------------

class OrgBody(BaseModel):
    title: Optional[str] = None
    reports_to: Optional[str] = None  # a profile name; "" = reports to nobody (top of the chart)


@router.patch("/profiles/{profile_name}/org")
def update_profile_org(profile_name: str, payload: OrgBody):
    """Set an agent's title and manager; refuses a manager that is itself, unknown, or
    already reports to it (the chart stays a tree)."""
    from hermes_cli import profiles_org
    try:
        org = profiles_org.set_org(profile_name, title=payload.title, reports_to=payload.reports_to)
    except LookupError:
        raise _not_found(f"profile '{profile_name}'")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"cannot report to that profile: {exc}")
    return {"ok": True, "org": org}


class InstructionsBody(BaseModel):
    content: str


@router.get("/agents/{profile_name}")
def get_agent_file(profile_name: str, board: Optional[str] = Query(None)):
    """One agent's page: runs on this board, success rate, open cards, schedule, tools, instructions."""
    from hermes_cli import kanban_agent_file as kaf
    with _conn(board) as (board, conn):
        try:
            return kaf.agent_file(conn, profile_name)
        except LookupError:
            raise _not_found(f"profile '{profile_name}'")


@router.put("/agents/{profile_name}/instructions")
def put_agent_instructions(profile_name: str, payload: InstructionsBody):
    """Rewrite the agent's ``SOUL.md``; used from its next conversation on."""
    from hermes_cli import kanban_agent_file as kaf
    try:
        home = kaf.profile_dir(profile_name)
        kaf.write_instructions(home, payload.content)
    except LookupError:
        raise _not_found(f"profile '{profile_name}'")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True}


# --- Approval rules ---------------------------------------------------------

class RuleBody(BaseModel):
    name: str
    enabled: bool = True
    agents: list[str] = []
    keywords: list[str] = []
    min_priority: Optional[int] = None
    action: str
    verifier: Optional[str] = None


def _rules_state(conn) -> dict:
    return {"rules": kbrules.list_rules(conn), "holds": kbrules.holds(conn)}


@router.get("/rules")
def get_rules(board: Optional[str] = Query(None)):
    """The board's approval rules and the cards they hold for the owner now."""
    with _conn(board) as (board, conn):
        return _rules_state(conn)


@router.post("/rules")
def add_rule(payload: RuleBody, board: Optional[str] = Query(None)):
    with _conn(board) as (board, conn):
        try:
            kbrules.save_rule(conn, payload.model_dump())
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        return _rules_state(conn)


@router.put("/rules/{rule_id}")
def replace_rule(rule_id: int, payload: RuleBody, board: Optional[str] = Query(None)):
    with _conn(board) as (board, conn):
        try:
            kbrules.save_rule(conn, payload.model_dump(), rule_id)
        except LookupError:
            raise _not_found(f"rule {rule_id}")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        return _rules_state(conn)


@router.delete("/rules/{rule_id}")
def remove_rule(rule_id: int, board: Optional[str] = Query(None)):
    with _conn(board) as (board, conn):
        if not kbrules.delete_rule(conn, rule_id):
            raise _not_found(f"rule {rule_id}")
        return _rules_state(conn)


# --- Watchdog ---------------------------------------------------------------

@router.get("/watchdog")
def get_watchdog(board: Optional[str] = Query(None)):
    """What looks stuck on this board now (read-only)."""
    with _conn(board) as (board, conn):
        controls = kbctl.overview(conn, _control_profiles(conn))
        return {"findings": kbwatch.findings(conn, controls)}


# --- Ready-made teams -------------------------------------------------------

class TeamBody(BaseModel):
    template: str


@router.get("/teams/templates")
def get_team_templates():
    from hermes_cli import kanban_team_templates as ktt, profiles as profiles_mod

    existing = {p.name for p in profiles_mod.list_profiles(lazy_skill_count=True)}
    return {"templates": ktt.catalog(existing)}


@router.post("/teams/install")
def install_team(payload: TeamBody, board: Optional[str] = Query(None)):
    """Create the template's missing agents, then add its rules and budgets to this board."""
    from hermes_cli import kanban_team_templates as ktt
    with _conn(board) as (board, conn):
        try:
            return ktt.install(conn, payload.template)
        except LookupError:
            raise _not_found(f"team template '{payload.template}'")
