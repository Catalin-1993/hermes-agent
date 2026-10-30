"""The Kanban dashboard's journal routes, mounted into the plugin router at ``/api/plugins/kanban/``:
list a project's journal, read one entry, record a decision, and force a sync. Thin wrappers over
:mod:`hermes_cli.kanban_journal`; the plugin binds its board-connection helper with :func:`bind`."""

from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Callable, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from hermes_cli import kanban_journal as journal

router = APIRouter()
_board_conn: Optional[Callable[[Optional[str]], AbstractContextManager]] = None


def bind(board_conn: Callable[[Optional[str]], AbstractContextManager]) -> None:
    global _board_conn
    _board_conn = board_conn


def _conn(board: Optional[str]) -> AbstractContextManager:
    assert _board_conn is not None, "kanban_journal_routes.bind() was not called"
    return _board_conn(board)


@router.get("/journal")
def get_journal(board: Optional[str] = Query(None)):
    """Every entry (newest first) and the folder they live in."""
    with _conn(board) as (board, conn):
        journal.sync_if_due(conn, board)
        return {"entries": journal.list_entries(board), "root": str(journal.journal_root(board))}


@router.get("/journal/entry")
def get_journal_entry(path: str = Query(...), board: Optional[str] = Query(None)):
    with _conn(board) as (board, _):
        try:
            return {"path": path, "content": journal.read_entry(board, path)}
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="journal entry not found")


class DecisionBody(BaseModel):
    task_id: str
    outcome: str
    reason: str = ""


@router.post("/journal/decision")
def post_journal_decision(body: DecisionBody, board: Optional[str] = Query(None)):
    """Record what the owner just decided on a card, with his reason."""
    with _conn(board) as (board, conn):
        try:
            path = journal.record_decision(conn, board, body.task_id, body.outcome, body.reason)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        return {"ok": True, "path": path.relative_to(journal.journal_root(board)).as_posix()}


@router.post("/journal/sync")
def post_journal_sync(board: Optional[str] = Query(None)):
    with _conn(board) as (board, conn):
        return {"entries": journal.sync(conn, board)}
