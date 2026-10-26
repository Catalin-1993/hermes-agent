"""Every worker is told how to word a summary that asks the owner for something (Ask / Why / If approved /
If declined / Report), so the Overview and Inbox can show a decision plainly. Real kanban DB against the
test's own HERMES_HOME."""

from __future__ import annotations

import contextlib
from pathlib import Path

import pytest

from hermes_cli import kanban_db as kb
from hermes_cli import kanban_db_connect as kbc
from hermes_cli import kanban_db_controls as kbctl


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


def test_a_worker_is_told_how_to_ask_for_a_decision(board):
    task = kb.create_task(board, title="Raport risc", assignee="risc")
    context = kb.build_worker_context(board, task)

    assert "## When you need the owner's decision" in context
    for label in ("Ask:", "Why:", "If approved:", "If declined:", "Report:"):
        assert label in context
    assert "kanban_attach" in context
