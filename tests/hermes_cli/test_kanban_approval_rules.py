"""A board's approval rules: when a worker finishes a card a rule covers, the card goes to Review
instead of Done — held for the owner (no agent is dispatched to it) or handed to a verifier
agent, whose own verdict is final. Real worker tool, kanban DB and dispatcher against the
test's own HERMES_HOME."""

from __future__ import annotations

import contextlib
import json
from pathlib import Path

import pytest

from hermes_cli import kanban_db as kb
from hermes_cli import kanban_db_connect as kbc
from hermes_cli import kanban_db_dispatch as kbd
from hermes_cli import kanban_db_rules as kbrules


@pytest.fixture
def board(monkeypatch, tmp_path):
    home = tmp_path / ".hermes"
    home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.delenv("HERMES_SESSION_ID", raising=False)
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    kb._INITIALIZED_PATHS.clear()
    kb.init_db()
    return home


def _work(monkeypatch, title: str, assignee: str = "analist") -> str:
    """Create a card, claim it the way the dispatcher does, and become its worker."""
    with contextlib.closing(kbc.connect()) as conn:
        tid = kb.create_task(conn, title=title, assignee=assignee)
        kb.claim_task(conn, tid)
        run_id = kb._current_run_id(conn, tid)
    monkeypatch.setenv("HERMES_PROFILE", assignee)
    monkeypatch.setenv("HERMES_KANBAN_TASK", tid)
    monkeypatch.setenv("HERMES_KANBAN_RUN_ID", str(run_id))
    return tid


def _finish(summary: str) -> dict:
    from tools import kanban_tools as kt

    return json.loads(kt._handle_complete({"summary": summary}))


def _rule(**rule) -> None:
    with contextlib.closing(kbc.connect()) as conn:
        kbrules.save_rule(conn, rule)


def test_an_owner_rule_holds_the_card_for_the_owner(board, monkeypatch, all_assignees_spawnable):
    _rule(name="Buy or sell needs me", action="owner", keywords=["cumpăr"])
    tid = _work(monkeypatch, "Plan pentru ETH")

    out = _finish("Recomand să cumpăr 0,2 ETH la 2.900 $")

    assert (out["status"], out["checked_by"]) == ("review", "owner")
    with contextlib.closing(kbc.connect()) as conn:
        assert kb.get_task(conn, tid).status == "review"
        assert tid in kbrules.holds(conn)
        res = kbd.dispatch_once(conn, dry_run=True)
        assert (tid, "analist", "owner_approval") in res.skipped_paused  # no agent reviews it
        assert kb.complete_task(conn, tid, summary="Aprobat")  # the owner approves from the Inbox
        assert kb.get_task(conn, tid).status == "done" and kbrules.holds(conn) == {}


def test_a_verifier_rule_hands_the_card_to_the_verifier_whose_verdict_is_final(
        board, monkeypatch, all_assignees_spawnable):
    _rule(name="Risk checks the analyst", action="verifier", verifier="risc", agents=["analist"])
    tid = _work(monkeypatch, "Raport BTC")

    assert _finish("BTC peste media de 200 de zile")["checked_by"] == "risc"
    with contextlib.closing(kbc.connect()) as conn:
        assert kb.get_task(conn, tid).assignee == "risc" and kbrules.holds(conn) == {}
        assert kb.claim_review_task(conn, tid) is not None  # the review lane hands it to the verifier
        run_id = kb._current_run_id(conn, tid)
    monkeypatch.setenv("HERMES_PROFILE", "risc")
    monkeypatch.setenv("HERMES_KANBAN_RUN_ID", str(run_id))

    assert "approval_rule" not in _finish("Verificat: niveluri corecte")
    with contextlib.closing(kbc.connect()) as conn:
        assert kb.get_task(conn, tid).status == "done"


def test_a_verifier_never_checks_its_own_work(board, monkeypatch):
    _rule(name="Risk checks everyone", action="verifier", verifier="risc")
    tid = _work(monkeypatch, "Verificare alocare", assignee="risc")

    assert _finish("Alocarea e în plan")["checked_by"] == "owner"
    with contextlib.closing(kbc.connect()) as conn:
        assert tid in kbrules.holds(conn)


def test_work_no_rule_covers_goes_straight_to_done(board, monkeypatch):
    _rule(name="Buy or sell needs me", action="owner", keywords=["cumpăr"])
    _rule(name="Off", action="owner", enabled=False)
    tid = _work(monkeypatch, "Rezumat de piață")

    assert "approval_rule" not in _finish("Piața e calmă azi")
    with contextlib.closing(kbc.connect()) as conn:
        assert kb.get_task(conn, tid).status == "done"


def test_a_rule_that_cannot_work_is_refused(board):
    with contextlib.closing(kbc.connect()) as conn:
        for bad in ({"name": "", "action": "owner"}, {"name": "x", "action": "maybe"},
                    {"name": "x", "action": "verifier"}):
            with pytest.raises(ValueError):
                kbrules.save_rule(conn, bad)
