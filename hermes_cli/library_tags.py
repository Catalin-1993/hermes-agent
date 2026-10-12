"""Finder-style tags and saved searches for the Library. A tag is a name with one of seven colours,
kept in a small registry; items carry the names they wear (``library_items.tags``, a JSON list).
Tagging organizes rather than edits, so it never moves "last edited". A saved search ("smart
folder") is a named query — text, types, access, author, tag, sort — the listing re-runs on open.
"""

from __future__ import annotations

import json
import secrets
import sqlite3
import time
from typing import Optional

from hermes_cli import library_db as ldb

PALETTE = ("red", "orange", "yellow", "green", "blue", "purple", "gray")
MAX_NAME = 40


def _clean(name: object) -> str:
    cleaned = " ".join(str(name or "").split())[:MAX_NAME]
    if not cleaned:
        raise ValueError("a tag needs a name")
    return cleaned


def _color(value: object, fallback: str) -> str:
    color = str(value or "").strip().lower()
    return color if color in PALETTE else fallback


def _worn(item: ldb.LibraryItem) -> list[str]:
    return json.loads(item.tags) if item.tags else []


def _wear(conn: sqlite3.Connection, item_id: str, names: list[str]) -> None:
    conn.execute("UPDATE library_items SET tags = ? WHERE id = ?", (json.dumps(names) if names else None, item_id))


def list_tags(conn: sqlite3.Connection) -> list[dict]:
    """The registry, each tag with how many live items wear it."""
    counts: dict[str, int] = {}
    for (raw,) in conn.execute("SELECT tags FROM library_items WHERE tags IS NOT NULL AND trashed_at IS NULL"):
        for name in json.loads(raw):
            counts[name.lower()] = counts.get(name.lower(), 0) + 1
    return [{"name": name, "color": color, "count": counts.get(name.lower(), 0)}
            for name, color in conn.execute("SELECT name, color FROM library_tags ORDER BY name COLLATE NOCASE")]


def tag_items(conn: sqlite3.Connection, item_ids: list[str], name: str, *, on: bool,
              color: Optional[str] = None) -> dict:
    """Put a tag on items (registering it, with the next free colour, if it is new) or take it off."""
    name = _clean(name)
    with ldb.write_txn(conn):
        known = conn.execute("SELECT name, color FROM library_tags WHERE name = ?", (name,)).fetchone()
        if known is None:
            used = {row[0] for row in conn.execute("SELECT color FROM library_tags")}
            fallback = next((c for c in PALETTE if c not in used), PALETTE[len(used) % len(PALETTE)])
            known = (name, _color(color, fallback))
            conn.execute("INSERT INTO library_tags (name, color) VALUES (?, ?)", known)
        canonical = known[0]
        for item_id in item_ids:
            item = ldb.get_item(conn, item_id)
            if item is None:
                continue
            worn = [n for n in _worn(item) if n.lower() != canonical.lower()]
            _wear(conn, item.id, [*worn, canonical] if on else worn)
    return {"name": canonical, "color": known[1]}


def update_tag(conn: sqlite3.Connection, name: str, *, color: Optional[str] = None,
               new_name: Optional[str] = None) -> dict:
    """Recolour or rename a tag — a rename follows it onto every item wearing it."""
    known = conn.execute("SELECT name, color FROM library_tags WHERE name = ?", (_clean(name),)).fetchone()
    if known is None:
        raise ValueError("no such tag")
    renamed = _clean(new_name) if new_name else known[0]
    recolored = _color(color, known[1])
    with ldb.write_txn(conn):
        conn.execute("UPDATE library_tags SET name = ?, color = ? WHERE name = ?", (renamed, recolored, known[0]))
        if renamed != known[0]:
            for item_id, raw in conn.execute("SELECT id, tags FROM library_items WHERE tags IS NOT NULL").fetchall():
                names = [renamed if n.lower() == known[0].lower() else n for n in json.loads(raw)]
                _wear(conn, item_id, names)
    return {"name": renamed, "color": recolored}


def delete_tag(conn: sqlite3.Connection, name: str) -> None:
    """Retire a tag from the registry and from every item."""
    name = _clean(name)
    with ldb.write_txn(conn):
        conn.execute("DELETE FROM library_tags WHERE name = ?", (name,))
        for item_id, raw in conn.execute("SELECT id, tags FROM library_items WHERE tags IS NOT NULL").fetchall():
            _wear(conn, item_id, [n for n in json.loads(raw) if n.lower() != name.lower()])


# Saved searches keep only what the listing understands.
_QUERY_KEYS = ("query", "types", "access", "createdBy", "tag", "sort", "order")


def list_smart(conn: sqlite3.Connection) -> list[dict]:
    return [{"id": r[0], "title": r[1], "query": json.loads(r[2])}
            for r in conn.execute("SELECT id, title, query FROM library_smart ORDER BY created_at")]


def create_smart(conn: sqlite3.Connection, title: str, query: dict) -> dict:
    title = " ".join(str(title or "").split())[:80]
    if not title:
        raise ValueError("a saved search needs a name")
    kept = {k: v for k, v in (query or {}).items() if k in _QUERY_KEYS and v not in (None, "", [])}
    row = (f"smart_{secrets.token_hex(6)}", title, json.dumps(kept), int(time.time()))
    with ldb.write_txn(conn):
        conn.execute("INSERT INTO library_smart (id, title, query, created_at) VALUES (?, ?, ?, ?)", row)
    return {"id": row[0], "title": title, "query": kept}


def delete_smart(conn: sqlite3.Connection, smart_id: str) -> None:
    with ldb.write_txn(conn):
        conn.execute("DELETE FROM library_smart WHERE id = ?", (str(smart_id or ""),))
