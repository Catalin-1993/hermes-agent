"""Readers for formats the Library shows from their parts: an email (.eml) as its headers, body and
attachments; an ePub as one self-contained HTML document in reading order; a Jupyter notebook as
its cells with their outputs. Everything is capped, and nothing they contain may reach the network
or run: HTML ends up in the viewer's sealed frame, and notebook output HTML is never rendered.
"""

from __future__ import annotations

import base64
import email
import json
import mimetypes
import posixpath
import re
import zipfile
from email import policy
from pathlib import Path
from xml.etree import ElementTree

MAX_EMAIL_BYTES = 32 * 1024 * 1024
MAX_INLINE_BYTES = 20 * 1024 * 1024
MAX_CELLS = 500
MAX_OUTPUT_CHARS = 20_000
_BODY = re.compile(r"<body[^>]*>(.*)</body>", re.DOTALL | re.IGNORECASE)
_SCRIPT = re.compile(r"<script\b.*?</script>|<script\b[^>]*/>", re.DOTALL | re.IGNORECASE)
_SRC = re.compile(r'(src|xlink:href|href)="([^"#:]+)"', re.IGNORECASE)
_CID = re.compile(r'src="cid:([^"]+)"', re.IGNORECASE)
_READER_CSS = (
    "body{font:17px/1.65 Georgia,'Iowan Old Style',serif;color:#1f1f1f;max-width:42em;margin:2.5em auto;"
    "padding:0 1.5em}img,svg{max-width:100%;height:auto}section+section{margin-top:3em;border-top:1px solid"
    " #e5e5e5;padding-top:2em}a{color:inherit}"
)


def _xml(data: bytes) -> ElementTree.Element | None:
    """Parse package XML, refusing any DTD — entity expansion (and so XXE / billion laughs) needs one,
    and it has no business in an ePub's container or manifest."""
    if b"<!DOCTYPE" in data or b"<!ENTITY" in data:
        return None
    try:
        return ElementTree.fromstring(data)
    except ElementTree.ParseError:
        return None


def _data_uri(data: bytes, name: str, mime: str | None = None) -> str:
    kind = mime or mimetypes.guess_type(name)[0] or "application/octet-stream"
    return f"data:{kind};base64,{base64.b64encode(data).decode()}"


def email_preview(path: Path) -> dict:
    with path.open("rb") as handle:
        message = email.message_from_bytes(handle.read(MAX_EMAIL_BYTES), policy=policy.default)
    body = message.get_body(preferencelist=("html", "plain"))
    html = text = None
    if body is not None:
        content = body.get_content()
        if body.get_content_type() == "text/html":
            # Pictures sent inside the mail (cid:) are inlined; remote ones stay blocked by the frame.
            parts = {str(p.get("Content-ID", "")).strip("<>"): p for p in message.walk() if p.get("Content-ID")}

            def inline(match: re.Match) -> str:
                part = parts.get(match.group(1))
                data = part.get_payload(decode=True) if part is not None else None
                if not data:
                    return match.group(0)
                return f'src="{_data_uri(data, part.get_filename() or "", part.get_content_type())}"'

            # Remote pictures (often tracking pixels) stay blocked by the frame; hide their broken boxes.
            html = '<style>img[src^="http"]{display:none}</style>' + _CID.sub(inline, content)
        else:
            text = content
    attachments = [{"name": part.get_filename() or "attachment", "size": len(part.get_payload(decode=True) or b""),
                    "dir": False} for part in message.iter_attachments()]
    return {
        "type": "email",
        "email": {key: str(message.get(header, "")) for key, header in
                  (("subject", "Subject"), ("sender", "From"), ("to", "To"), ("cc", "Cc"), ("date", "Date"))},
        "html": html,
        "text": text,
        "entries": attachments,
    }


def epub_preview(path: Path) -> dict | None:
    """The book's chapters in spine order as one HTML document, its pictures inlined."""
    with zipfile.ZipFile(path) as book:
        names = set(book.namelist())
        container = _xml(book.read("META-INF/container.xml")) if "META-INF/container.xml" in names else None
        rootfile = next((el.get("full-path") for el in container.iter() if el.tag.endswith("rootfile")), None) \
            if container is not None else None
        opf = _xml(book.read(rootfile)) if rootfile in names else None
        if opf is None:
            return None
        base = posixpath.dirname(rootfile)
        manifest = {el.get("id"): el.get("href") for el in opf.iter() if el.tag.endswith("item")}
        spine = [manifest.get(el.get("idref")) for el in opf.iter() if el.tag.endswith("itemref")]
        budget = MAX_INLINE_BYTES
        sections = []
        for href in filter(None, spine):
            chapter = posixpath.normpath(posixpath.join(base, href))
            if chapter not in names:
                continue
            markup = book.read(chapter).decode("utf-8", errors="replace")
            body = _SCRIPT.sub("", (_BODY.search(markup) or [None, markup])[1])
            folder = posixpath.dirname(chapter)

            def inline(match: re.Match) -> str:
                nonlocal budget
                target = posixpath.normpath(posixpath.join(folder, match.group(2)))
                if match.group(1).lower() == "href" or target not in names:
                    return match.group(0)
                data = book.read(target)
                if len(data) > budget:
                    return match.group(0)
                budget -= len(data)
                return f'{match.group(1)}="{_data_uri(data, target)}"'

            sections.append(f"<section>{_SRC.sub(inline, body)}</section>")
    if not sections:
        return None
    return {"type": "html", "html": f"<!doctype html><html><head><meta charset=\"utf-8\"><style>{_READER_CSS}"
                                    f"</style></head><body>{''.join(sections)}</body></html>"}


def _text(value) -> str:
    return "".join(value) if isinstance(value, list) else str(value or "")


def notebook_preview(path: Path) -> dict:
    """Cells in order — Markdown, code with its language, and outputs as text or pictures."""
    notebook = json.loads(path.read_text(encoding="utf-8-sig", errors="replace"))
    language = ((notebook.get("metadata") or {}).get("kernelspec") or {}).get("language") or "python"
    budget = MAX_INLINE_BYTES
    cells = []
    for cell in (notebook.get("cells") or [])[:MAX_CELLS]:
        outputs = []
        for output in cell.get("outputs") or []:
            data = output.get("data") or {}
            picture = next((m for m in ("image/png", "image/jpeg", "image/gif") if m in data), None)
            if picture and len(_text(data[picture])) <= budget:
                budget -= len(_text(data[picture]))
                outputs.append({"image": f"data:{picture};base64,{_text(data[picture]).strip()}"})
            elif output.get("output_type") == "stream" or "text/plain" in data:
                outputs.append({"text": _text(output.get("text") or data.get("text/plain"))[:MAX_OUTPUT_CHARS]})
            elif output.get("output_type") == "error":
                trace = "\n".join(output.get("traceback") or [])
                outputs.append({"text": re.sub(r"\x1b\[[0-9;]*m", "", trace)[:MAX_OUTPUT_CHARS]})
        cells.append({"kind": cell.get("cell_type") or "raw", "source": _text(cell.get("source")), "outputs": outputs})
    return {"type": "notebook", "cells": cells, "language": language,
            "truncated": len(notebook.get("cells") or []) > MAX_CELLS}
