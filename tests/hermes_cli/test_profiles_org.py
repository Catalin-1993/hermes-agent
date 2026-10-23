"""The team's org chart and each agent's file: titles and managers stay a tree, workers and
the decomposer are told who leads whom, and the agent page reports what the agent did.
Real profiles, kanban DB and plugin router against the test's own HERMES_HOME."""

from __future__ import annotations

import contextlib
import json
from pathlib import Path

import pytest

from hermes_cli import kanban_db as kb
from hermes_cli import kanban_db_connect as kbc
from hermes_cli import profiles as profiles_mod
from hermes_cli import profiles_org


@pytest.fixture
def team(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    kb.init_db()
    for name in ("sef", "analist", "risc"):
        profiles_mod.create_profile(name, no_alias=True, no_skills=True)
    return home


def _client():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from tests.plugins.test_kanban_dashboard_plugin import _load_plugin_router

    app = FastAPI()
    app.include_router(_load_plugin_router(), prefix="/api/plugins/kanban")
    return TestClient(app)


def test_the_chart_is_a_tree_and_refuses_loops(team):
    profiles_org.set_org("analist", title="Analist", reports_to="sef")
    chart = profiles_org.set_org("risc", title="Risc", reports_to="analist")

    assert chart["sef"]["reports"] == ["analist"]
    assert chart["analist"] == {"title": "Analist", "reports_to": "sef", "reports": ["risc"]}
    for manager, problem in (("risc", "loop"), ("sef", "self"), ("nimeni", "unknown")):
        with pytest.raises(ValueError, match=problem):
            profiles_org.set_org("sef", reports_to=manager)

    assert profiles_org.set_org("risc", reports_to="")["risc"]["reports_to"] == ""
    assert profiles_org.chart()["risc"]["title"] == "Risc"  # clearing the manager keeps the title


def test_a_hand_edited_loop_is_cut_so_every_chain_has_a_top(team):
    for name, boss in (("analist", "risc"), ("risc", "analist")):
        (profiles_mod.get_profile_dir(name) / "profile.yaml").write_text(f"org:\n  reports_to: {boss}\n")

    chart = profiles_org.chart()

    tops = [n for n in ("analist", "risc") if not chart[n]["reports_to"]]
    assert len(tops) == 1 and chart[tops[0]]["reports"] == [{"analist": "risc", "risc": "analist"}[tops[0]]]


def test_org_edits_keep_the_profile_description(team):
    profiles_mod.write_profile_meta(profiles_mod.get_profile_dir("analist"), description="Analizează piața")
    profiles_org.set_org("analist", title="Analist", reports_to="sef")

    assert profiles_mod.read_profile_meta(profiles_mod.get_profile_dir("analist"))["description"] == "Analizează piața"


def test_workers_are_told_their_manager_and_reports(team):
    profiles_org.set_org("sef", title="Șef de echipă")
    profiles_org.set_org("analist", title="Analist", reports_to="sef")
    with contextlib.closing(kbc.connect()) as conn:
        lead = kb.create_task(conn, title="Plan săptămânal", assignee="sef")
        report = kb.create_task(conn, title="Analiză BTC", assignee="analist")
        loner = kb.create_task(conn, title="Verificare", assignee="risc")

        lead_ctx = kb.build_worker_context(conn, lead)
        report_ctx = kb.build_worker_context(conn, report)
        loner_ctx = kb.build_worker_context(conn, loner)

    assert "Your role: Șef de echipă" in lead_ctx and "Your direct reports: `analist` (Analist)" in lead_ctx
    assert "You report to `sef` (Șef de echipă)" in report_ctx
    assert "## Your team" not in loner_ctx


def test_the_decomposer_roster_shows_titles_and_managers(team):
    from hermes_cli import kanban_decompose

    profiles_org.set_org("analist", title="Analist", reports_to="sef")
    roster, _names = kanban_decompose._build_roster()

    assert "analist [Analist, reports to sef]" in kanban_decompose._format_roster(roster)


def test_the_api_edits_the_chart_and_serves_the_agent_file(team):
    client = _client()
    assert client.patch("/api/plugins/kanban/profiles/analist/org",
                        json={"title": "Analist", "reports_to": "sef"}).status_code == 200
    assert client.patch("/api/plugins/kanban/profiles/sef/org", json={"reports_to": "analist"}).status_code == 400
    assert client.patch("/api/plugins/kanban/profiles/nimeni/org", json={"title": "X"}).status_code == 404
    roster = {p["name"]: p for p in client.get("/api/plugins/kanban/profiles").json()["profiles"]}
    assert (roster["analist"]["title"], roster["analist"]["reports_to"]) == ("Analist", "sef")
    assert roster["sef"]["reports"] == ["analist"]

    with contextlib.closing(kbc.connect()) as conn:
        done = kb.create_task(conn, title="Analiză BTC", assignee="analist")
        kb.claim_task(conn, done)
        kb.complete_task(conn, done, summary="BTC peste media de 200 de zile")
        kb.create_task(conn, title="Analiză ETH", assignee="analist")
    jobs = {"jobs": [{"id": "j1", "name": "Raport zilnic", "schedule_display": "every day at 08:00", "enabled": True}]}
    cron = profiles_mod.get_profile_dir("analist") / "cron"
    cron.mkdir(exist_ok=True)
    (cron / "jobs.json").write_text(json.dumps(jobs))

    page = client.get("/api/plugins/kanban/agents/analist").json()

    assert (page["stats"]["completed"], page["stats"]["success_rate"]) == (1, 100.0)
    assert page["runs"][0]["task_title"] == "Analiză BTC" and page["runs"][0]["outcome"] == "completed"
    assert page["open_cards"] == {"ready": 1}
    assert page["schedule"][0]["name"] == "Raport zilnic" and page["schedule"][0]["schedule"] == "every day at 08:00"
    assert client.get("/api/plugins/kanban/agents/nimeni").status_code == 404

    assert client.put("/api/plugins/kanban/agents/analist/instructions", json={"content": "Fii prudent."}).status_code == 200
    assert (profiles_mod.get_profile_dir("analist") / "SOUL.md").read_text() == "Fii prudent."
    assert client.get("/api/plugins/kanban/agents/analist").json()["instructions"] == "Fii prudent."
