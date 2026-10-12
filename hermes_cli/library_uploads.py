"""Staged Library uploads: a file that cannot be copied by path (a remote backend, a browser-only
file) crosses the socket in chunks into ``$HERMES_HOME/library/uploads/<id>.part`` and becomes a
Library item on ``finish``. The part file's length IS the progress, so a retried chunk is idempotent
and no state lives in process memory (one backend may serve several profiles). Parts nobody
finished are swept after a day.
"""

from __future__ import annotations

import json
import re
import secrets
import time
from pathlib import Path

from hermes_cli.library_db import MAX_FILE_BYTES
from hermes_constants import get_hermes_home

_UPLOAD_ID = re.compile(r"^[0-9a-f]{24}$")
_STALE_AFTER_S = 24 * 3600


def uploads_dir() -> Path:
    return get_hermes_home() / "library" / "uploads"


def _paths(upload_id: str) -> tuple[Path, Path]:
    if not _UPLOAD_ID.match(str(upload_id or "")):
        raise ValueError("unknown upload")
    base = uploads_dir() / upload_id
    return base.with_suffix(".part"), base.with_suffix(".json")


def _meta(upload_id: str) -> dict:
    part, meta = _paths(upload_id)
    if not part.exists() or not meta.exists():
        raise ValueError("unknown upload")
    return json.loads(meta.read_text(encoding="utf-8-sig"))


def _sweep_stale() -> None:
    cutoff = time.time() - _STALE_AFTER_S
    for path in uploads_dir().glob("*.*"):
        if path.stat().st_mtime < cutoff:
            path.unlink(missing_ok=True)


def begin(*, file_name: str, size: int, mime: str | None = None) -> dict:
    """Open a staged upload of ``size`` bytes; answers its id and the offset to send from (0)."""
    if size < 0 or size > MAX_FILE_BYTES:
        raise ValueError(f"file is larger than {MAX_FILE_BYTES // (1024 * 1024)} MB")
    uploads_dir().mkdir(parents=True, exist_ok=True)
    _sweep_stale()
    upload_id = secrets.token_hex(12)
    part, meta = _paths(upload_id)
    part.write_bytes(b"")
    meta.write_text(json.dumps({"file_name": file_name, "size": int(size), "mime": mime}), encoding="utf-8")
    return {"upload_id": upload_id, "offset": 0}


def append(upload_id: str, *, offset: int, data: bytes) -> int:
    """Write a chunk at ``offset``; answers the new offset. A chunk already received (a retry after
    a lost answer) is accepted without writing twice."""
    expected = int(_meta(upload_id)["size"])
    part, _ = _paths(upload_id)
    have = part.stat().st_size
    if offset + len(data) <= have:
        return have
    if offset != have:
        raise ValueError(f"upload is at byte {have}, not {offset}")
    if have + len(data) > expected:
        raise ValueError("chunk runs past the declared size")
    with open(part, "ab") as fh:
        fh.write(data)
    return have + len(data)


def staged(upload_id: str) -> tuple[Path, dict]:
    """The complete part file and its metadata, ready to be saved as a Library item."""
    meta = _meta(upload_id)
    part, _ = _paths(upload_id)
    if part.stat().st_size != int(meta["size"]):
        raise ValueError("upload is incomplete")
    return part, meta


def abort(upload_id: str) -> None:
    """Drop a staged upload (cancelled, or consumed by ``finish``)."""
    for path in _paths(upload_id):
        path.unlink(missing_ok=True)
