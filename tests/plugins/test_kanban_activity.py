"""The Kanban overview's activity: finished runs per day by outcome, the success rate, and a
feed of the moments a person follows — through the real dashboard router and kanban DB."""

from __future__ import annotations

import contextlib
import datetime as dt
import time
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from hermes_cli import kanban_db as kb
from hermes_cli import kanban_db_connect as kbc
from hermes_cli import kanban_db_activity as kba
import pytest

from tests.plugins.test_kanban_dashboard_plugin import _load_plugin_router


@pytest.fixture
def kanban_home(tmp_path, monkeypatch):
    """Isolated HERMES_HOME with an empty kanban DB."""
    home = tmp_path / ".hermes"
    home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    kb.init_db()
    return home


def _finish(conn, task_id: str, outcome: str, ended_at: int) -> None:
    conn.execute(
        "INSERT INTO task_runs (task_id, profile, status, started_at, ended_at, outcome) VALUES (?, ?, ?, ?, ?, ?)",
        (task_id, "analist", outcome, ended_at - 60, ended_at, outcome))


def test_runs_are_counted_per_day_by_how_they_ended(kanban_home):
    now = int(time.time())
    yesterday = now - 86_400
    with contextlib.closing(kbc.connect()) as conn:
        task = kb.create_task(conn, title="Analizează BTC", assignee="analist")
        for outcome, when in (("completed", now), ("completed", now), ("crashed", now), ("blocked", yesterday),
                              ("completed", now - 30 * 86_400)):
            _finish(conn, task, outcome, when)
        conn.commit()

        activity = kba.board_activity(conn, days=14, now=now)

    days = activity["days"]
    assert len(days) == 14 and days[-1]["date"] == dt.datetime.fromtimestamp(now).date().isoformat()
    assert (days[-1]["completed"], days[-1]["failed"]) == (2, 1)
    assert days[-2]["blocked"] == 1
    assert activity["totals"] == {"completed": 2, "failed": 1, "blocked": 1, "other": 0}  # 30 days ago is outside
    assert activity["success_rate"] == 50.0


def test_the_feed_names_who_did_what_on_which_task_newest_first(kanban_home):
    with contextlib.closing(kbc.connect()) as conn:
        task = kb.create_task(conn, title="Raport ETH", assignee="analist")
        kb.add_comment(conn, task, "manager", "Adaugă și riscurile.")
        kb.block_task(conn, task, reason="am nevoie de date", kind="needs_input")

        feed = kba.board_activity(conn, now=int(time.time()))["events"]

    assert [event["kind"] for event in feed][:2] == ["blocked", "commented"]
    commented = next(event for event in feed if event["kind"] == "commented")
    assert (commented["actor"], commented["task_title"]) == ("manager", "Raport ETH")
    assert {event["kind"] for event in feed} <= set(kba.FEED_KINDS)


def test_an_empty_board_has_no_rate_rather_than_zero(kanban_home):
    app = FastAPI()
    app.include_router(_load_plugin_router(), prefix="/api/plugins/kanban")

    data = TestClient(app).get("/api/plugins/kanban/activity?days=7").json()

    assert len(data["days"]) == 7
    assert data["success_rate"] is None and data["events"] == []
