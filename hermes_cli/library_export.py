"""Library items as paths a chat can attach. Stored files carry internal names (``fl_….pdf``), so
an item goes out under the name the user knows: a file's bytes hard-linked (copied across
volumes) under its file name, a page written out as ``<title>.md``. Kept per item and refreshed
whenever the source is newer.
"""

from __future__ import annotations

import os
import re
import shutil
from pathlib import Path

from hermes_cli import library_db as ldb

_UNSAFE = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def _safe(name: str, fallback: str) -> str:
    cleaned = _UNSAFE.sub("_", name).strip().strip(".")
    return cleaned[:120] or fallback


def export_path(item: ldb.LibraryItem) -> Path:
    """Where ``item`` can be attached from, under its own name."""
    folder = ldb.library_derived_dir("exports") / item.id
    folder.mkdir(parents=True, exist_ok=True)
    if item.kind == "file" and item.path:
        source = Path(item.path)
        target = folder / _safe(item.file_name or item.title, source.name)
        if not target.exists() or target.stat().st_mtime < source.stat().st_mtime:
            target.unlink(missing_ok=True)
            try:
                os.link(source, target)
            except OSError:
                shutil.copyfile(source, target)
    elif item.kind == "page":
        title = item.title or "Untitled"
        target = folder / f"{_safe(title, 'Untitled')}.md"
        target.write_text(f"# {title}\n\n{item.markdown}".rstrip() + "\n", encoding="utf-8")
    else:
        raise ValueError("only files and pages can be attached")
    for stale in folder.iterdir():
        if stale != target:
            stale.unlink(missing_ok=True)
    return target
