"""A board's goals count the cards that serve them — linked ones and everything created from those —
and tell each worker which goal its card serves; an agent's rhythm puts a check-in card on the
board when it is due, within its hours, never twice at once and never while the agent may not
work. Real kanban DB, dispatcher and plugin router against the test's own HERMES_HOME."""

from __future__ import annotations

import contextlib
import datetime as dt
from pathlib import Path

import pytest

from hermes_cli import kanban_db as kb
from hermes_cli import kanban_db_connect as kbc
from hermes_cli import kanban_db_controls as kbctl
from hermes_cli import kanban_db_dispatch as kbd
from hermes_cli import kanban_db_objectives as kbobj
from hermes_cli import kanban_db_rhythm as kbr
from hermes_cli import kanban_db_rules as kbrules


@pytest.fixture
def board(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    kbctl._spend_cache.clear()
    kb.init_db()
    with contextlib.closing(kbc.connect()) as conn:
        yield conn


def _at(hour: int, day: dt.date = dt.date(2026, 10, 21)) -> float:  # a Wednesday
    return dt.datetime.combine(day, dt.time(hour, 5)).timestamp()


def test_a_goal_counts_the_cards_created_from_its_cards(board):
    goal = kbobj.save(board, {"title": "Portofoliu rebalansat", "why": "Riscul e prea concentrat", "owner": "sef"})
    plan = kb.create_task(board, title="Plan rebalansare", assignee="sef")
    step = kb.create_task(board, title="Vinde 10% ETH", assignee="analist", parents=[plan])
    other = kb.create_task(board, title="Rezumat zilnic", assignee="analist")
    kbobj.link(board, goal, [plan])
    kb.claim_task(board, plan)
    kb.complete_task(board, plan, summary="Plan în 3 pași")

    [found] = kbobj.list_objectives(board)

    assert (found["done"], found["total"], found["percent"]) == (1, 2, 50)
    assert {card["id"] for card in found["cards"]} == {plan, step}
    assert "## The goal this serves" in kb.build_worker_context(board, step)
    assert "Portofoliu rebalansat" in kb.build_worker_context(board, step)
    assert "## The goal this serves" not in kb.build_worker_context(board, other)
    kbobj.save(board, {"title": "Portofoliu rebalansat", "owner": "sef", "status": "dropped"}, goal)
    assert "## The goal this serves" not in kb.build_worker_context(board, step)


def test_planning_a_goal_hands_it_to_its_owner(board):
    owned = kbobj.save(board, {"title": "Cafenea deschisă", "owner": "venue-lead", "target_date": "2027-05-01"})
    nobody = kbobj.save(board, {"title": "Fără responsabil"})

    task_id = kbobj.plan(board, owned)

    card = kb.get_task(board, task_id)
    assert card.assignee == "venue-lead" and "parents" in card.body and "2027-05-01" in card.body
    assert kbobj.serving(board, task_id)["id"] == owned
    with pytest.raises(ValueError):
        kbobj.plan(board, nobody)
    with pytest.raises(ValueError):
        kbobj.save(board, {"title": "x", "target_date": "mâine"})


def test_a_rhythm_checks_in_when_due_and_never_twice_at_once(board):
    kbr.set_rhythm(board, "analist", {"enabled": True, "every_minutes": 60, "start_hour": 8, "end_hour": 20})

    first = kbr.fire_due(board, now=_at(9))
    assert len(first) == 1 and kb.get_task(board, first[0]).assignee == "analist"
    assert kbr.fire_due(board, now=_at(11)) == []  # the last check-in is still open
    kb.claim_task(board, first[0])
    kb.complete_task(board, first[0], summary="Nimic de făcut")
    assert kbr.fire_due(board, now=_at(9) + 30 * 60) == []  # an hour has not passed yet
    assert len(kbr.fire_due(board, now=_at(11))) == 1


def test_a_rhythm_keeps_to_its_hours_days_and_the_agents_pause(board):
    kbr.set_rhythm(board, "risc", {"enabled": True, "every_minutes": 60, "start_hour": 8, "end_hour": 9})
    assert kbr.fire_due(board, now=_at(12)) == []
    assert kbr.get(board, "risc", now=_at(12))["next_at"] == int(_at(8, dt.date(2026, 10, 22)) - 5 * 60)

    kbr.set_rhythm(board, "risc", {"start_hour": 0, "end_hour": 0, "weekdays_only": True})
    assert kbr.fire_due(board, now=_at(12, dt.date(2026, 10, 24))) == []  # a Saturday

    kbctl.set_paused(board, "risc", True)
    assert kbr.fire_due(board, now=_at(12)) == []
    kbctl.set_paused(board, "risc", False)
    assert len(kbr.fire_due(board, now=_at(12))) == 1
    with pytest.raises(ValueError):
        kbr.set_rhythm(board, "risc", {"every_minutes": 5})


def test_the_dispatcher_puts_due_check_ins_on_the_board_and_rules_never_hold_them(board, all_assignees_spawnable):
    kbr.set_rhythm(board, "analist", {"enabled": True, "every_minutes": 60, "start_hour": 0, "end_hour": 0})
    kbrules.save_rule(board, {"name": "Totul trece pe la mine", "action": "owner"})

    assert kbd.dispatch_once(board, dry_run=True).spawned == []  # a dry run fires nothing
    res = kbd.dispatch_once(board, spawn_fn=lambda *a, **k: 12345)

    [(task_id, who, _ws)] = res.spawned
    assert who == "analist" and kb.get_task(board, task_id).created_by == kbr.AUTHOR
    run_id = kb._current_run_id(board, task_id)
    assert kbrules.route_completion(board, task_id, summary="Am verificat", result=None, metadata=None,
                                    run_id=run_id) is None


def test_the_api_serves_goals_and_rhythms(board):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from tests.plugins.test_kanban_dashboard_plugin import _load_plugin_router

    app = FastAPI()
    app.include_router(_load_plugin_router(), prefix="/api/plugins/kanban")
    client = TestClient(app)
    card = kb.create_task(board, title="Analiză BTC", assignee="analist")

    goals = client.post("/api/plugins/kanban/goals", json={"title": "Randament 8%", "owner": "analist"}).json()["goals"]
    goal_id = goals[0]["id"]
    assert client.post("/api/plugins/kanban/goals", json={"title": ""}).status_code == 400
    linked = client.post("/api/plugins/kanban/goals/cards", json={"goal_id": goal_id, "task_ids": [card]}).json()
    assert linked["goals"][0]["total"] == 1
    planned = client.post(f"/api/plugins/kanban/goals/{goal_id}/plan").json()
    assert planned["goals"][0]["total"] == 2
    assert client.put(f"/api/plugins/kanban/goals/{goal_id}", json={"title": "Randament 9%"}).json()["goals"][0]["title"] == "Randament 9%"
    assert client.delete(f"/api/plugins/kanban/goals/{goal_id}").json() == {"goals": []}

    rhythm = client.put("/api/plugins/kanban/rhythm/analist", json={"enabled": True, "every_minutes": 240}).json()
    assert (rhythm["enabled"], rhythm["every_minutes"]) == (True, 240)
    assert client.put("/api/plugins/kanban/rhythm/analist", json={"every_minutes": 1}).status_code == 400
    assert client.post("/api/plugins/kanban/rhythm/analist/check-in").json()["last_task_id"]
    assert "analist" in client.get("/api/plugins/kanban/rhythm").json()["rhythms"]
