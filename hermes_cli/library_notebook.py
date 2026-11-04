"""Brain's notebook — the second library, the one Brain writes itself.

The owner's Library asks before every change Brain makes. The notebook is the other half: items with
``space = 'agent'`` that Brain keeps up to date on its own (``library_notebook_scribe.py``) — one page per
project, per conversation and per topic, plus a mirror of what it remembers about the owner. The owner
reads it, corrects it and deletes from it; what the owner touched is never rewritten, and what the owner
deleted never comes back.

Pages are *keyed* (``project:<slug>``, ``conversation:<session id>``…): one key, one page, however many
times Brain returns to it. The key table lives beside the Library's own, in ``library.db``.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import sqlite3
import time
from typing import Any, Optional

from hermes_cli import library_db as ldb
from hermes_cli.library_notebook_text import DEFAULT_LANGUAGE, LABELS, RENDERERS, labels
from hermes_cli.sqlite_util import write_txn

logger = logging.getLogger(__name__)

_KEEP_CHANGES = 300
_FOOTER = "\n---\n"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS notebook_pages (
    key        TEXT PRIMARY KEY,
    item_id    TEXT NOT NULL,
    kind       TEXT NOT NULL,
    title      TEXT,
    state      TEXT,
    agent_hash TEXT,
    locked     INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notebook_sessions (
    session_id    TEXT PRIMARY KEY,
    msg_count     INTEGER NOT NULL,
    documented_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notebook_ignored (key TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS notebook_changes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    at         INTEGER NOT NULL,
    key        TEXT NOT NULL,
    item_id    TEXT NOT NULL,
    title      TEXT,
    action     TEXT NOT NULL,
    version_id TEXT,
    prev_state TEXT,
    prev_title TEXT,
    prev_locked INTEGER NOT NULL DEFAULT 0,
    undone     INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS notebook_meta (name TEXT PRIMARY KEY, value TEXT);
"""

# The fixed pages and folders, in the order they are made: (key, kind, label, icon, state kind).
SKELETON = (
    ("start", "page", "start", "🧭", "start"),
    ("about", "page", "about", "🙂", "about"),
    ("work", "page", "work", "⚙️", "work"),
    ("projects", "folder", "projects", "📁", None),
    ("conversations", "folder", "conversations", "💬", None),
    ("topics", "folder", "topics", "🧠", None),
    ("todo", "page", "todo", "✅", "todo"),
)


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(_SCHEMA)


def _meta(conn: sqlite3.Connection, name: str, default: Optional[str] = None) -> Optional[str]:
    row = conn.execute("SELECT value FROM notebook_meta WHERE name = ?", (name,)).fetchone()
    return row[0] if row else default


def set_meta(conn: sqlite3.Connection, name: str, value: Any) -> None:
    with write_txn(conn):
        conn.execute("INSERT INTO notebook_meta (name, value) VALUES (?, ?) "
                     "ON CONFLICT(name) DO UPDATE SET value = excluded.value", (name, str(value)))


def get_meta(conn: sqlite3.Connection, name: str, default: Optional[str] = None) -> Optional[str]:
    return _meta(conn, name, default)


def language(conn: sqlite3.Connection) -> str:
    return _meta(conn, "language", DEFAULT_LANGUAGE) or DEFAULT_LANGUAGE


def set_language(conn: sqlite3.Connection, code: Optional[str]) -> bool:
    """Remember the language the owner writes in; True when it changed (the fixed titles are then renamed)."""
    code = (code or "").strip().lower()[:2]
    if code not in LABELS or code == language(conn):
        return False
    set_meta(conn, "language", code)
    return True


def _norm_hash(markdown: str) -> str:
    return hashlib.sha1(re.sub(r"\s+", " ", markdown or "").strip().encode("utf-8")).hexdigest()


def _row(conn: sqlite3.Connection, key: str) -> Optional[sqlite3.Row]:
    return conn.execute("SELECT * FROM notebook_pages WHERE key = ?", (key,)).fetchone()


def row_for_item(conn: sqlite3.Connection, item_id: str) -> Optional[sqlite3.Row]:
    return conn.execute("SELECT * FROM notebook_pages WHERE item_id = ?", (item_id,)).fetchone()


def state_of(conn: sqlite3.Connection, key: str) -> dict:
    row = _row(conn, key)
    try:
        return json.loads(row["state"]) if row and row["state"] else {}
    except ValueError:
        return {}


def is_ignored(conn: sqlite3.Connection, key: str) -> bool:
    return conn.execute("SELECT 1 FROM notebook_ignored WHERE key = ?", (key,)).fetchone() is not None


def _save_row(conn: sqlite3.Connection, key: str, item_id: str, kind: str, title: str, state: dict,
              markdown: str, locked: bool) -> None:
    with write_txn(conn):
        conn.execute(
            "INSERT INTO notebook_pages (key, item_id, kind, title, state, agent_hash, locked, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET item_id = excluded.item_id, "
            "title = excluded.title, state = excluded.state, agent_hash = excluded.agent_hash, "
            "locked = excluded.locked, updated_at = excluded.updated_at",
            (key, item_id, kind, title, json.dumps(state, ensure_ascii=False), _norm_hash(markdown),
             1 if locked else 0, int(time.time())))


def _live_item(conn: sqlite3.Connection, row: Optional[sqlite3.Row]) -> Optional[ldb.LibraryItem]:
    item = ldb.get_item(conn, row["item_id"]) if row else None
    return item if item is not None and item.trashed_at is None else None


def _append_update(L: dict[str, str], markdown: str, note: str, stamp: str) -> str:
    """A page the owner has edited is never rewritten: new news goes in one dated line at its end."""
    line = f"- {stamp}: {note}"
    heading = f"## {L['brain_updates']}"
    if heading in markdown:
        return markdown.rstrip() + "\n" + line + "\n"
    return markdown.rstrip() + f"\n\n{heading}\n\n{line}\n"


def _make_folder(conn: sqlite3.Connection, key: str, title: str, icon: str, parent: Optional[str]) -> ldb.LibraryItem:
    folder = ldb.create_folder(conn, title=title, parent_id=parent, visibility="open", created_by="agent",
                               space="agent")
    if icon:
        ldb.update_item(conn, folder.id, icon=icon)
    _save_row(conn, key, folder.id, "folder", title, {}, "", False)
    return folder


def ensure_folder(conn: sqlite3.Connection, key: str, title: str, parent: Optional[str] = None,
                  icon: str = "") -> Optional[str]:
    """The id of the folder kept under ``key``, made when missing; None when the owner deleted it."""
    if is_ignored(conn, key):
        return None
    row = _row(conn, key)
    item = _live_item(conn, row)
    if item is None:
        return _make_folder(conn, key, title, icon, parent).id
    if row["title"] != title and item.title == row["title"]:
        ldb.update_item(conn, item.id, title=title)  # renamed with the language, unless the owner renamed it
        _save_row(conn, key, item.id, "folder", title, {}, "", False)
    return item.id


def _body(markdown: str) -> str:
    """A page without its "Updated" footer: what Brain would say, whatever the time."""
    return _norm_text(markdown.rsplit(_FOOTER, 1)[0])


def _norm_text(markdown: str) -> str:
    return re.sub(r"\s+", " ", markdown or "").strip()


def _record_change(conn: sqlite3.Connection, *, key: str, item: ldb.LibraryItem, action: str,
                   version_id: Optional[str], row: Optional[sqlite3.Row]) -> None:
    with write_txn(conn):
        conn.execute(
            "INSERT INTO notebook_changes (at, key, item_id, title, action, version_id, prev_state, prev_title, "
            "prev_locked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (int(time.time()), key, item.id, item.title, action, version_id, row["state"] if row else None,
             row["title"] if row else None, row["locked"] if row else 0))
        conn.execute("DELETE FROM notebook_changes WHERE id <= (SELECT MAX(id) FROM notebook_changes) - ?",
                     (_KEEP_CHANGES,))


def _newest_version(conn: sqlite3.Connection, item: ldb.LibraryItem) -> Optional[str]:
    """Keep the page as it is, then name that copy: what an Undo goes back to."""
    from hermes_cli import library_versions

    library_versions.snapshot_page(conn, item, force=True)
    found = conn.execute("SELECT id FROM library_versions WHERE item_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
                         (item.id,)).fetchone()
    return found[0] if found else None


def upsert_page(conn: sqlite3.Connection, *, key: str, kind: str, title: str, state: dict, parent: Optional[str],
                icon: str = "", note: str = "", session_id: Optional[str] = None) -> Optional[ldb.LibraryItem]:
    """Write the page kept under ``key`` from its ``state``. A page the owner has edited since Brain last
    wrote it is left as the owner has it, with ``note`` added as one dated line at its end. Every real
    change is logged with the copy it replaced, so the owner can undo it."""
    if is_ignored(conn, key):
        return None
    L = labels(language(conn))
    markdown = RENDERERS[kind](L, state, time.time())
    row = _row(conn, key)
    item = _live_item(conn, row)
    if row is not None and item is None and ldb.get_item(conn, row["item_id"]) is not None:
        return None  # in the Trash: the owner's call, not Brain's
    if item is None:
        item = ldb.create_page(conn, title=title, icon=icon or None, markdown=markdown, visibility="open",
                               parent_id=parent, created_by="agent", space="agent")
        _save_row(conn, key, item.id, kind, title, state, markdown, False)
        _record_change(conn, key=key, item=item, action="created", version_id=None, row=None)
    elif row["locked"] or _norm_hash(item.markdown) != row["agent_hash"]:
        merged = _append_update(L, item.markdown, note, time.strftime("%Y-%m-%d")) if note else item.markdown
        if merged != item.markdown:
            version = _newest_version(conn, item)
            item = ldb.update_item(conn, item.id, markdown=merged) or item
            _record_change(conn, key=key, item=item, action="updated", version_id=version, row=row)
        _save_row(conn, key, item.id, kind, row["title"] or title, state, item.markdown, True)
    elif _body(item.markdown) == _body(markdown) and item.title == title:
        _save_row(conn, key, item.id, kind, title, state, item.markdown, False)  # nothing new to say
    else:
        version = _newest_version(conn, item)
        item = ldb.update_item(conn, item.id, title=title, markdown=markdown) or item
        _save_row(conn, key, item.id, kind, title, state, markdown, False)
        _record_change(conn, key=key, item=item, action="updated", version_id=version, row=row)
    if session_id:
        ldb.mark_session(conn, item.id, session_id)
    return item


def recent_changes(conn: sqlite3.Connection, limit: int = 40) -> list[dict]:
    """What Brain wrote lately, newest first — each row says whether it can still be undone."""
    ensure_schema(conn)
    rows = conn.execute("SELECT * FROM notebook_changes ORDER BY id DESC LIMIT ?", (max(1, min(limit, 200)),)).fetchall()
    out = []
    for r in rows:
        item = ldb.get_item(conn, r["item_id"])
        out.append({"id": r["id"], "at": r["at"], "key": r["key"], "item_id": r["item_id"], "title": r["title"] or "",
                    "action": r["action"], "undone": bool(r["undone"]),
                    "can_undo": not r["undone"] and item is not None and item.trashed_at is None
                    and (r["action"] == "created" or bool(r["version_id"]))})
    return out


def undo_change(conn: sqlite3.Connection, change_id: int) -> bool:
    """Put a page back as it was before Brain's change (a page Brain made goes to the Trash and is not made again)."""
    from hermes_cli import library_versions

    ensure_schema(conn)
    change = conn.execute("SELECT * FROM notebook_changes WHERE id = ?", (change_id,)).fetchone()
    item = ldb.get_item(conn, change["item_id"]) if change else None
    if change is None or change["undone"] or item is None or item.trashed_at is not None:
        return False
    if change["action"] == "created":
        ldb.trash_item(conn, item.id)
        user_deleted(conn, item)
    elif change["version_id"]:
        restored = library_versions.restore(conn, item, change["version_id"])
        title = change["prev_title"] or restored.title
        if title and title != restored.title:
            restored = ldb.update_item(conn, restored.id, title=title) or restored
        prev = json.loads(change["prev_state"]) if change["prev_state"] else {}
        _save_row(conn, change["key"], restored.id, (_row(conn, change["key"]) or {"kind": "page"})["kind"],
                  title or "", prev, restored.markdown, bool(change["prev_locked"]))
    else:
        return False
    with write_txn(conn):
        conn.execute("UPDATE notebook_changes SET undone = 1 WHERE id = ?", (change_id,))
    return True


def _retitle(conn: sqlite3.Connection, row: sqlite3.Row, item: ldb.LibraryItem, title: str) -> None:
    """A fixed page follows the language, unless the owner gave it a name of their own."""
    if row["title"] != title and item.title == row["title"]:
        ldb.update_item(conn, item.id, title=title)
        with write_txn(conn):
            conn.execute("UPDATE notebook_pages SET title = ? WHERE key = ?", (title, row["key"]))


def ensure_skeleton(conn: sqlite3.Connection) -> dict[str, Optional[str]]:
    """The fixed shape of the notebook, made once and renamed when the language changes."""
    ensure_schema(conn)
    L = labels(language(conn))
    ids: dict[str, Optional[str]] = {}
    for key, kind, label, icon, state_kind in SKELETON:
        if kind == "folder":
            ids[key] = ensure_folder(conn, key, L[label], None, icon)
            continue
        row = _row(conn, key)
        item = _live_item(conn, row)
        if item is None:
            item = upsert_page(conn, key=key, kind=state_kind or key, title=L[label], state=state_of(conn, key),
                               parent=None, icon=icon)
        else:
            _retitle(conn, row, item, L[label])
        ids[key] = item.id if item is not None else None
    return ids


def user_deleted(conn: sqlite3.Connection, item: ldb.LibraryItem) -> None:
    """The owner moved a notebook item to the Trash: Brain stops recreating its page."""
    ensure_schema(conn)
    row = row_for_item(conn, item.id)
    if row is not None:
        with write_txn(conn):
            conn.execute("INSERT OR IGNORE INTO notebook_ignored (key) VALUES (?)", (row["key"],))


def user_restored(conn: sqlite3.Connection, item: ldb.LibraryItem) -> None:
    ensure_schema(conn)
    row = row_for_item(conn, item.id)
    if row is not None:
        with write_txn(conn):
            conn.execute("DELETE FROM notebook_ignored WHERE key = ?", (row["key"],))


def user_edited(conn: sqlite3.Connection, item: ldb.LibraryItem) -> None:
    """The owner saved a notebook page. Edits to "About you" go on into Brain's real memory."""
    ensure_schema(conn)
    row = row_for_item(conn, item.id)
    if row is not None and row["key"] == "about":
        from hermes_cli.library_notebook_about import push_page_to_memory

        push_page_to_memory(conn, item)


def counts(conn: sqlite3.Connection) -> dict[str, int]:
    ensure_schema(conn)
    rows = conn.execute("SELECT kind, COUNT(*) FROM notebook_pages WHERE kind != 'folder' GROUP BY kind").fetchall()
    return {kind: n for kind, n in rows}
