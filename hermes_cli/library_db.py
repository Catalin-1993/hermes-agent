"""Per-profile Library store: folders, Notion-style pages and saved files (images, video, documents).

One SQLite table (``$HERMES_HOME/library.db``) holds every item; file bytes live beside it under
``$HERMES_HOME/library/files/``. Items form a tree through ``parent_id``: folders hold folders, pages
and files; a page holds its subpages and the files embedded in it; nothing sits under a file. Pages keep two renditions: ``content`` — the editor's block
document (JSON text, owned by the desktop editor) — and ``markdown``, the plain rendition search
and the agent read. A write that only carries markdown (the agent's) clears ``content`` so the
editor re-imports the markdown instead of showing a stale block document.

Files are processed after they land (``hermes_cli/library_processing.py``): ``status`` goes
``pending`` → ``ready`` / ``failed``, a thumbnail and (for formats a browser cannot show) a preview
rendition are written under ``library/thumbs`` / ``library/previews``, and the extracted text joins
the ``library_fts`` index that search reads, beside every page's title and markdown.

``visibility`` is the owner's rule for the agent, per item:

- ``private`` — the agent never sees the item (not even in search results);
- ``ask``     — the agent may read it only after the owner approves that read;
- ``open``    — the agent may search and read it without asking.

Writes by the agent are always approved by the owner regardless of visibility; that gate lives
in ``tools/library_tool.py``. This module is policy-free storage plus the visibility filter.
"""

from __future__ import annotations

import contextlib
import hashlib
import json
import mimetypes
import os
import re
import secrets
import shutil
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional

from hermes_cli.sqlite_util import open_db, write_txn
from hermes_constants import get_hermes_home

VISIBILITIES = ("private", "ask", "open")
KINDS = ("page", "file", "folder")
_ID_PREFIX = {"page": "pg", "file": "fl", "folder": "fd"}
SORTS = ("updated", "created", "name", "size", "kind")
# Uploads beyond this are refused; large media belongs on disk, imported by path.
MAX_FILE_BYTES = 512 * 1024 * 1024
_EXCERPT_CHARS = 180
_INITIALIZED_PATHS: set[str] = set()

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS library_items (
    id            TEXT PRIMARY KEY,
    kind          TEXT NOT NULL,
    title         TEXT NOT NULL,
    icon          TEXT,
    parent_id     TEXT,
    visibility    TEXT NOT NULL DEFAULT 'private',
    favorite      INTEGER NOT NULL DEFAULT 0,
    content       TEXT,
    markdown      TEXT NOT NULL DEFAULT '',
    mime          TEXT,
    file_name     TEXT,
    file_ref      TEXT,
    size          INTEGER,
    created_by    TEXT NOT NULL DEFAULT 'user',
    sha256        TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    trashed_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_library_items_updated ON library_items(updated_at);
CREATE INDEX IF NOT EXISTS idx_library_items_parent ON library_items(parent_id);
"""

# Excerpts read as prose: ``[label](url)`` / ``![alt](library://…)`` keep their text, and line-leading
# markers (headings, bullets, quotes, checkboxes, numbering) plus emphasis runs are dropped.
_MARKDOWN_LINK = re.compile(r"!?\[([^\]]*)\]\([^)]*\)")
# A presentation page: its text opens with this marker, slides split on ``---`` lines
# (apps/desktop/src/app/library/deck.ts keeps the same format).
_DECK_MARKER = re.compile(r"^\s*<!--\s*hermes:deck\b([^>]*)-->[ \t]*(?:\r?\n|$)")
_DECK_RULE = re.compile(r"(?m)^\s*---\s*$")
_DECK_COVER_CHARS = 600
# HTML comments are markup, not reading text — a presentation's ``<!-- hermes:deck … -->`` marker most of all.
_HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
# Whole lines that are only a rule or a table's separator row go first; then markers, emphasis, pipes.
_MARKDOWN_NOISE = re.compile(r"(?m)^(?=.*-{3})[\s|:-]+$|^\s*(?:#{1,6}|[-*+]|>|\d+[.)])\s+(?:\[[ xX]\]\s+)?|[*_`~]{1,3}|\|")

# File names are kept for display only; the stored name is the item id plus a sanitized suffix.
_SUFFIX_RE = re.compile(r"^\.[A-Za-z0-9]{1,12}$")


def library_db_path() -> Path:
    """The per-profile Library DB (``$HERMES_HOME/library.db``)."""
    return get_hermes_home() / "library.db"


def library_files_dir() -> Path:
    """Where saved file bytes live (``$HERMES_HOME/library/files``)."""
    return get_hermes_home() / "library" / "files"


def library_derived_dir(kind: str) -> Path:
    """Renditions derived from a file: ``thumbs`` (small JPEGs) and ``previews`` (a JPEG for an
    image a browser cannot show, a PDF for an office document)."""
    return get_hermes_home() / "library" / kind


def _now() -> int:
    return int(time.time())


def _new_id(kind: str) -> str:
    return f"{_ID_PREFIX[kind]}_{secrets.token_hex(8)}"


def normalize_visibility(value: Optional[str], default: str = "private") -> str:
    v = str(value or "").strip().lower() or default
    if v not in VISIBILITIES:
        raise ValueError(f"visibility must be one of: {', '.join(VISIBILITIES)}")
    return v


def _visibility_for(conn: sqlite3.Connection, visibility: Optional[str], parent_id: Optional[str]) -> str:
    """An explicit level, else the container's — a new item inherits its folder's (or page's) access —
    else private."""
    if visibility:
        return normalize_visibility(visibility)
    parent = get_item(conn, parent_id) if parent_id else None
    return parent.visibility if parent is not None else "private"


def connect(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Open (and initialize if needed) the per-profile Library DB."""
    path = db_path if db_path is not None else library_db_path()
    resolved = str(Path(path).resolve())

    def _initialize(conn: sqlite3.Connection) -> None:
        if resolved in _INITIALIZED_PATHS:
            return
        conn.executescript(SCHEMA_SQL)
        _migrate(conn)
        _INITIALIZED_PATHS.add(resolved)

    return open_db(path, db_label="library.db", initialize=_initialize)


_ADDED_COLUMNS = {"sha256": "TEXT", "status": "TEXT", "meta": "TEXT", "thumb_ref": "TEXT", "preview_ref": "TEXT",
                  # JSON list of tag names (``library_tags.py``).
                  "tags": "TEXT",
                  # A page's cover: ``gradient:<name>`` or ``image:<item id>``, optionally ``@<0-100>``
                  # for the image's vertical focus (``apps/desktop`` page-cover).
                  "cover": "TEXT",
                  # The conversation Hermes last made or changed the item in (``mark_session``).
                  "session_id": "TEXT"}

# Version history (``library_versions.py``), the tag registry and saved searches (``library_tags.py``).
_LATER_TABLES = """
CREATE TABLE IF NOT EXISTS library_versions (
    id          TEXT PRIMARY KEY,
    item_id     TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    title       TEXT,
    content     TEXT,
    markdown    TEXT,
    file_ref    TEXT,
    size        INTEGER,
    sha256      TEXT
);
CREATE INDEX IF NOT EXISTS idx_library_versions_item ON library_versions(item_id, created_at);
CREATE TABLE IF NOT EXISTS library_tags (
    name        TEXT PRIMARY KEY COLLATE NOCASE,
    color       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS library_smart (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    query       TEXT NOT NULL,
    created_at  INTEGER NOT NULL
);
"""


def _migrate(conn: sqlite3.Connection) -> None:
    """Columns and the search index added after a store was first created (CREATE TABLE IF NOT
    EXISTS skips them). A new index is filled from every page already there."""
    have = {row[1] for row in conn.execute("PRAGMA table_info(library_items)")}
    for name, decl in _ADDED_COLUMNS.items():
        if name not in have:
            conn.execute(f"ALTER TABLE library_items ADD COLUMN {name} {decl}")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_library_items_size ON library_items(size)")
    conn.executescript(_LATER_TABLES)
    fresh = conn.execute("SELECT 1 FROM sqlite_master WHERE name = 'library_fts'").fetchone() is None
    conn.execute("CREATE VIRTUAL TABLE IF NOT EXISTS library_fts USING fts5("
                 "item_id UNINDEXED, title, body, tokenize = 'unicode61 remove_diacritics 2')")
    if fresh:
        conn.execute("INSERT INTO library_fts (item_id, title, body) "
                     "SELECT id, title, CASE WHEN kind = 'page' THEN markdown ELSE IFNULL(file_name, '') END "
                     "FROM library_items")
    conn.commit()


@contextlib.contextmanager
def connect_closing(db_path: Optional[Path] = None):
    """A connection closed on exit (long-lived gateway processes would otherwise leak fds)."""
    conn = connect(db_path=db_path)
    try:
        yield conn
    finally:
        with contextlib.suppress(Exception):
            conn.close()


@dataclass
class LibraryItem:
    id: str
    kind: str
    title: str
    visibility: str
    created_at: int
    updated_at: int
    icon: Optional[str] = None
    parent_id: Optional[str] = None
    favorite: bool = False
    content: Optional[str] = None
    markdown: str = ""
    mime: Optional[str] = None
    file_name: Optional[str] = None
    file_ref: Optional[str] = None
    size: Optional[int] = None
    created_by: str = "user"
    trashed_at: Optional[int] = None
    sha256: Optional[str] = None
    status: Optional[str] = None
    meta: Optional[str] = None
    thumb_ref: Optional[str] = None
    preview_ref: Optional[str] = None
    # JSON list of tag names (``library_tags.py``).
    tags: Optional[str] = None
    cover: Optional[str] = None
    session_id: Optional[str] = None
    # Listing extras: a container's live children, the name of the container an item is in, and
    # where a search matched its text (with U+E000 / U+E001 around the hits).
    child_count: Optional[int] = None
    parent_title: Optional[str] = None
    snippet: Optional[str] = None

    @property
    def path(self) -> Optional[str]:
        """Absolute path of a file item's bytes (None for pages)."""
        return str(library_files_dir() / self.file_ref) if self.kind == "file" and self.file_ref else None

    @property
    def thumb(self) -> Optional[str]:
        return str(library_derived_dir("thumbs") / self.thumb_ref) if self.thumb_ref else None

    @property
    def preview(self) -> Optional[str]:
        return str(library_derived_dir("previews") / self.preview_ref) if self.preview_ref else None

    @property
    def excerpt(self) -> str:
        """The body as one line of reading text: markdown markers, embeds and links reduced to words."""
        text = " ".join(_MARKDOWN_NOISE.sub(" ", _MARKDOWN_LINK.sub(r"\1", _HTML_COMMENT.sub(" ", self.markdown))).split())
        return text[:_EXCERPT_CHARS] + ("…" if len(text) > _EXCERPT_CHARS else "")

    @property
    def deck_cover(self) -> Optional[dict]:
        """A presentation's theme and first slide, enough to draw its thumbnail without its body."""
        marker = _DECK_MARKER.match(self.markdown) if self.kind == "page" else None
        if marker is None:
            return None
        theme = re.search(r"\btheme=(\w+)", marker.group(1))
        first = _DECK_RULE.split(self.markdown[marker.end():], maxsplit=1)[0].strip()
        return {"theme": theme.group(1) if theme else "paper", "slide": first[:_DECK_COVER_CHARS]}

    def to_dict(self, *, with_body: bool = False) -> dict:
        d = {
            "id": self.id, "kind": self.kind, "title": self.title, "icon": self.icon,
            "parent_id": self.parent_id, "visibility": self.visibility, "favorite": bool(self.favorite),
            "mime": self.mime, "file_name": self.file_name, "size": self.size, "path": self.path,
            "created_by": self.created_by, "created_at": self.created_at, "updated_at": self.updated_at,
            "trashed_at": self.trashed_at, "excerpt": self.excerpt,
            "tags": json.loads(self.tags) if self.tags else [], "cover": self.cover,
            "session_id": self.session_id,
        }
        if (deck := self.deck_cover) is not None:
            d["deck"] = deck
        if self.kind == "file":
            d["status"] = self.status or "pending"
            d["thumb"] = self.thumb
            d["meta"] = json.loads(self.meta) if self.meta else {}
        if self.child_count is not None:
            d["child_count"] = self.child_count
        if self.parent_title is not None:
            d["parent_title"] = self.parent_title
        if self.snippet:
            d["snippet"] = self.snippet
        if with_body:
            d["content"] = self.content
            d["markdown"] = self.markdown
        return d


def _row_item(row: sqlite3.Row) -> LibraryItem:
    keys = row.keys()
    return LibraryItem(
        id=row["id"], kind=row["kind"], title=row["title"], visibility=row["visibility"],
        created_at=row["created_at"], updated_at=row["updated_at"], icon=row["icon"],
        parent_id=row["parent_id"], favorite=bool(row["favorite"]), content=row["content"],
        markdown=row["markdown"] or "", mime=row["mime"], file_name=row["file_name"],
        file_ref=row["file_ref"], size=row["size"], created_by=row["created_by"] or "user",
        trashed_at=row["trashed_at"], sha256=row["sha256"] if "sha256" in keys else None,
        status=row["status"] if "status" in keys else None, meta=row["meta"] if "meta" in keys else None,
        thumb_ref=row["thumb_ref"] if "thumb_ref" in keys else None,
        tags=row["tags"] if "tags" in keys else None,
        cover=row["cover"] if "cover" in keys else None,
        session_id=row["session_id"] if "session_id" in keys else None,
        preview_ref=row["preview_ref"] if "preview_ref" in keys else None,
        child_count=row["child_count"] if "child_count" in keys else None,
        parent_title=row["parent_title"] if "parent_title" in keys else None,
    )


def get_item(conn: sqlite3.Connection, item_id: str) -> Optional[LibraryItem]:
    row = conn.execute("SELECT * FROM library_items WHERE id = ?", (str(item_id or ""),)).fetchone()
    return _row_item(row) if row else None


def _escape_like(text: str) -> str:
    """Make user text literal inside a ``LIKE … ESCAPE '\\'`` pattern."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


_SORT_SQL = {
    "updated": "i.updated_at", "created": "i.created_at", "name": "i.title COLLATE NOCASE",
    "size": "IFNULL(i.size, 0)", "kind": "i.kind, IFNULL(i.mime, '')",
}

# Listing extras ride the same query: live child count (folder cards) and the container's name.
_LIST_SELECT = (
    "SELECT i.*, "
    "(SELECT COUNT(*) FROM library_items c WHERE c.parent_id = i.id AND c.trashed_at IS NULL) AS child_count, "
    "(SELECT p.title FROM library_items p WHERE p.id = i.parent_id) AS parent_title "
    "FROM library_items i"
)


def list_items(
    conn: sqlite3.Connection,
    *,
    kind: Optional[str] = None,
    query: Optional[str] = None,
    trashed: bool = False,
    favorites: bool = False,
    visibilities: Optional[Iterable[str]] = None,
    parent_id: Optional[str] = None,
    tag: Optional[str] = None,
    sort: str = "updated",
    order: Optional[str] = None,
    limit: int = 500,
) -> list[LibraryItem]:
    """Items, newest first by default. ``parent_id`` browses the tree: ``None`` lists across it,
    ``""`` the root, an id that container — folders first while browsing. ``trashed`` selects
    what was moved to the Trash (only the items trashed themselves, not what went with them);
    ``visibilities`` restricts to those levels (the agent's filter); ``query`` matches title,
    file name and body."""
    clauses = ["i.trashed_at IS NOT NULL" if trashed else "i.trashed_at IS NULL"]
    args: list = []
    if trashed:
        clauses.append("NOT EXISTS (SELECT 1 FROM library_items p WHERE p.id = i.parent_id "
                       "AND p.trashed_at = i.trashed_at)")
    if kind:
        clauses.append("i.kind = ?")
        args.append(kind)
    if favorites:
        clauses.append("i.favorite = 1")
    if tag:
        clauses.append("EXISTS (SELECT 1 FROM json_each(IFNULL(i.tags, '[]')) t WHERE t.value = ? COLLATE NOCASE)")
        args.append(tag)
    browsing = parent_id is not None and not trashed
    if parent_id is not None:
        if parent_id == "":
            clauses.append("i.parent_id IS NULL")
        else:
            clauses.append("i.parent_id = ?")
            args.append(parent_id)
    if visibilities is not None:
        levels = [v for v in visibilities if v in VISIBILITIES]
        if not levels:
            return []
        clauses.append(f"i.visibility IN ({', '.join('?' for _ in levels)})")
        args.extend(levels)
    q = (query or "").strip()
    match = _fts_query(q)
    if q:
        like = "%" + _escape_like(q) + "%"
        text_hit = "i.title LIKE ? ESCAPE '\\' OR i.markdown LIKE ? ESCAPE '\\' OR IFNULL(i.file_name, '') LIKE ? ESCAPE '\\'"
        args_hit: list = [like, like, like]
        if match:
            text_hit += " OR i.id IN (SELECT item_id FROM library_fts WHERE library_fts MATCH ?)"
            args_hit.append(match)
        clauses.append(f"({text_hit})")
        args.extend(args_hit)
    key = sort if sort in SORTS else "updated"
    direction = (order or ("asc" if key == "name" else "desc")).lower()
    direction = "ASC" if direction == "asc" else "DESC"
    ordering = f"{_SORT_SQL[key]} {direction}, i.id"
    if browsing:
        ordering = f"CASE WHEN i.kind = 'folder' THEN 0 ELSE 1 END, {ordering}"
    sql = f"{_LIST_SELECT} WHERE {' AND '.join(clauses)} ORDER BY {ordering} LIMIT ?"
    args.append(max(1, min(int(limit), 5000)))
    items = [_row_item(r) for r in conn.execute(sql, args).fetchall()]
    if match and items:
        marks = ", ".join("?" for _ in items)
        snippets = dict(conn.execute(
            "SELECT item_id, snippet(library_fts, 2, char(57344), char(57345), '…', 14) FROM library_fts "
            f"WHERE library_fts MATCH ? AND item_id IN ({marks})", [match, *[i.id for i in items]]).fetchall())
        for item in items:
            hit = snippets.get(item.id) or ""
            item.snippet = hit if "\ue000" in hit else None
    return items


def _fts_query(text: str) -> str:
    """User words → an FTS5 query: every word must appear. The word still being typed (the query
    ends inside it) matches as a prefix — "nvid" finds NVIDIA — finished words match whole, so
    "100%" finds 100 and not 1000."""
    words = re.findall(r"\w+", text or "", re.UNICODE)[:12]
    typing = bool(re.search(r"\w$", (text or "").rstrip("\n"), re.UNICODE))
    return " ".join(f'"{w}"' + ("*" if typing and i == len(words) - 1 else "") for i, w in enumerate(words))


def index_text(conn: sqlite3.Connection, item_id: str, *, title: str, body: str) -> None:
    """(Re)place an item's searchable text."""
    with write_txn(conn):
        conn.execute("DELETE FROM library_fts WHERE item_id = ?", (item_id,))
        conn.execute("INSERT INTO library_fts (item_id, title, body) VALUES (?, ?, ?)",
                     (item_id, title or "", (body or "")[:1_000_000]))


def set_processed(conn: sqlite3.Connection, item_id: str, *, status: str, meta: Optional[dict] = None,
                  thumb_ref: Optional[str] = None, preview_ref: Optional[str] = None) -> None:
    """Record the outcome of processing a file (not an edit: ``updated_at`` stays)."""
    with write_txn(conn):
        conn.execute("UPDATE library_items SET status = ?, meta = ?, thumb_ref = ?, preview_ref = ? WHERE id = ?",
                     (status, json.dumps(meta or {}), thumb_ref, preview_ref, item_id))


def descendant_ids(conn: sqlite3.Connection, item_id: str) -> list[str]:
    """Every item below ``item_id`` in the tree, trashed or not."""
    rows = conn.execute(
        "WITH RECURSIVE tree(id) AS (SELECT id FROM library_items WHERE parent_id = ? "
        "UNION SELECT i.id FROM library_items i JOIN tree t ON i.parent_id = t.id) SELECT id FROM tree",
        (item_id,)).fetchall()
    return [r[0] for r in rows]


def ancestors(conn: sqlite3.Connection, item_id: str) -> list[LibraryItem]:
    """The containers above ``item_id``, outermost first (the breadcrumb)."""
    trail: list[LibraryItem] = []
    seen: set[str] = set()
    current = get_item(conn, item_id)
    while current is not None and current.parent_id and current.parent_id not in seen:
        seen.add(current.parent_id)
        current = get_item(conn, current.parent_id)
        if current is not None:
            trail.append(current)
    return list(reversed(trail))


def _check_parent(conn: sqlite3.Connection, parent_id: Optional[str], *, kind: str,
                  moving: Optional[str] = None) -> Optional[str]:
    """``parent_id`` normalized (``""`` → root) once it is known to hold a ``kind``: folders nest
    only in folders, pages and files go in a folder or a page, nothing sits under a file, and
    nothing moves into itself or below its own descendants."""
    pid = str(parent_id or "").strip() or None
    if pid is None:
        return None
    parent = get_item(conn, pid)
    if parent is None or parent.trashed_at is not None:
        raise ValueError("the destination no longer exists")
    if parent.kind == "file":
        raise ValueError("a file can't hold other items")
    if kind == "folder" and parent.kind != "folder":
        raise ValueError("folders can only go inside folders")
    if moving and (pid == moving or pid in descendant_ids(conn, moving)):
        raise ValueError("an item can't move inside itself")
    return pid


def create_folder(
    conn: sqlite3.Connection,
    *,
    title: str,
    parent_id: Optional[str] = None,
    visibility: Optional[str] = None,
    created_by: str = "user",
) -> LibraryItem:
    now = _now()
    item_id = _new_id("folder")
    parent = _check_parent(conn, parent_id, kind="folder")
    with write_txn(conn):
        conn.execute(
            "INSERT INTO library_items (id, kind, title, parent_id, visibility, markdown, created_by, "
            "created_at, updated_at) VALUES (?, 'folder', ?, ?, ?, '', ?, ?, ?)",
            (item_id, (title or "").strip() or "Untitled folder", parent, _visibility_for(conn, visibility, parent),
             created_by, now, now),
        )
    return get_item(conn, item_id)  # type: ignore[return-value]


def move_items(conn: sqlite3.Connection, ids: Iterable[str], parent_id: Optional[str]) -> list[LibraryItem]:
    """Re-home items under ``parent_id`` (``""`` / ``None`` = the root). All are checked before any
    moves; a move is not an edit, so ``updated_at`` stays."""
    items = []
    for item_id in dict.fromkeys(str(i) for i in ids):
        item = get_item(conn, item_id)
        if item is None or item.trashed_at is not None:
            raise ValueError(f"no such library item: {item_id}")
        items.append((item, _check_parent(conn, parent_id, kind=item.kind, moving=item.id)))
    with write_txn(conn):
        for item, parent in items:
            conn.execute("UPDATE library_items SET parent_id = ? WHERE id = ?", (parent, item.id))
    return [get_item(conn, item.id) for item, _ in items]  # type: ignore[misc]


def create_page(
    conn: sqlite3.Connection,
    *,
    title: str = "",
    icon: Optional[str] = None,
    content: Optional[str] = None,
    markdown: str = "",
    visibility: Optional[str] = None,
    parent_id: Optional[str] = None,
    created_by: str = "user",
) -> LibraryItem:
    now = _now()
    item_id = _new_id("page")
    parent_id = _check_parent(conn, parent_id, kind="page")
    with write_txn(conn):
        conn.execute(
            "INSERT INTO library_items (id, kind, title, icon, parent_id, visibility, content, markdown, "
            "created_by, created_at, updated_at) VALUES (?, 'page', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (item_id, (title or "").strip(), icon, parent_id, _visibility_for(conn, visibility, parent_id), content,
             markdown or "", created_by, now, now),
        )
    index_text(conn, item_id, title=(title or "").strip(), body=markdown or "")
    return get_item(conn, item_id)  # type: ignore[return-value]


_UNSET = object()


def update_item(
    conn: sqlite3.Connection,
    item_id: str,
    *,
    title=_UNSET,
    icon=_UNSET,
    cover=_UNSET,
    content=_UNSET,
    markdown=_UNSET,
    visibility=_UNSET,
    favorite=_UNSET,
    parent_id=_UNSET,
) -> Optional[LibraryItem]:
    """Patch the given fields. A markdown write without a block document clears ``content`` (the
    editor then re-imports the markdown) — the block document and its markdown never disagree."""
    item = get_item(conn, item_id)
    if item is None:
        return None
    sets: dict = {}
    if title is not _UNSET:
        sets["title"] = str(title or "").strip()
    if icon is not _UNSET:
        sets["icon"] = icon or None
    if cover is not _UNSET:
        sets["cover"] = cover or None
    if content is not _UNSET:
        sets["content"] = content
    if markdown is not _UNSET:
        sets["markdown"] = markdown or ""
        if content is _UNSET and item.kind == "page":
            sets["content"] = None
    if visibility is not _UNSET:
        sets["visibility"] = normalize_visibility(visibility)
    if favorite is not _UNSET:
        sets["favorite"] = 1 if favorite else 0
    if parent_id is not _UNSET:
        sets["parent_id"] = _check_parent(conn, parent_id, kind=item.kind, moving=item.id)
    if not sets:
        return item
    if item.kind == "page" and ("content" in sets or "markdown" in sets):
        from hermes_cli import library_versions

        library_versions.snapshot_page(conn, item)
    sets["updated_at"] = _now()
    with write_txn(conn):
        conn.execute(
            f"UPDATE library_items SET {', '.join(f'{k} = ?' for k in sets)} WHERE id = ?",
            (*sets.values(), item.id),
        )
        # A container's new access reaches what inherited its old one; a level set by hand stays.
        if "visibility" in sets and sets["visibility"] != item.visibility and item.kind != "file":
            below = descendant_ids(conn, item.id)
            if below:
                marks = ", ".join("?" for _ in below)
                conn.execute(f"UPDATE library_items SET visibility = ? WHERE visibility = ? AND id IN ({marks})",
                             (sets["visibility"], item.visibility, *below))
    if "title" in sets or "markdown" in sets:
        fresh = get_item(conn, item.id)
        if fresh is not None and fresh.kind != "file":
            index_text(conn, fresh.id, title=fresh.title, body=fresh.markdown)
        elif fresh is not None and "title" in sets:
            with write_txn(conn):
                conn.execute("UPDATE library_fts SET title = ? WHERE item_id = ?", (fresh.title, fresh.id))
    return get_item(conn, item.id)


def _suffix_for(file_name: str, mime: Optional[str]) -> str:
    suffix = Path(file_name or "").suffix
    if _SUFFIX_RE.match(suffix or ""):
        return suffix.lower()
    guessed = mimetypes.guess_extension(mime or "") if mime else None
    return guessed or ""


def file_digest(*, source_path: Optional[str] = None, data: Optional[bytes] = None) -> tuple[int, str]:
    """``(size, sha256)`` of the bytes about to be stored — what duplicate detection compares."""
    if data is not None:
        return len(data), hashlib.sha256(data).hexdigest()
    digest = hashlib.sha256()
    size = 0
    with open(Path(str(source_path)).expanduser(), "rb") as fh:  # windows-footgun: ok — binary mode, no text encoding
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    return size, digest.hexdigest()


def find_conflict(
    conn: sqlite3.Connection, *, file_name: str, size: int, sha256: str, parent_id: Optional[str]
) -> Optional[tuple[str, LibraryItem]]:
    """What an incoming file collides with: ``("content", item)`` when the same bytes are already
    saved anywhere, else ``("name", item)`` when its container already holds that file name."""
    for item in list_items(conn, kind="file", limit=5000):
        if item.size != size:
            continue
        digest = item.sha256
        if digest is None and item.path and Path(item.path).is_file():
            # Files saved before digests existed get one the first time a same-size file arrives.
            digest = file_digest(source_path=item.path)[1]
            with write_txn(conn):
                conn.execute("UPDATE library_items SET sha256 = ? WHERE id = ?", (digest, item.id))
        if digest == sha256:
            return "content", item
    name = Path(file_name or "").name.lower()
    if name:
        parent = str(parent_id or "").strip()
        for item in list_items(conn, kind="file", parent_id=parent, limit=5000):
            if (item.file_name or "").lower() == name:
                return "name", item
    return None


def unique_name(conn: sqlite3.Connection, file_name: str, parent_id: Optional[str]) -> str:
    """``file_name``, or ``stem (2).ext`` / ``(3)``… when its container already has one by that name."""
    taken = {(i.file_name or "").lower() for i in list_items(
        conn, kind="file", parent_id=str(parent_id or "").strip(), limit=5000)}
    path = Path(file_name)
    candidate, n = file_name, 2
    while candidate.lower() in taken:
        candidate = f"{path.stem} ({n}){path.suffix}"
        n += 1
    return candidate


def save_file(
    conn: sqlite3.Connection,
    *,
    file_name: str,
    source_path: Optional[str] = None,
    data: Optional[bytes] = None,
    mime: Optional[str] = None,
    visibility: Optional[str] = None,
    parent_id: Optional[str] = None,
    title: Optional[str] = None,
    created_by: str = "user",
    sha256: Optional[str] = None,
    move_source: bool = False,
) -> LibraryItem:
    """Store a file from bytes or from ``source_path`` (copied, or moved when ``move_source`` —
    a staged upload); the item records its display name, mime type, size and digest. Exactly one
    of ``data`` / ``source_path`` must be given."""
    if (data is None) == (source_path is None):
        raise ValueError("pass exactly one of data or source_path")
    name = Path(str(file_name or "").strip() or (Path(source_path).name if source_path else "file")).name
    if source_path is not None:
        src = Path(source_path).expanduser()
        if not src.is_file():
            raise ValueError(f"not a file: {source_path}")
        size = src.stat().st_size
    else:
        size = len(data or b"")
    if size > MAX_FILE_BYTES:
        raise ValueError(f"file is larger than {MAX_FILE_BYTES // (1024 * 1024)} MB")
    parent_id = _check_parent(conn, parent_id, kind="file")
    if sha256 is None:
        sha256 = file_digest(source_path=source_path, data=data)[1]
    mime = mime or mimetypes.guess_type(name)[0] or "application/octet-stream"
    item_id = _new_id("file")
    file_ref = item_id + _suffix_for(name, mime)
    target = library_files_dir() / file_ref
    target.parent.mkdir(parents=True, exist_ok=True)
    if source_path is not None:
        (shutil.move if move_source else shutil.copyfile)(str(Path(source_path).expanduser()), str(target))
    else:
        target.write_bytes(data or b"")
    now = _now()
    try:
        with write_txn(conn):
            conn.execute(
                "INSERT INTO library_items (id, kind, title, parent_id, visibility, markdown, mime, file_name, "
                "file_ref, size, sha256, status, created_by, created_at, updated_at) "
                "VALUES (?, 'file', ?, ?, ?, '', ?, ?, ?, ?, ?, 'pending', ?, ?, ?)",
                (item_id, (title or name).strip() or name, parent_id, _visibility_for(conn, visibility, parent_id), mime, name,
                 file_ref, size, sha256, created_by, now, now),
            )
    except Exception:
        target.unlink(missing_ok=True)
        raise
    index_text(conn, item_id, title=(title or name).strip() or name, body=name)
    return get_item(conn, item_id)  # type: ignore[return-value]


def replace_file(
    conn: sqlite3.Connection,
    item_id: str,
    *,
    source_path: Optional[str] = None,
    data: Optional[bytes] = None,
    mime: Optional[str] = None,
    move_source: bool = False,
) -> LibraryItem:
    """New bytes for an existing file item: same id, place, access and favorite — what a
    "Replace" answer to a name clash keeps."""
    item = get_item(conn, item_id)
    if item is None or item.kind != "file" or not item.file_ref:
        raise ValueError(f"no such library file: {item_id}")
    if (data is None) == (source_path is None):
        raise ValueError("pass exactly one of data or source_path")
    size, digest = file_digest(source_path=source_path, data=data)
    if size > MAX_FILE_BYTES:
        raise ValueError(f"file is larger than {MAX_FILE_BYTES // (1024 * 1024)} MB")
    target = library_files_dir() / item.file_ref
    from hermes_cli import library_versions

    library_versions.snapshot_file(conn, item)
    staged = target.with_name(target.name + ".incoming")
    if source_path is not None:
        (shutil.move if move_source else shutil.copyfile)(str(Path(source_path).expanduser()), str(staged))
    else:
        staged.write_bytes(data or b"")
    os.replace(staged, target)
    with write_txn(conn):
        conn.execute("UPDATE library_items SET size = ?, sha256 = ?, mime = ?, status = 'pending', "
                     "updated_at = ? WHERE id = ?", (size, digest, mime or item.mime, _now(), item.id))
    return get_item(conn, item.id)  # type: ignore[return-value]


# Skipped when a whole folder is imported: dotfiles and the OS's own bookkeeping.
_IMPORT_SKIP = {"thumbs.db", "desktop.ini", "icon\r"}


def import_folder(
    conn: sqlite3.Connection,
    source_dir: str,
    *,
    parent_id: Optional[str] = None,
    visibility: Optional[str] = None,
    created_by: str = "user",
    max_files: int = 5000,
) -> dict:
    """Mirror a directory on the backend host as a folder tree of copied files. Hidden entries and
    symlinks are skipped; ``truncated`` says the ``max_files`` cap was hit."""
    root = Path(source_dir).expanduser()
    if not root.is_dir():
        raise ValueError(f"not a folder: {source_dir}")
    top = create_folder(conn, title=root.name or "Imported folder", parent_id=parent_id,
                        visibility=visibility, created_by=created_by)
    folder_ids = {root: top.id}
    imported, failed, truncated = 0, [], False
    for current, dirs, files in os.walk(root, followlinks=False):
        here = Path(current)
        dirs[:] = sorted(d for d in dirs if not d.startswith(".") and not (here / d).is_symlink())
        for d in dirs:
            folder_ids[here / d] = create_folder(conn, title=d, parent_id=folder_ids[here],
                                                 visibility=visibility, created_by=created_by).id
        for name in sorted(files):
            path = here / name
            if name.startswith(".") or name.lower() in _IMPORT_SKIP or path.is_symlink():
                continue
            if imported >= max_files:
                truncated = True
                break
            try:
                save_file(conn, file_name=name, source_path=str(path), parent_id=folder_ids[here],
                          visibility=visibility, created_by=created_by)
                imported += 1
            except (OSError, ValueError):
                failed.append(str(path.relative_to(root)))
        if truncated:
            break
    return {"folder": get_item(conn, top.id), "imported": imported, "failed": failed, "truncated": truncated}


def trash_item(conn: sqlite3.Connection, item_id: str, *, restore: bool = False) -> Optional[LibraryItem]:
    """Move an item and everything below it to the Trash, or bring back what went with it. What was
    trashed separately earlier stays there; an item whose container is gone returns to the root."""
    item = get_item(conn, item_id)
    if item is None:
        return None
    below = descendant_ids(conn, item.id)
    with write_txn(conn):
        if restore:
            stamp = item.trashed_at
            parent = get_item(conn, item.parent_id) if item.parent_id else None
            orphaned = item.parent_id is not None and (parent is None or parent.trashed_at is not None)
            conn.execute("UPDATE library_items SET trashed_at = NULL, parent_id = ? WHERE id = ?",
                         (None if orphaned else item.parent_id, item.id))
            if stamp is not None and below:
                marks = ", ".join("?" for _ in below)
                conn.execute(f"UPDATE library_items SET trashed_at = NULL WHERE trashed_at = ? AND id IN ({marks})",
                             (stamp, *below))
        else:
            # Each trashing gets its own stamp (restore matches on it), even within one second.
            latest = conn.execute("SELECT MAX(trashed_at) FROM library_items").fetchone()[0] or 0
            stamp = max(_now(), latest + 1)
            ids = [item.id, *below]
            marks = ", ".join("?" for _ in ids)
            conn.execute(f"UPDATE library_items SET trashed_at = ? WHERE trashed_at IS NULL AND id IN ({marks})",
                         (stamp, *ids))
    return get_item(conn, item.id)


def purge_item(conn: sqlite3.Connection, item_id: str) -> bool:
    """Delete an item for good, with everything below it and their stored bytes."""
    item = get_item(conn, item_id)
    if item is None:
        return False
    ids = [item.id, *descendant_ids(conn, item.id)]
    marks = ", ".join("?" for _ in ids)
    rows = conn.execute(
        f"SELECT file_ref, thumb_ref, preview_ref FROM library_items WHERE id IN ({marks})", ids).fetchall()
    with write_txn(conn):
        conn.execute(f"DELETE FROM library_items WHERE id IN ({marks})", ids)
        conn.execute(f"DELETE FROM library_fts WHERE item_id IN ({marks})", ids)
    for file_ref, thumb_ref, preview_ref in rows:
        for base, ref in ((library_files_dir(), file_ref), (library_derived_dir("thumbs"), thumb_ref),
                          (library_derived_dir("previews"), preview_ref)):
            if ref:
                (base / ref).unlink(missing_ok=True)
    from hermes_cli import library_versions

    library_versions.purge(conn, ids)
    # Renditions made on demand (an office PDF, a cached preview) are named by the item id.
    previews, exports = library_derived_dir("previews"), library_derived_dir("exports")
    for item_id_ in ids:
        for derived in previews.glob(f"{item_id_}.*"):
            derived.unlink(missing_ok=True)
        shutil.rmtree(exports / item_id_, ignore_errors=True)
    return True


def _unique_title(conn: sqlite3.Connection, title: str, kind: str, parent_id: Optional[str]) -> str:
    """``title``, or ``title (2)`` / ``(3)``… when its container already holds a ``kind`` by that name."""
    taken = {i.title.lower() for i in list_items(conn, kind=kind, parent_id=str(parent_id or ""), limit=5000)}
    candidate, n = title, 2
    while candidate.lower() in taken:
        candidate = f"{title} ({n})"
        n += 1
    return candidate


def copy_items(conn: sqlite3.Connection, item_ids: Iterable[str], parent_id: Optional[str] = None, *,
               in_place: bool = False) -> list[LibraryItem]:
    """Duplicate items with everything below them — into ``parent_id``, or each beside itself when
    ``in_place`` (⌘D). Files copy their bytes; a page's links to its own sub-pages and files follow
    them to the copies. Copies are the user's, private-by-default access kept from the original."""
    copies: list[LibraryItem] = []
    for item_id in item_ids:
        item = get_item(conn, item_id)
        if item is None or item.trashed_at is not None:
            continue
        target = item.parent_id if in_place else _check_parent(conn, parent_id, kind=item.kind)
        copies.append(_copy_tree(conn, item, target, top=True))
    return copies


def _copy_tree(conn: sqlite3.Connection, item: LibraryItem, parent_id: Optional[str], *, top: bool) -> LibraryItem:
    if item.kind == "file":
        name = item.file_name or item.title
        return save_file(conn, file_name=unique_name(conn, name, parent_id) if top else name,
                         source_path=item.path, mime=item.mime, visibility=item.visibility, parent_id=parent_id)
    title = _unique_title(conn, item.title, item.kind, parent_id) if top and item.title else item.title
    if item.kind == "folder":
        copy = create_folder(conn, title=title, parent_id=parent_id, visibility=item.visibility)
    else:
        copy = create_page(conn, title=title, icon=item.icon, content=item.content, markdown=item.markdown,
                           visibility=item.visibility, parent_id=parent_id)
    renamed = {child.id: _copy_tree(conn, child, copy.id, top=False).id
               for child in list_items(conn, parent_id=item.id, limit=5000)}
    if copy.kind == "page" and item.cover:
        # An image cover is usually one of the page's own children: point the copy at its copy.
        cover = item.cover
        for old, new in renamed.items():
            cover = cover.replace(old, new)
        with write_txn(conn):
            conn.execute("UPDATE library_items SET cover = ? WHERE id = ?", (cover, copy.id))
        copy = get_item(conn, copy.id)  # type: ignore[assignment]
    if copy.kind == "page" and renamed:
        content, markdown = copy.content, copy.markdown
        for old, new in renamed.items():
            content = content.replace(old, new) if content else content
            markdown = markdown.replace(old, new)
        with write_txn(conn):
            conn.execute("UPDATE library_items SET content = ?, markdown = ? WHERE id = ?", (content, markdown, copy.id))
        copy = get_item(conn, copy.id)  # type: ignore[assignment]
    return copy


def mark_session(conn: sqlite3.Connection, item_id: str, session_id: Optional[str]) -> None:
    """Remember the conversation Hermes made or changed an item in. Not an edit: ``updated_at`` stays."""
    if not session_id:
        return
    with write_txn(conn):
        conn.execute("UPDATE library_items SET session_id = ? WHERE id = ?", (str(session_id), item_id))


def reconcile_external_edit(conn: sqlite3.Connection, item: LibraryItem) -> Optional[LibraryItem]:
    """A file edited in place by another app (opened from the Library) gets its new size and digest
    and goes back to ``pending``; returns the updated item, or None when nothing changed."""
    if item.kind != "file" or not item.path:
        return None
    try:
        mtime = int(Path(item.path).stat().st_mtime)
    except OSError:
        return None
    if mtime <= item.updated_at:
        return None
    size, digest = file_digest(source_path=item.path)
    with write_txn(conn):
        if digest == item.sha256:
            conn.execute("UPDATE library_items SET updated_at = ? WHERE id = ?", (mtime, item.id))
            return None
        conn.execute("UPDATE library_items SET size = ?, sha256 = ?, status = 'pending', updated_at = ? "
                     "WHERE id = ?", (size, digest, mtime, item.id))
    return get_item(conn, item.id)


def empty_trash(conn: sqlite3.Connection) -> int:
    """Purge every trashed item; returns how many were removed."""
    trashed = list_items(conn, trashed=True, limit=5000)
    return sum(1 for item in trashed if purge_item(conn, item.id))
