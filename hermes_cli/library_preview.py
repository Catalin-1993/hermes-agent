"""What the Library viewer needs to show a file the browser cannot render by itself: a spreadsheet as
rows, an archive as its entries, source text, an office document as a PDF (LibreOffice), as the HTML
macOS Quick Look makes of it, or — with neither — its text, and the JPEG rendition processing made
for HEIC-like images. Formats the renderer shows natively (images, PDF, media, DOCX) answer
``native``. The slow kinds are cached beside the renditions until the file changes, and processing
warms that cache when a file arrives, so opening one does not wait on a converter.
"""

from __future__ import annotations

import base64
import csv
import io
import json
import mimetypes
import re
import tempfile
from pathlib import Path

from hermes_cli import library_archive as archive
from hermes_cli import library_db as ldb
from hermes_cli import library_formats as formats
from hermes_cli import library_processing as lp

MAX_ROWS = 1000
MAX_COLS = 60
# Quick Look's HTML with its stylesheets and images inlined; past this the text fallback is kinder.
MAX_HTML_BYTES = 24 * 1024 * 1024
CACHED_EXT = {"csv", "tsv", "xlsx", "eml", "epub", "ipynb"} | archive.ARCHIVE_EXT | lp.OFFICE_EXT
_ATTACHMENT_REF = re.compile(r'(href|src)="([^"/:]+)"')
NATIVE_EXT = lp.BROWSER_IMAGE_EXT | (lp.VIDEO_EXT - lp.TRANSCODE_EXT) | {
    "pdf", "docx", "mp3", "wav", "m4a", "aac", "flac", "ogg", "oga", "opus", "aiff", "ttf", "otf", "woff", "woff2"}


def _clip_rows(rows: list[list[str]]) -> tuple[list[list[str]], bool]:
    clipped = len(rows) > MAX_ROWS or any(len(r) > MAX_COLS for r in rows[:MAX_ROWS])
    return [r[:MAX_COLS] for r in rows[:MAX_ROWS]], clipped


def _csv_sheet(path: Path, ext: str) -> dict:
    text = path.read_bytes()[: lp.TEXT_BYTES].decode("utf-8-sig", errors="replace")
    delimiter = "\t" if ext == "tsv" else ","
    if ext != "tsv":
        try:
            delimiter = csv.Sniffer().sniff(text[:8192], delimiters=",;\t|").delimiter
        except csv.Error:
            pass
    rows, clipped = _clip_rows(list(csv.reader(io.StringIO(text), delimiter=delimiter)))
    return {"type": "sheet", "sheets": [{"name": path.stem, "rows": rows}], "truncated": clipped}


def _xlsx_sheets(path: Path) -> dict:
    from tools.read_extract import extract_document_text

    sheets: list[dict] = []
    clipped = False
    for line in extract_document_text(str(path)).splitlines():
        if line.startswith("# ── Sheet: "):
            sheets.append({"name": line.removeprefix("# ── Sheet: ").rstrip(" ─"), "rows": []})
        elif sheets and line != "(empty)":
            sheets[-1]["rows"].append(line.split("\t"))
    for sheet in sheets:
        while sheet["rows"] and not any(c.strip() for c in sheet["rows"][-1]):
            sheet["rows"].pop()
        sheet["rows"], cut = _clip_rows(sheet["rows"])
        clipped = clipped or cut
    return {"type": "sheet", "sheets": sheets, "truncated": clipped}


def _quicklook_preview(path: Path, item_id: str) -> dict | None:
    """macOS's own document preview (Pages, Word, Excel, Keynote… whatever Finder can show): a PDF
    is kept as the item's rendition, HTML comes back with its attachments inlined."""
    ql = lp._tool("qlmanage")
    if not ql:
        return None
    with tempfile.TemporaryDirectory() as out:
        if not lp._run([ql, "-p", "-o", out, str(path)], timeout=lp._QUICKLOOK_TIMEOUT_S):
            return None
        bundle = next(Path(out).glob("*.qlpreview"), None)
        if bundle is None:
            return None
        pdf = bundle / "Preview.pdf"
        if pdf.exists():
            target = rendition_pdf(item_id)
            target.parent.mkdir(parents=True, exist_ok=True)
            pdf.replace(target)
            return {"type": "pdf"}
        page = bundle / "Preview.html"
        if not page.exists():
            return None
        html = page.read_text(encoding="utf-8-sig", errors="replace")

        def inline(match: re.Match) -> str:
            attachment = bundle / match.group(2)
            if not attachment.is_file():
                return match.group(0)
            mime = mimetypes.guess_type(attachment.name)[0] or "application/octet-stream"
            data = base64.b64encode(attachment.read_bytes()).decode()
            return f'{match.group(1)}="data:{mime};base64,{data}"'

        html = _ATTACHMENT_REF.sub(inline, html)
    if len(html.encode()) > MAX_HTML_BYTES:
        return None
    return {"type": "html", "html": html}


def rendition_pdf(item_id: str) -> Path:
    """Where an office document's PDF rendition lives (LibreOffice's or Quick Look's)."""
    return ldb.library_derived_dir("previews") / f"{item_id}.pdf"


def rendition_path(item: ldb.LibraryItem) -> Path | None:
    """The derived file a viewer reads instead of the original: the JPEG of a HEIC-like image, or an
    office document's PDF."""
    for candidate in (Path(item.preview) if item.preview else None, rendition_pdf(item.id)):
        if candidate is not None and candidate.exists():
            return candidate
    return None


def _office(item: ldb.LibraryItem, path: Path, ext: str) -> dict:
    if lp.office_pdf(item) is not None:
        return {"type": "pdf"}
    quicklook = _quicklook_preview(path, item.id)
    if quicklook is not None:
        return quicklook
    text = lp.extract_text(path, ext)
    if text.strip():
        return {"type": "text", "text": text[: lp.TEXT_BYTES], "truncated": False, "converter_missing": True,
                "converter": "libreoffice"}
    return {"type": "none", "converter_missing": True, "converter": "libreoffice"}


def _epub(path: Path) -> dict:
    book = formats.epub_preview(path)
    return book or {"type": "text", "text": lp.extract_text(path, "epub")[: lp.TEXT_BYTES], "truncated": False}


# Formats read from their parts, by extension; archives and office documents have their own paths.
_BUILDERS = {
    "csv": lambda path: _csv_sheet(path, "csv"),
    "tsv": lambda path: _csv_sheet(path, "tsv"),
    "xlsx": _xlsx_sheets,
    "eml": formats.email_preview,
    "epub": _epub,
    "ipynb": formats.notebook_preview,
}


def _build(item: ldb.LibraryItem, path: Path, ext: str) -> dict:
    if ext in archive.ARCHIVE_EXT:
        return archive.preview(path, ext)
    builder = _BUILDERS.get(ext)
    return builder(path) if builder else _office(item, path, ext)


def _video(item: ldb.LibraryItem) -> dict:
    """A video the window cannot play: its MP4 rendition (made now if processing has not yet)."""
    rendition = lp.video_rendition(item)
    if rendition is not None:
        return {"type": "video", "path": str(rendition)}
    return {"type": "none", "converter_missing": lp.ffmpeg() is None, "converter": "ffmpeg"}


def _cached(item: ldb.LibraryItem, path: Path, ext: str) -> dict:
    """``_build``, kept as JSON until the file changes. A missing converter is not cached: installing
    LibreOffice must take effect on the next open."""
    cache = ldb.library_derived_dir("previews") / f"{item.id}.json"
    if cache.exists() and cache.stat().st_mtime >= path.stat().st_mtime:
        try:
            cached = json.loads(cache.read_text(encoding="utf-8-sig"))
            if cached.get("type") != "pdf" or rendition_pdf(item.id).exists():
                return cached
        except (OSError, ValueError):
            pass
    built = _build(item, path, ext)
    if not built.get("converter_missing"):
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(built), encoding="utf-8")
    return built


def preview(item: ldb.LibraryItem) -> dict:
    """The viewer's payload for a file item (see the module docstring)."""
    if item.kind != "file" or not item.path:
        return {"type": "none"}
    path = Path(item.path)
    ext = lp.ext_of(item.file_name)
    if item.preview and Path(item.preview).exists():
        return {"type": "image", "path": item.preview}
    if ext in NATIVE_EXT:
        return {"type": "native"}
    if ext in lp.TRANSCODE_EXT:
        return _video(item)
    if ext in CACHED_EXT:
        return _cached(item, path, ext)
    if ext in lp.TEXT_EXT:
        with path.open("rb") as handle:
            data = handle.read(lp.TEXT_BYTES + 1)
        return {"type": "text", "text": data[: lp.TEXT_BYTES].decode("utf-8", errors="replace"),
                "truncated": len(data) > lp.TEXT_BYTES}
    return {"type": "none"}
