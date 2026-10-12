"""Library file processing: what a file becomes after it lands — a thumbnail, a preview rendition for
formats a browser cannot show, metadata, and its text in the search index.

Runs off the request thread (``schedule``), bound to the caller's profile scope, two files at a time.
Every converter is optional and found through ``hermes_platform``: Pillow (images; HEIC with
pillow-heif), the OS's own thumbnailers on macOS (``qlmanage`` for documents and video, ``sips`` for
HEIC), ``pdftoppm`` / ``pdftotext`` / ``ffmpeg`` where installed, LibreOffice for office previews. A
missing converter only means a plainer card; it never fails the item.
"""

from __future__ import annotations

import contextlib
import logging
import re
import shutil
import subprocess
import tempfile
import threading
import zipfile
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree as ET

from hermes_cli import library_db as ldb
from hermes_platform.resolver.core import locate_command
from hermes_platform.resolver.known_dirs import homebrew_dirs, libreoffice_dirs

logger = logging.getLogger(__name__)

THUMB_PX = 640
PREVIEW_PX = 2560
TEXT_BYTES = 2 * 1024 * 1024
_TOOL_TIMEOUT_S = 60
_QUICKLOOK_TIMEOUT_S = 20
_slots = threading.BoundedSemaphore(2)

IMAGE_EXT = {"jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff", "heic", "heif", "avif", "ico"}
# Shown by the browser as they are; anything else in IMAGE_EXT gets a JPEG preview.
BROWSER_IMAGE_EXT = {"jpg", "jpeg", "png", "webp", "gif", "bmp", "avif", "ico", "svg"}
VIDEO_EXT = {"mp4", "mov", "webm", "mkv", "avi", "m4v", "mpeg", "mpg", "wmv", "flv", "3gp"}
# What the window cannot play itself: re-encoded to H.264 MP4 when ffmpeg is installed.
TRANSCODE_EXT = VIDEO_EXT - {"mp4", "mov", "webm", "m4v"}
_TRANSCODE_TIMEOUT_S = 1800
# Pictures worth reading for text; vector and icon formats are not.
OCR_IMAGE_EXT = {"jpg", "jpeg", "png", "webp", "heic", "heif", "tif", "tiff", "bmp", "gif"}
# A PDF with less text than this per file is treated as scanned.
_SCANNED_PDF_CHARS = 40
TEXT_EXT = {"txt", "md", "markdown", "csv", "tsv", "json", "xml", "yaml", "yml", "toml", "html", "htm", "css",
            "scss", "js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "rb", "go", "rs", "java", "kt", "swift", "c",
            "h", "cpp", "cs", "php", "sh", "sql", "log", "svg", "ini", "env"}
OFFICE_EXT = {"doc", "docx", "rtf", "odt", "pages", "xls", "xlsx", "ods", "numbers", "ppt", "pptx", "odp", "key"}
DOCUMENT_TEXT_EXT = {"docx", "xlsx", "ipynb", "pdf", "pptx", "doc", "xls", "odt", "ods", "odp", "rtf", "epub", "ppt"}
# Thumbnailed by Finder's Quick Look: formats we cannot picture ourselves (text and code keep their glyph).
QUICKLOOK_THUMB_EXT = OFFICE_EXT | {"usdz", "obj", "stl", "glb", "gltf", "ttf", "otf", "woff", "woff2", "epub", "psd",
                                    "ai", "eps", "sketch"}


def ext_of(name: Optional[str]) -> str:
    return Path(name or "").suffix.lower().lstrip(".")


def _tool(name: str, *extra_dirs: str) -> Optional[str]:
    found = locate_command(name, known_dirs=(*homebrew_dirs(), *extra_dirs)).command
    return found[0] if found else None


def soffice() -> Optional[str]:
    return _tool("soffice", *libreoffice_dirs()) or _tool("libreoffice")


def _run(args: list[str], timeout: int = _TOOL_TIMEOUT_S) -> bool:
    try:
        return subprocess.run(args, capture_output=True, timeout=timeout, check=False).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def _pillow():
    """Pillow with every opener it can get (HEIF/AVIF via pillow-heif), or None."""
    try:
        from PIL import Image, ImageOps
    except ImportError:
        return None
    with contextlib.suppress(Exception):
        import pillow_heif

        pillow_heif.register_heif_opener()
    return Image, ImageOps


def _save_jpeg(source: Path, target: Path, px: int) -> Optional[tuple[int, int]]:
    """Downscale ``source`` into a JPEG; answers the original size, or None when it cannot be read."""
    pil = _pillow()
    if pil is not None:
        Image, ImageOps = pil
        try:
            with Image.open(source) as img:
                size = img.size
                img = ImageOps.exif_transpose(img)
                img.thumbnail((px, px))
                if img.mode in ("RGBA", "LA", "PA") or "transparency" in img.info:
                    # JPEG has no alpha: transparent areas (Quick Look's page shadows, logos) would turn black.
                    rgba = img.convert("RGBA")
                    img = Image.new("RGB", rgba.size, "white")
                    img.paste(rgba, mask=rgba.getchannel("A"))
                img.convert("RGB").save(target, "JPEG", quality=85)
                return size
        except Exception:
            pass
    sips = _tool("sips")
    if sips and _run([sips, "-s", "format", "jpeg", "-Z", str(px), str(source), "--out", str(target)]):
        return (0, 0)
    return None


def _quicklook(source: Path, target: Path) -> bool:
    """macOS's own thumbnailer: documents, PDFs, video, HEIC — whatever Finder can preview."""
    ql = _tool("qlmanage")
    if not ql:
        return False
    with tempfile.TemporaryDirectory() as out:
        if not _run([ql, "-t", "-s", str(THUMB_PX), "-o", out, str(source)], timeout=_QUICKLOOK_TIMEOUT_S):
            return False
        made = next(Path(out).glob("*.png"), None)
        return bool(made) and _save_jpeg(made, target, THUMB_PX) is not None


def _pdf_thumb(source: Path, target: Path) -> bool:
    tool = _tool("pdftoppm")
    if not tool:
        return False
    with tempfile.TemporaryDirectory() as out:
        stem = Path(out) / "page"
        if not _run([tool, "-f", "1", "-l", "1", "-scale-to", str(THUMB_PX), "-png", str(source), str(stem)]):
            return False
        made = next(Path(out).glob("page*.png"), None)
        return bool(made) and _save_jpeg(made, target, THUMB_PX) is not None


def _video_thumb(source: Path, target: Path) -> bool:
    tool = _tool("ffmpeg")
    return bool(tool) and _run([tool, "-y", "-loglevel", "error", "-ss", "1", "-i", str(source), "-frames:v", "1",
                                "-vf", f"scale={THUMB_PX}:-2", str(target)])


def pdf_page_count(path: Path) -> Optional[int]:
    with contextlib.suppress(OSError):
        data = path.read_bytes()[:64 * 1024 * 1024]
        count = len(re.findall(rb"/Type\s*/Page(?!s)", data))
        return count or None
    return None


def pptx_text(path: Path) -> str:
    """Slide text in order, one block per slide — enough to search and to outline a deck."""
    out: list[str] = []
    with zipfile.ZipFile(path) as zf:
        slides = sorted((n for n in zf.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
                        key=lambda n: int(re.findall(r"\d+", n)[0]))
        for index, name in enumerate(slides, 1):
            data = zf.read(name)
            # OOXML parts never declare a DTD; one that does is an entity trick, not a slide.
            if b"<!DOCTYPE" in data[:4096].upper() or b"<!ENTITY" in data.upper():
                continue
            root = ET.fromstring(data)
            texts = [t.text for t in root.iter() if t.tag.endswith("}t") and t.text]
            out.append(f"Slide {index}\n" + "\n".join(texts))
    return "\n\n".join(out)


def extract_text(path: Path, ext: str) -> str:
    """The text search indexes for a file ('' when there is none to read)."""
    if ext in TEXT_EXT:
        text = path.read_bytes()[:TEXT_BYTES].decode("utf-8", errors="replace")
        return re.sub(r"<[^>]+>", " ", text) if ext in {"html", "htm", "svg", "xml"} else text
    if ext == "pptx":
        with contextlib.suppress(Exception):
            return pptx_text(path)
    if ext in DOCUMENT_TEXT_EXT:
        with contextlib.suppress(Exception):
            from tools.read_extract import extract_document_text

            return extract_document_text(str(path))
        if ext == "pdf" and (tool := _tool("pdftotext")):
            with tempfile.TemporaryDirectory() as out:
                target = Path(out) / "text.txt"
                if _run([tool, "-q", str(path), str(target)]):
                    return target.read_text("utf-8", errors="replace")
    return ""


def process_item(item_id: str) -> None:
    """Thumbnail, preview, metadata and search text for one file item."""
    with ldb.connect_closing() as conn:
        item = ldb.get_item(conn, item_id)
        if item is None or item.kind != "file" or not item.path:
            return
        source = Path(item.path)
        ext = ext_of(item.file_name)
        thumbs, previews = ldb.library_derived_dir("thumbs"), ldb.library_derived_dir("previews")
        thumbs.mkdir(parents=True, exist_ok=True)
        previews.mkdir(parents=True, exist_ok=True)
        thumb = thumbs / f"{item.id}.jpg"
        meta: dict = {}
        thumb_ok = preview_ref = None
        try:
            if ext in IMAGE_EXT:
                size = _save_jpeg(source, thumb, THUMB_PX)
                thumb_ok = size is not None
                if size and size[0]:
                    meta.update(width=size[0], height=size[1])
                if ext not in BROWSER_IMAGE_EXT and _save_jpeg(source, previews / f"{item.id}.jpg", PREVIEW_PX):
                    preview_ref = f"{item.id}.jpg"
            elif ext == "pdf":
                meta["pages"] = pdf_page_count(source)
                thumb_ok = _pdf_thumb(source, thumb) or _quicklook(source, thumb)
            elif ext in VIDEO_EXT:
                thumb_ok = _video_thumb(source, thumb) or _quicklook(source, thumb)
            elif ext in QUICKLOOK_THUMB_EXT:
                thumb_ok = _quicklook(source, thumb)
            text = extract_text(source, ext)
            if ext in OCR_IMAGE_EXT or (ext == "pdf" and len(text.strip()) < _SCANNED_PDF_CHARS):
                from hermes_cli import library_ocr

                seen = library_ocr.recognize(source)
                if seen:
                    meta["ocr"] = True
                    text = f"{text}\n{seen}".strip()
            if text:
                meta["chars"] = len(text)
            ldb.index_text(conn, item.id, title=item.title, body=f"{item.file_name or ''}\n{text}")
            ldb.set_processed(conn, item.id, status="ready", meta=meta,
                              thumb_ref=f"{item.id}.jpg" if thumb_ok else None, preview_ref=preview_ref)
        except Exception:
            logger.debug("library: processing %s failed", item.id, exc_info=True)
            ldb.set_processed(conn, item.id, status="failed", meta=meta)
            return
        # Make the viewer's slow part now (an office rendition, a sheet), so opening the file is instant.
        from hermes_cli import library_preview

        try:
            if ext in TRANSCODE_EXT:
                video_rendition(item)
            elif ext in library_preview.CACHED_EXT:
                library_preview.preview(item)
        except Exception:
            logger.debug("library: preview for %s failed", item.id, exc_info=True)


def _guarded(item_id: str) -> None:
    with _slots:
        process_item(item_id)


def schedule(item_ids) -> None:
    """Process files in the background under the caller's profile scope."""
    from agent.memory_provider import spawn_context_thread

    for item_id in dict.fromkeys(item_ids):
        spawn_context_thread(_guarded, name=f"library-process-{item_id}", args=(item_id,)).start()


def ffmpeg() -> Optional[str]:
    return _tool("ffmpeg")


def video_rendition(item: ldb.LibraryItem, *, make: bool = True) -> Optional[Path]:
    """A playable MP4 of a video the window cannot play (ffmpeg), cached until the file changes."""
    if not item.path:
        return None
    source = Path(item.path)
    target = ldb.library_derived_dir("previews") / f"{item.id}.mp4"
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return target
    tool = ffmpeg()
    if not make or not tool:
        return None
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(".part.mp4")
    if not _run([tool, "-y", "-loglevel", "error", "-i", str(source), "-c:v", "libx264", "-preset", "veryfast",
                 "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", str(partial)],
                timeout=_TRANSCODE_TIMEOUT_S):
        partial.unlink(missing_ok=True)
        return None
    partial.replace(target)
    return target


def office_pdf(item: ldb.LibraryItem) -> Optional[Path]:
    """A PDF rendition of an office document (LibreOffice), cached until the file changes."""
    tool = soffice()
    if not tool or not item.path:
        return None
    source = Path(item.path)
    target = ldb.library_derived_dir("previews") / f"{item.id}.pdf"
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    profile = ldb.library_derived_dir("previews") / ".lo-profile"
    with tempfile.TemporaryDirectory() as out:
        ok = _run([tool, f"-env:UserInstallation={profile.resolve().as_uri()}", "--headless", "--convert-to", "pdf",
                   "--outdir", out, str(source)], timeout=120)
        made = next(Path(out).glob("*.pdf"), None)
        if not ok or made is None:
            return None
        shutil.move(str(made), target)
    return target
