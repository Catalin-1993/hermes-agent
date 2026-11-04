"""The "About you" page: a window onto Brain's real memory (``MEMORY.md`` and ``USER.md``).

Memory is the one place where the notebook is not a copy. Each line on the page is one memory entry, so
what the owner changes or deletes there is changed or forgotten in the memory itself — otherwise Brain
would go on believing the mistake the owner just corrected.
"""

from __future__ import annotations

import difflib
import logging
import re
import sqlite3
from typing import Optional

from hermes_cli import library_db as ldb
from hermes_cli import library_notebook as nb
from hermes_cli.library_notebook_text import LABELS, labels

logger = logging.getLogger(__name__)

# How alike two lines must be for an edited line to count as the same memory entry, rather than a new one.
_SAME_ENTRY = 0.55


def _flat(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _lines_under(markdown: str, heading: str) -> list[str]:
    """The bullet lines of the section called ``heading`` (italic "nothing yet" notes are not entries)."""
    found, inside = [], False
    for line in (markdown or "").splitlines():
        if line.startswith("## "):
            inside = line[3:].strip() == heading
        elif inside and line.lstrip().startswith("- "):
            found.append(_flat(line.lstrip()[2:]))
    return [text for text in found if text and not (text.startswith("_") and text.endswith("_"))]


def _page_lines(markdown: str) -> tuple[list[str], list[str]]:
    """``(user lines, memory lines)`` — the headings are read in every language the notebook speaks."""
    user = next((r for lang in LABELS.values() for r in [_lines_under(markdown, lang["about_user"])] if r), [])
    memory = next((r for lang in LABELS.values() for r in [_lines_under(markdown, lang["about_memory"])] if r), [])
    return user, memory


def _apply(store, target: str, entries: list[str], lines: list[str]) -> None:
    """Make ``entries`` read as ``lines``: unchanged ones stay, an edited one is replaced, a new line is
    added, a missing one is removed."""
    flat = {_flat(e): e for e in entries}
    wanted = list(dict.fromkeys(lines))
    gone = [e for key, e in flat.items() if key not in wanted]
    fresh = [line for line in wanted if line not in flat]
    for line in list(fresh):
        close = max(gone, key=lambda e: difflib.SequenceMatcher(None, _flat(e), line).ratio(), default=None)
        if close is not None and difflib.SequenceMatcher(None, _flat(close), line).ratio() >= _SAME_ENTRY:
            result = store.replace(target, close, line)
            gone.remove(close)
            fresh.remove(line)
            if not result.get("success"):
                logger.info("notebook: memory %s edit refused: %s", target, result.get("error"))
    for entry in gone:
        result = store.remove(target, entry)
        if not result.get("success"):
            logger.info("notebook: memory %s removal refused: %s", target, result.get("error"))
    for line in fresh:
        result = store.add(target, line)
        if not result.get("success"):
            logger.info("notebook: memory %s addition refused: %s", target, result.get("error"))


def push_page_to_memory(conn: sqlite3.Connection, item: ldb.LibraryItem) -> None:
    """The owner saved "About you": write the page's lines into the memory files."""
    from tools.memory_tool import load_on_disk_store

    store = load_on_disk_store()
    user, memory = _page_lines(item.markdown)
    if store.target_enabled("user"):
        _apply(store, "user", list(store.user_entries), user)
    if store.target_enabled("memory"):
        _apply(store, "memory", list(store.memory_entries), memory)


def refresh(conn: sqlite3.Connection) -> Optional[ldb.LibraryItem]:
    """Bring the page up to date with the memory files (after taking in any edit the owner made to it)."""
    from tools.memory_tool import load_on_disk_store

    row = nb._row(conn, "about")
    item = nb._live_item(conn, row)
    edited = item is not None and row is not None and nb._norm_hash(item.markdown) != row["agent_hash"]
    if edited:
        push_page_to_memory(conn, item)
        # This page is never frozen: it is the memory, drawn again from the memory right below.
        nb._save_row(conn, "about", item.id, "about", row["title"] or "", nb.state_of(conn, "about"),
                     item.markdown, False)
    store = load_on_disk_store()
    state = {"user": [_flat(e) for e in store.user_entries], "memory": [_flat(e) for e in store.memory_entries]}
    if item is not None and not edited and nb.state_of(conn, "about") == state:
        return item
    L = labels(nb.language(conn))
    return nb.upsert_page(conn, key="about", kind="about", title=L["about"], state=state, parent=None, icon="🙂")
