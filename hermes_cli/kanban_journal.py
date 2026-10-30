"""A project's journal: its decisions, reports and conversations as plain files in the project's own folder
(``<board dir>/journal/<year>/<MM-Month>/…``), so the owner can open them a year later without the app.

Decisions are written when the owner acts on a card (with the reason he gives); reports (finished cards) and
conversations (a card's comments) are written from the board's data, idempotently, so a re-run never
duplicates and the whole history is there from the first run. Files that a card attached are copied into
``journal/attachments/<task>/`` so the archive stands on its own. Everything stays on this machine."""

from __future__ import annotations

import datetime as dt
import re
import shutil
import sqlite3
import time
from pathlib import Path
from typing import Optional

from hermes_cli import kanban_db as kb

OUTCOMES = {
    "approved": "Approved",
    "changes_requested": "Changes requested",
    "answered": "Answered",
    "unblocked": "Unblocked",
}
_LABEL = re.compile(r"^\s*[*_#\s]*(ask|why|if approved|if declined|report)\s*[*_]*\s*[:—-]\s*[*_]*\s*(.*)$", re.IGNORECASE)
_SYNC_EVERY = 300  # seconds between automatic syncs


def journal_root(board: Optional[str] = None) -> Path:
    return kb.board_dir(board) / "journal"


def _stamp(epoch: Optional[int]) -> dt.datetime:
    return dt.datetime.fromtimestamp(epoch or time.time())


def _slug(text: str) -> str:
    cleaned = re.sub(r"[^\w\- ]+", "", text or "", flags=re.UNICODE).strip()
    return re.sub(r"\s+", " ", cleaned)[:60] or "untitled"


def _folder(root: Path, when: dt.datetime) -> Path:
    return root / f"{when:%Y}" / f"{when:%m}-{when:%B}"


def parse_labelled(text: Optional[str]) -> dict[str, str]:
    """The agent's Ask / Why / If approved / If declined / Report parts; unlabelled text is the report."""
    out = {"ask": "", "why": "", "if approved": "", "if declined": "", "report": ""}
    loose: list[str] = []
    current: Optional[str] = None
    for line in (text or "").split("\n"):
        match = _LABEL.match(line)
        if match:
            current = match.group(1).lower()
            out[current] = match.group(2).strip()
        elif current:
            out[current] = f"{out[current]}\n{line}".strip()
        else:
            loose.append(line)
    out["report"] = "\n\n".join(part for part in ("\n".join(loose).strip(), out["report"]) if part)
    return out


def _write(path: Path, content: str) -> bool:
    """Write only when the content changed (so a re-sync touches nothing); atomic."""
    if path.exists() and path.read_text(encoding="utf-8-sig") == content:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.replace(path)
    return True


def _front(**fields: object) -> str:
    return "---\n" + "".join(f"{key}: {str(value).replace(chr(10), ' ')}\n" for key, value in fields.items()) + "---\n\n"


def _copy_files(conn: sqlite3.Connection, root: Path, task_id: str) -> list[tuple[str, str]]:
    """The card's attachments, copied under the journal; (name, link relative to a month folder)."""
    files: list[tuple[str, str]] = []
    for att in kb.list_attachments(conn, task_id):
        source = Path(att.stored_path)
        if not source.is_file():
            continue
        dest = root / "attachments" / task_id / att.filename
        if not dest.exists() or dest.stat().st_size != source.stat().st_size:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)
        files.append((att.filename, f"../../attachments/{task_id}/{att.filename}"))
    return files


def _files_block(files: list[tuple[str, str]]) -> str:
    return "## Files\n" + "".join(f"- [{name}]({link.replace(' ', '%20')})\n" for name, link in files) + "\n" if files else ""


def _latest_report(conn: sqlite3.Connection, task: kb.Task) -> str:
    runs = [run for run in kb.list_runs(conn, task.id) if run.summary and run.outcome == "completed"]
    return (runs[-1].summary if runs else task.result) or ""


def record_decision(conn: sqlite3.Connection, board: Optional[str], task_id: str, outcome: str, reason: str = "") -> Path:
    """Write the decision the owner just took on a card, with his reason and what the agent had said."""
    task = kb.get_task(conn, task_id)
    if task is None:
        raise ValueError(f"unknown task {task_id}")
    if outcome not in OUTCOMES:
        raise ValueError(f"unknown outcome {outcome!r}")
    root = journal_root(board)
    when = _stamp(None)
    # The summary the agent left when it asked: the latest run's, else the card's own text.
    runs = [run for run in kb.list_runs(conn, task_id) if run.summary]
    said = parse_labelled((runs[-1].summary if runs else None) or task.result or task.body)
    files = _copy_files(conn, root, task_id)
    body = (
        _front(type="decision", title=task.title, date=when.isoformat(timespec="seconds"),
               agent=task.assignee or "", task=task_id, outcome=outcome)
        + f"# Decision: {task.title}\n\n**Outcome:** {OUTCOMES[outcome]}  \n**Date:** {when:%Y-%m-%d %H:%M}  \n"
        + f"**Agent:** {task.assignee or '—'}  \n**Card:** {task_id}\n\n"
        + (f"## What was asked\n{said['ask']}\n\n" if said["ask"] else "")
        + (f"## Why it needed you\n{said['why']}\n\n" if said["why"] else "")
        + (f"## The agent's report\n{said['report']}\n\n" if said["report"] else "")
        + (f"## If approved, the agent said\n{said['if approved']}\n\n" if said["if approved"] else "")
        + (f"## If declined, the agent said\n{said['if declined']}\n\n" if said["if declined"] else "")
        + f"## Your reason\n{reason.strip() or '(none written)'}\n\n"
        + _files_block(files)
    )
    path = _folder(root, when) / f"{when:%Y-%m-%d %H%M} — Decision — {_slug(task.title)} [{task_id}].md"
    _write(path, body)
    write_index(board)
    return path


def _sync_reports(conn: sqlite3.Connection, root: Path) -> None:
    for row in conn.execute("SELECT id FROM tasks WHERE status = 'done'").fetchall():
        task = kb.get_task(conn, row["id"])
        report = _latest_report(conn, task) if task else ""
        if not task or not report.strip():
            continue
        when = _stamp(task.completed_at or task.created_at)
        said = parse_labelled(report)
        files = _copy_files(conn, root, task.id)
        body = (
            _front(type="report", title=task.title, date=when.isoformat(timespec="seconds"),
                   agent=task.assignee or "", task=task.id)
            + f"# Report: {task.title}\n\n**Agent:** {task.assignee or '—'}  \n**Finished:** {when:%Y-%m-%d %H:%M}\n\n"
            + (f"## What was asked\n{said['ask']}\n\n" if said["ask"] else "")
            + f"## Report\n{said['report'] or report.strip()}\n\n"
            + _files_block(files)
        )
        _write(_folder(root, when) / f"{when:%Y-%m-%d} — Report — {_slug(task.title)} [{task.id}].md", body)


def _sync_conversations(conn: sqlite3.Connection, root: Path) -> None:
    for row in conn.execute("SELECT DISTINCT task_id FROM task_comments").fetchall():
        task = kb.get_task(conn, row["task_id"])
        comments = kb.list_comments(conn, row["task_id"]) if task else []
        if not task or not comments:
            continue
        when = _stamp(comments[0].created_at)
        lines = "".join(
            f"### {c.author} — {_stamp(c.created_at):%Y-%m-%d %H:%M}\n{c.body.strip()}\n\n" for c in comments)
        body = (
            _front(type="conversation", title=task.title, date=when.isoformat(timespec="seconds"),
                   agent=task.assignee or "", task=task.id)
            + f"# Conversation: {task.title}\n\n**Card:** {task.id} · {len(comments)} messages\n\n{lines}"
        )
        _write(_folder(root, when) / f"{when:%Y-%m-%d} — Conversation — {_slug(task.title)} [{task.id}].md", body)


def list_entries(board: Optional[str] = None) -> list[dict]:
    """Every journal file with what its header says, newest first."""
    root = journal_root(board)
    entries: list[dict] = []
    for path in root.glob("*/*/*.md") if root.is_dir() else []:
        head: dict[str, str] = {}
        lines = path.read_text(encoding="utf-8-sig").split("\n")
        if lines and lines[0] == "---":
            for line in lines[1:]:
                if line == "---":
                    break
                key, _, value = line.partition(": ")
                head[key] = value
        entries.append({
            "agent": head.get("agent", ""), "date": head.get("date", ""), "outcome": head.get("outcome", ""),
            "path": path.relative_to(root).as_posix(), "task": head.get("task", ""),
            "title": head.get("title", path.stem), "type": head.get("type", "note"),
        })
    return sorted(entries, key=lambda e: e["date"], reverse=True)


def write_index(board: Optional[str] = None) -> None:
    """``index.md``: every entry in time order, by month, each a link."""
    entries = list_entries(board)
    root = journal_root(board)
    lines = ["# Project journal\n\nDecisions, reports and conversations, newest first.\n"]
    month = ""
    for e in entries:
        stamp = e["date"][:7]
        if stamp != month:
            month = stamp
            lines.append(f"\n## {stamp}\n")
        link = e["path"].replace(" ", "%20")
        lines.append(f"- {e['date'][:10]} · {e['type']} · [{e['title']}]({link})"
                     + (f" — {OUTCOMES.get(e['outcome'], e['outcome'])}" if e["outcome"] else ""))
    _write(root / "index.md", "\n".join(lines) + "\n")


def read_entry(board: Optional[str], relative: str) -> str:
    """One entry's text; the path must stay inside the journal."""
    root = journal_root(board).resolve()
    path = (root / relative).resolve()
    if root not in path.parents or path.suffix != ".md" or not path.is_file():
        raise FileNotFoundError(relative)
    return path.read_text(encoding="utf-8-sig")


def sync(conn: sqlite3.Connection, board: Optional[str] = None) -> int:
    """Write reports and conversations from the board's data; returns how many entries exist."""
    root = journal_root(board)
    if not root.is_dir() and not conn.execute(
        "SELECT 1 FROM tasks WHERE status = 'done' UNION ALL SELECT 1 FROM task_comments LIMIT 1"
    ).fetchone():
        return 0  # nothing to write yet: do not create an empty journal
    _sync_reports(conn, root)
    _sync_conversations(conn, root)
    write_index(board)
    (root / ".synced").write_text(str(int(time.time())), encoding="utf-8")
    return len(list_entries(board))


def sync_if_due(conn: sqlite3.Connection, board: Optional[str] = None) -> bool:
    """The automatic sync: at most every few minutes, and never for a board with nothing to write."""
    marker = journal_root(board) / ".synced"
    if marker.exists() and time.time() - marker.stat().st_mtime < _SYNC_EVERY:
        return False
    sync(conn, board)
    return True
