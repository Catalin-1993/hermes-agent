"""Version history for Library items. A file keeps what a replace overwrote — the old bytes hard-linked
aside before the swap, so keeping them costs no copy on the same volume; a page keeps a snapshot of
what it was when editing starts again after a pause. The newest ``MAX_VERSIONS`` per item are kept,
and restoring makes the current state a version first, so a restore is itself undoable.
"""

from __future__ import annotations

import os
import secrets
import shutil
import sqlite3
import time
from pathlib import Path

from hermes_cli import library_db as ldb

MAX_VERSIONS = 50
# A page's edits within this window belong to one version.
PAGE_SNAPSHOT_EVERY_S = 10 * 60
# What a version listing carries of a page's text, for its preview.
PREVIEW_CHARS = 20_000


def _dir() -> Path:
    return ldb.library_derived_dir("versions")


def _insert(conn: sqlite3.Connection, item: ldb.LibraryItem, **fields) -> None:
    row = {"id": f"ver_{secrets.token_hex(8)}", "item_id": item.id, "created_at": int(time.time()),
           "title": item.title, **fields}
    with ldb.write_txn(conn):
        conn.execute(f"INSERT INTO library_versions ({', '.join(row)}) VALUES ({', '.join('?' for _ in row)})",
                     tuple(row.values()))
    _prune(conn, item.id)


def _prune(conn: sqlite3.Connection, item_id: str) -> None:
    stale = conn.execute("SELECT id, file_ref FROM library_versions WHERE item_id = ? ORDER BY created_at DESC, "
                         "rowid DESC LIMIT -1 OFFSET ?", (item_id, MAX_VERSIONS)).fetchall()
    _drop(conn, stale)


def _drop(conn: sqlite3.Connection, rows) -> None:
    if not rows:
        return
    with ldb.write_txn(conn):
        conn.executemany("DELETE FROM library_versions WHERE id = ?", [(r[0],) for r in rows])
    for _, file_ref in rows:
        if file_ref:
            (_dir() / file_ref).unlink(missing_ok=True)


def snapshot_file(conn: sqlite3.Connection, item: ldb.LibraryItem) -> None:
    """Keep a file's current bytes as a version (called just before they are replaced)."""
    if item.kind != "file" or not item.path or not Path(item.path).exists():
        return
    folder = _dir()
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{secrets.token_hex(8)}{Path(item.path).suffix}"
    try:
        os.link(item.path, folder / name)
    except OSError:
        shutil.copyfile(item.path, folder / name)
    _insert(conn, item, file_ref=name, size=item.size, sha256=item.sha256)


def snapshot_page(conn: sqlite3.Connection, item: ldb.LibraryItem, *, force: bool = False) -> None:
    """Keep a page as it is now, unless a version was taken moments ago or nothing changed since."""
    if item.kind != "page":
        return
    last = conn.execute("SELECT created_at, markdown, content FROM library_versions WHERE item_id = ? "
                        "ORDER BY created_at DESC, rowid DESC LIMIT 1", (item.id,)).fetchone()
    if last is not None and (last[1], last[2]) == (item.markdown, item.content):
        return
    if not force and last is not None and time.time() - last[0] < PAGE_SNAPSHOT_EVERY_S:
        return
    _insert(conn, item, content=item.content, markdown=item.markdown, size=len(item.markdown.encode()))


def list_versions(conn: sqlite3.Connection, item_id: str) -> list[dict]:
    rows = conn.execute("SELECT id, created_at, title, size, markdown FROM library_versions WHERE item_id = ? "
                        "ORDER BY created_at DESC, rowid DESC", (item_id,)).fetchall()
    return [{"id": r[0], "created_at": r[1], "title": r[2] or "", "size": r[3] or 0,
             "markdown": (r[4] or "")[:PREVIEW_CHARS] if r[4] is not None else None} for r in rows]


def restore(conn: sqlite3.Connection, item: ldb.LibraryItem, version_id: str) -> ldb.LibraryItem:
    row = conn.execute("SELECT title, content, markdown, file_ref FROM library_versions WHERE id = ? AND item_id = ?",
                       (version_id, item.id)).fetchone()
    if row is None:
        raise ValueError("no such version")
    title, content, markdown, file_ref = row
    if item.kind == "file":
        if not file_ref or not (_dir() / file_ref).exists():
            raise ValueError("this version's bytes are gone")
        # replace_file keeps the current bytes as a version on its own.
        return ldb.replace_file(conn, item.id, source_path=str(_dir() / file_ref))
    snapshot_page(conn, item, force=True)
    return ldb.update_item(conn, item.id, title=title or item.title, content=content, markdown=markdown or "")


def purge(conn: sqlite3.Connection, item_ids: list[str]) -> None:
    """Forget the versions of items deleted for good."""
    if not item_ids:
        return
    marks = ", ".join("?" for _ in item_ids)
    _drop(conn, conn.execute(f"SELECT id, file_ref FROM library_versions WHERE item_id IN ({marks})",
                             item_ids).fetchall())
