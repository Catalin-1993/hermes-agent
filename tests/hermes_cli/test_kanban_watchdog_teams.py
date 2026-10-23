"""The watchdog names work that looks stuck, and a ready-made team installs whole — agents,
titles, reporting line, instructions, board rules and budgets — without touching what already
exists. Real profiles, kanban DB and plugin router against the test's own HERMES_HOME."""

from __future__ import annotations

import contextlib
import time
from pathlib import Path

import pytest

from hermes_cli import kanban_db as kb
from hermes_cli import kanban_db_connect as kbc
from hermes_cli import kanban_db_controls as kbctl
from hermes_cli import kanban_db_rules as kbrules
from hermes_cli import kanban_db_watchdog as kbwatch
from hermes_cli import kanban_team_templates as ktt
from hermes_cli import profiles as profiles_mod
from hermes_cli import profiles_org


@pytest.fixture
def home(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    kbctl._spend_cache.clear()
    kb.init_db()
    return home


def _client():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from tests.plugins.test_kanban_dashboard_plugin import _load_plugin_router

    app = FastAPI()
    app.include_router(_load_plugin_router(), prefix="/api/plugins/kanban")
    return TestClient(app)


def _age(conn, task_id: str, seconds: int) -> None:
    """Make everything that happened to the card ``seconds`` older."""
    conn.execute("UPDATE task_events SET created_at = created_at - ? WHERE task_id = ?", (seconds, task_id))
    conn.execute("UPDATE tasks SET created_at = created_at - ? WHERE id = ?", (seconds, task_id))
    conn.commit()


def test_the_watchdog_names_stuck_work_and_leaves_healthy_work_alone(home):
    now = int(time.time())
    with contextlib.closing(kbc.connect()) as conn:
        stalled = kb.create_task(conn, title="Analiză BTC", assignee="analist")
        kb.claim_task(conn, stalled)
        conn.execute("UPDATE tasks SET last_heartbeat_at = ? WHERE id = ?", (now - 20 * 60, stalled))
        healthy = kb.create_task(conn, title="Analiză ETH", assignee="cercetare")
        kb.claim_task(conn, healthy)
        conn.execute("UPDATE tasks SET last_heartbeat_at = ? WHERE id = ?", (now, healthy))
        waiting = kb.create_task(conn, title="Buget Q4", assignee="manager")
        kb.block_task(conn, waiting, reason="Ce sumă aloc?")
        _age(conn, waiting, 2 * 86_400)
        unclaimed = kb.create_task(conn, title="Rezumat", assignee="risc")
        _age(conn, unclaimed, 3 * 3600)
        failing = kb.create_task(conn, title="Backtest DOT", assignee="analist")
        conn.execute("UPDATE tasks SET consecutive_failures = 3 WHERE id = ?", (failing,))
        conn.commit()
        controls = {"month_start": now - 10 * 86_400, "agents": [
            {"profile": "analist", "paused": False, "monthly_budget_usd": 10, "month_spend_usd": 6},
            {"profile": "risc", "paused": False, "monthly_budget_usd": 10, "month_spend_usd": 1}]}

        found = {(f["kind"], f["task_id"] or f["profile"]) for f in kbwatch.findings(conn, controls, now=now)}

    assert found == {("stalled", stalled), ("waiting", waiting), ("unclaimed", unclaimed),
                     ("failing", failing), ("budget_pace", "analist")}
    assert all(healthy not in key for key in found)


def test_a_ready_made_team_installs_whole_and_keeps_what_exists(home):
    profiles_mod.create_profile("researcher", no_alias=True, no_skills=True)
    profiles_mod.write_profile_meta(profiles_mod.get_profile_dir("researcher"), description="Al meu")

    with contextlib.closing(kbc.connect()) as conn:
        done = ktt.install(conn, "investing")
        again = ktt.install(conn, "investing")
        rules = {rule["name"]: rule for rule in kbrules.list_rules(conn)}
        budgets = {name: row["monthly_budget_usd"] for name, row in kbctl.controls(conn).items()}

    assert sorted(done["created"]) == ["invest-lead", "market-analyst", "risk-officer"]
    assert done["kept"] == ["researcher"]
    assert (again["created"], again["rules"], again["budgets"]) == ([], [], {})
    chart = profiles_org.chart()
    assert chart["market-analyst"] == {"title": "Market analyst", "reports_to": "invest-lead", "reports": ["researcher"]}
    assert chart["researcher"]["title"] == ""  # an existing profile only joins the reporting line
    assert profiles_mod.read_profile_meta(profiles_mod.get_profile_dir("researcher"))["description"] == "Al meu"
    soul = (profiles_mod.get_profile_dir("risk-officer") / "SOUL.md").read_text()
    assert soul.startswith("# Risk officer") and "simulated portfolio" in soul
    assert rules["Risk officer checks the analyst's reports"]["verifier"] == "risk-officer"
    assert "researcher" not in budgets and budgets["market-analyst"] == 15


def test_the_api_serves_rules_watchdog_and_teams(home):
    client = _client()
    rule = {"name": "Buy or sell needs me", "action": "owner", "keywords": ["buy"]}

    state = client.post("/api/plugins/kanban/rules", json=rule).json()
    assert [r["name"] for r in state["rules"]] == ["Buy or sell needs me"] and state["holds"] == {}
    assert client.post("/api/plugins/kanban/rules", json={**rule, "action": "maybe"}).status_code == 400
    rule_id = state["rules"][0]["id"]
    assert client.put(f"/api/plugins/kanban/rules/{rule_id}", json={**rule, "enabled": False}).json()["rules"][0]["enabled"] is False
    assert client.delete(f"/api/plugins/kanban/rules/{rule_id}").json()["rules"] == []
    assert client.delete(f"/api/plugins/kanban/rules/{rule_id}").status_code == 404

    assert client.get("/api/plugins/kanban/watchdog").json() == {"findings": []}
    templates = {t["id"]: t for t in client.get("/api/plugins/kanban/teams/templates").json()["templates"]}
    assert {"investing", "restaurant", "research", "personal"} <= set(templates)
    assert client.post("/api/plugins/kanban/teams/install", json={"template": "nope"}).status_code == 404
