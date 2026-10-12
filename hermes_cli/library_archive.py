"""Archives in the Library: what is inside one (ZIP, the tar family, and — through the OS's libarchive
``bsdtar`` — 7z, RAR, ISO), and extracting one into a folder beside it.

Extraction never trusts the archive: tar members go through the ``data`` filter (no absolute paths,
no ``..``, no links out, no devices), ZIP names are normalized by ``zipfile``, ``bsdtar`` refuses the
same by default, and the declared total size and entry count are checked first against a ceiling so
an archive bomb is refused before a byte is written.
"""

from __future__ import annotations

import bz2
import gzip
import lzma
import re
import subprocess
import tarfile
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

from hermes_cli import library_db as ldb
from hermes_cli import library_processing as lp

MAX_ENTRIES = 2000
MAX_EXTRACT_BYTES = 4 * 1024 * 1024 * 1024
MAX_EXTRACT_FILES = 5000
TAR_EXT = {"tar", "tgz", "tbz2", "txz"}
# Read through libarchive.
BSDTAR_EXT = {"7z", "rar", "iso"}
# A ``.gz`` / ``.bz2`` / ``.xz`` holds a tarball, or else one compressed file.
_SINGLE = {"gz": gzip.open, "bz2": bz2.open, "xz": lzma.open}
ARCHIVE_EXT = {"zip"} | TAR_EXT | BSDTAR_EXT | set(_SINGLE)
_EXTRACT_TIMEOUT_S = 600
# `bsdtar -tv` rows: mode, links, owner, group, size, month, day, time|year, name.
_BSDTAR_ROW = re.compile(r"^(\S)\S*\s+\d+\s+\S+\s+\S+\s+(\d+)\s+\S+\s+\d+\s+\S+\s+(.+)$")


def _bsdtar() -> Optional[str]:
    return lp._tool("bsdtar")


def _is_tar(path: Path, ext: str) -> bool:
    return ext in TAR_EXT or (ext in _SINGLE and tarfile.is_tarfile(path))


def _single_name(path: Path) -> str:
    return path.stem or "file"


def _entries(path: Path, ext: str) -> list[dict]:
    if ext == "zip":
        with zipfile.ZipFile(path) as zf:
            return [{"name": i.filename, "size": i.file_size, "dir": i.is_dir()} for i in zf.infolist()]
    if _is_tar(path, ext):
        with tarfile.open(path) as tf:
            return [{"name": m.name + ("/" if m.isdir() else ""), "size": m.size, "dir": m.isdir()}
                    for m in tf.getmembers() if m.isfile() or m.isdir()]
    if ext in _SINGLE:
        return [{"name": _single_name(path), "size": 0, "dir": False}]
    tool = _bsdtar()
    if not tool:
        return []
    listing = subprocess.run([tool, "-tvf", str(path)], capture_output=True, text=True, timeout=lp._TOOL_TIMEOUT_S,
                             check=False)
    rows = []
    for line in listing.stdout.splitlines():
        match = _BSDTAR_ROW.match(line)
        if match:
            kind, size, name = match.groups()
            rows.append({"name": name, "size": int(size), "dir": kind == "d" or name.endswith("/")})
    return rows


def preview(path: Path, ext: str) -> dict:
    """The viewer's listing of an archive's entries."""
    entries = _entries(path, ext)
    return {"type": "archive", "entries": entries[:MAX_ENTRIES], "truncated": len(entries) > MAX_ENTRIES}


def _unpack(path: Path, ext: str, into: Path) -> None:
    if ext == "zip":
        with zipfile.ZipFile(path) as zf:
            zf.extractall(into)
    elif _is_tar(path, ext):
        with tarfile.open(path) as tf:
            try:
                tf.extractall(into, filter="data")
            except tarfile.FilterError as refused:
                raise ValueError("this archive holds unsafe paths and was not extracted") from refused
    elif ext in _SINGLE:
        with _SINGLE[ext](path, "rb") as packed, (into / _single_name(path)).open("wb") as out:
            # Copied in blocks with a ceiling: the declared size of a compressed stream means nothing.
            written = 0
            while block := packed.read(1024 * 1024):
                written += len(block)
                if written > MAX_EXTRACT_BYTES:
                    raise ValueError("this archive is too large to extract here")
                out.write(block)
    else:
        tool = _bsdtar()
        if not tool or not lp._run([tool, "-xf", str(path), "-C", str(into)], timeout=_EXTRACT_TIMEOUT_S):
            raise ValueError("this archive could not be extracted")


def extract(conn, item: ldb.LibraryItem) -> dict:
    """Unpack an archive into a new folder beside it, named after it (``import_folder``'s result)."""
    ext = lp.ext_of(item.file_name)
    if item.kind != "file" or not item.path or ext not in ARCHIVE_EXT:
        raise ValueError("only archives can be extracted")
    source = Path(item.path)
    entries = _entries(source, ext)
    files = [e for e in entries if not e["dir"]]
    if len(files) > MAX_EXTRACT_FILES or sum(e["size"] for e in files) > MAX_EXTRACT_BYTES:
        raise ValueError("this archive is too large to extract here")
    stem = Path(item.file_name or item.title).name
    for suffix in (".tar.gz", ".tar.bz2", ".tar.xz", f".{ext}"):
        if stem.lower().endswith(suffix) and len(stem) > len(suffix):
            stem = stem[: -len(suffix)]
            break
    with tempfile.TemporaryDirectory() as scratch:
        root = Path(scratch) / (stem or "Archive")
        root.mkdir()
        _unpack(source, ext, root)
        return ldb.import_folder(conn, str(root), parent_id=item.parent_id, visibility=item.visibility,
                                 max_files=MAX_EXTRACT_FILES)
