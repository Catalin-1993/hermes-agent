"""The owner's controls: a paused agent (or a paused board) picks up nothing, an agent over
its monthly budget is paused until the limit allows it again, and "stop" sends running work
back to Ready. Real kanban DB and dispatcher against the test's own HERMES_HOME."""

from __future__ import annotations

import contextlib
import datetime as dt
import sqlite3
import time
from pathlib import Path

import pytest

from hermes_cli import kanban_db as kb
from hermes_cli import kanban_db_connect as kbc
from hermes_cli import kanban_db_controls as kbctl
from hermes_cli import kanban_db_dispatch as kbd


@pytest.fixture
def kanban_home(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    kbctl._spend_cache.clear()
    kb.init_db()
    return home


@pytest.fixture
def spend(tmp_path, monkeypatch):
    """Give the agent ``analist`` a conversation store and let the test write its costs."""
    path = tmp_path / "analist-state.db"
    with contextlib.closing(sqlite3.connect(path)) as conn:
        conn.execute("CREATE TABLE sessions (id TEXT, started_at REAL, estimated_cost_usd REAL, actual_cost_usd REAL)")
        conn.commit()
    monkeypatch.setattr(kbctl, "_state_db", lambda profile: path if profile == "analist" else None)

    def add(usd: float, *, started_at: float | None = None, actual: bool = False) -> None:
        with contextlib.closing(sqlite3.connect(path)) as conn:
            conn.execute("INSERT INTO sessions VALUES (?, ?, ?, ?)",
                         ("s", started_at or time.time(), None if actual else usd, usd if actual else None))
            conn.commit()
        kbctl._spend_cache.clear()

    return add


def _spawned(res) -> list[str]:
    return [task_id for task_id, _who, _ws in res.spawned]


def test_a_paused_agent_picks_up_nothing_while_the_others_work(kanban_home, all_assignees_spawnable):
    with contextlib.closing(kbc.connect()) as conn:
        held = kb.create_task(conn, title="Analiză BTC", assignee="analist")
        free = kb.create_task(conn, title="Risc ETH", assignee="risc")
        kbctl.set_paused(conn, "analist", True)

        res = kbd.dispatch_once(conn, dry_run=True)

        assert _spawned(res) == [free]
        assert res.skipped_paused == [(held, "analist", "paused")]
        kbctl.set_paused(conn, "analist", False)
        assert held in _spawned(kbd.dispatch_once(conn, dry_run=True))


def test_pausing_everyone_holds_every_card(kanban_home, all_assignees_spawnable):
    with contextlib.closing(kbc.connect()) as conn:
        cards = {kb.create_task(conn, title=f"t{i}", assignee=who) for i, who in enumerate(("analist", "risc"))}
        kbctl.set_paused(conn, kbctl.ALL, True)

        res = kbd.dispatch_once(conn, dry_run=True)

        assert res.spawned == []
        assert {(task, why) for task, _who, why in res.skipped_paused} == {(card, "paused_all") for card in cards}
        assert kbctl.overview(conn, ["analist", "risc"])["all_paused"] is True


def test_an_agent_over_its_monthly_budget_is_paused_until_the_limit_allows(kanban_home, all_assignees_spawnable, spend):
    last_month = (dt.datetime.now().replace(day=1) - dt.timedelta(days=2)).timestamp()
    spend(50.0, started_at=last_month)  # last month does not count
    spend(4.0)
    spend(2.5, actual=True)
    with contextlib.closing(kbc.connect()) as conn:
        card = kb.create_task(conn, title="Analiză BTC", assignee="analist")
        kbctl.set_budget(conn, "analist", 6.0)

        assert kbd.dispatch_once(conn, dry_run=True).skipped_paused == [(card, "analist", "budget")]
        agent, = kbctl.overview(conn, ["analist"])["agents"]
        assert (agent["paused"], agent["pause_reason"], agent["month_spend_usd"]) == (True, "budget", 6.5)

        kbctl.set_budget(conn, "analist", 10.0)

        assert _spawned(kbd.dispatch_once(conn, dry_run=True)) == [card]
        assert kbctl.controls(conn)["analist"]["paused"] is False


def test_a_manual_pause_survives_a_budget_change(kanban_home, all_assignees_spawnable, spend):
    with contextlib.closing(kbc.connect()) as conn:
        card = kb.create_task(conn, title="Analiză BTC", assignee="analist")
        kbctl.set_paused(conn, "analist", True)
        kbctl.set_budget(conn, "analist", 100.0)

        assert kbd.dispatch_once(conn, dry_run=True).skipped_paused == [(card, "analist", "paused")]


def test_the_api_pauses_budgets_and_stops_running_work(kanban_home, all_assignees_spawnable):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from tests.plugins.test_kanban_dashboard_plugin import _load_plugin_router

    app = FastAPI()
    app.include_router(_load_plugin_router(), prefix="/api/plugins/kanban")
    client = TestClient(app)
    with contextlib.closing(kbc.connect()) as conn:
        card = kb.create_task(conn, title="Analiză BTC", assignee="analist")
        assert kb.claim_task(conn, card) is not None

    state = client.post("/api/plugins/kanban/controls",
                        json={"profile": "analist", "paused": True, "monthly_budget_usd": 20}).json()
    agent = next(a for a in state["agents"] if a["profile"] == "analist")
    assert (agent["paused"], agent["monthly_budget_usd"]) == (True, 20)
    assert client.post("/api/plugins/kanban/controls", json={"profile": "analist", "monthly_budget_usd": -1}).status_code == 400

    assert client.post("/api/plugins/kanban/controls/stop", json={"profile": "analist"}).json() == {"stopped": [card]}
    with contextlib.closing(kbc.connect()) as conn:
        assert kb.get_task(conn, card).status == "ready"
