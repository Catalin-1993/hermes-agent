"""A project's journal: decisions with the owner's reason, finished cards as reports and a card's comments as
a conversation — plain files by year and month in the project's own folder, written again without duplicating,
with attachments copied in, and nothing readable from outside it. Real kanban DB against the test's HERMES_HOME."""

from __future__ import annotations

import contextlib
from pathlib import Path

import pytest

from hermes_cli import kanban_db as kb
from hermes_cli import kanban_db_connect as kbc
from hermes_cli import kanban_db_controls as kbctl
from hermes_cli import kanban_journal as journal


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


def _finished_card(conn, summary: str) -> str:
    task = kb.create_task(conn, title="Raport risc ETH", assignee="risc")
    kb.claim_task(conn, task)
    kb.complete_task(conn, task, summary=summary)
    return task


def test_a_decision_is_filed_by_month_with_the_reason_and_what_the_agent_said(board):
    task = _finished_card(board, "Ask: Cap ETH at 30%?\nWhy: it is 39%.\nIf approved: rebalance in 3 steps.\nReport: numbers inside.")

    path = journal.record_decision(board, None, task, "approved", "Matches my plan.")
    text = path.read_text(encoding="utf-8")

    assert path.parent.parent.parent == journal.journal_root(None)
    assert "— Decision —" in path.name and task in path.name
    assert "**Outcome:** Approved" in text
    assert "Cap ETH at 30%?" in text and "it is 39%." in text and "rebalance in 3 steps." in text
    assert "## Your reason\nMatches my plan." in text
    assert journal.list_entries(None)[0]["outcome"] == "approved"


def test_a_decision_needs_a_known_card_and_outcome(board):
    task = _finished_card(board, "done")

    with pytest.raises(ValueError):
        journal.record_decision(board, None, "nope", "approved")
    with pytest.raises(ValueError):
        journal.record_decision(board, None, task, "maybe")


def test_syncing_files_reports_and_conversations_once(board):
    task = _finished_card(board, "ETH is 39% of the portfolio.")
    kb.add_comment(board, task, author="risc", body="Please check the cap.")
    kb.add_comment(board, task, author="dashboard", body="Cap it at 30%.")

    journal.sync(board, None)
    first = sorted(p.name for p in journal.journal_root(None).rglob("*.md"))
    journal.sync(board, None)

    assert sorted(p.name for p in journal.journal_root(None).rglob("*.md")) == first
    kinds = {e["type"] for e in journal.list_entries(None)}
    assert {"report", "conversation"} <= kinds
    conversation = next(e for e in journal.list_entries(None) if e["type"] == "conversation")
    assert "Cap it at 30%." in journal.read_entry(None, conversation["path"])
    assert "Report: Raport risc ETH" in journal.read_entry(None, next(e for e in journal.list_entries(None) if e["type"] == "report")["path"])


def test_the_index_lists_everything_in_time_order(board):
    task = _finished_card(board, "x")
    journal.record_decision(board, None, task, "approved")

    index = (journal.journal_root(None) / "index.md").read_text(encoding="utf-8")

    assert "# Project journal" in index and "Raport risc ETH" in index and "Approved" in index


def test_attached_files_are_copied_into_the_journal(board, tmp_path):
    task = _finished_card(board, "see the PDF")
    source = tmp_path / "Raport.pdf"
    source.write_bytes(b"%PDF-1.4 test")
    kb.add_attachment(board, task, filename="Raport.pdf", stored_path=str(source), content_type="application/pdf", size=13, uploaded_by="risc")

    path = journal.record_decision(board, None, task, "approved")

    assert (journal.journal_root(None) / "attachments" / task / "Raport.pdf").read_bytes() == b"%PDF-1.4 test"
    assert "(../../attachments/" in path.read_text(encoding="utf-8")


def test_nothing_outside_the_journal_can_be_read(board):
    with pytest.raises(FileNotFoundError):
        journal.read_entry(None, "../../../kanban.db")
    with pytest.raises(FileNotFoundError):
        journal.read_entry(None, "missing.md")


def test_an_empty_board_creates_no_journal(board):
    assert journal.sync_if_due(board, None) is True
    assert not journal.journal_root(None).exists()
