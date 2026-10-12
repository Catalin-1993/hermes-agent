#!/usr/bin/env python3
"""Library tool — the agent's handle on the owner's Library (per-profile Notion-style pages and saved
files, ``hermes_cli/library_db.py``).

The owner sets, per item, what the agent may do with it:

- ``private`` — invisible: search skips it, a read answers "not found";
- ``ask``     — readable only after the owner approves that read;
- ``open``    — searchable and readable without asking.

Every write (create, update, delete) asks the owner first whatever the visibility, through the
desktop's ``library.consent`` card (``callback`` is the session's consent bridge). With no bridge —
any surface without that card — protected reads and writes are refused, never auto-approved. The
global approvals mode (off / yolo) deliberately does not apply: the Library carries its own per-item
rules, and its owner asked to be asked.

GUI-only: the ``library`` toolset is a client-surface toolset (``toolsets.CLIENT_SURFACE_TOOLSETS``).
"""

from __future__ import annotations

import html as html_lib
import json
import re
import uuid
from typing import Callable, Optional

from tools.registry import registry

# What the agent may see without asking / at all.
_OPEN = ("open",)
_VISIBLE = ("ask", "open")
_PREVIEW_CHARS = 700
_READ_CHARS = 60_000
_AGENT_PAGE_VISIBILITY = "ask"
# An interactive block's document: one self-contained HTML file beneath its page. The renderer
# refuses a longer one (it travels to the block's frame as a ``data:`` URL).
_BLOCK_MAX_CHARS = 1_500_000
_HTML_SUFFIXES = (".html", ".htm")
# A block is offline; one that needs the network names public https hosts in its own document and the
# owner approves them on the block. The same rule as ``interactive-html.ts``.
_NET_META = re.compile(r"<meta\b[^>]*\bname\s*=\s*[\"']hermes:network[\"'][^>]*>", re.IGNORECASE)
_NET_CONTENT = re.compile(r"\bcontent\s*=\s*([\"'])([\s\S]*?)\1", re.IGNORECASE)
_NET_HOST = re.compile(r"^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$")
_NET_LOCAL = re.compile(r"\.(?:local|localhost|internal|intranet|lan|home|corp|private|test|invalid|example)$")
_NET_MAX_HOSTS = 8

ConsentCallback = Callable[[dict], Optional[dict]]


def _out(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False)


def _preview(text: str) -> str:
    text = (text or "").strip()
    return text[:_PREVIEW_CHARS] + ("…" if len(text) > _PREVIEW_CHARS else "")


def _target(item) -> dict:
    return {"id": item.id, "title": item.title or "Untitled", "kind": item.kind, "visibility": item.visibility}


def _ask(callback: Optional[ConsentCallback], payload: dict) -> tuple[bool, str]:
    """``(approved, note)`` from the owner. No bridge, a timeout or any failure is a refusal."""
    if callback is None:
        return False, "the Library consent card is only available in the Brain desktop app"
    try:
        answer = callback(payload) or {}
    except Exception as exc:  # the bridge failed; never treat that as consent
        return False, f"could not ask the owner ({exc})"
    return bool(answer.get("approved")), str(answer.get("note") or "")


def _refused(action: str, note: str) -> str:
    reason = f" ({note})" if note else ""
    return _out({
        "success": False, "declined": True,
        "error": f"The owner did not approve this Library {action}{reason}. Do not retry it; "
                 "ask the user what they want instead."})


def _summary_row(item) -> dict:
    row = {"id": item.id, "kind": item.kind, "title": item.title or "Untitled",
           "visibility": item.visibility, "updated_at": item.updated_at}
    if item.kind == "file":
        row.update(file_name=item.file_name, mime=item.mime, size=item.size)
    else:
        row["excerpt"] = item.excerpt
    return row


def library_search(query: str = "", include_protected: bool = False, reason: str = "",
                   callback: Optional[ConsentCallback] = None) -> str:
    from hermes_cli import library_db as ldb
    levels = _OPEN
    if include_protected:
        ok, note = _ask(callback, {
            "action": "search", "summary": "Search your Library, including items that need your permission",
            "reason": reason, "query": query or None})
        if not ok:
            return _refused("search", note)
        levels = _VISIBLE
    with ldb.connect_closing() as conn:
        items = ldb.list_items(conn, query=query or None, visibilities=levels, limit=50)
    return _out({"success": True, "query": query, "items": [_summary_row(i) for i in items],
                 "note": "" if include_protected else "Only items the owner opened to you are listed; "
                         "pass include_protected to ask for the ones that need permission."})


def library_read(item_id: str, reason: str = "", callback: Optional[ConsentCallback] = None) -> str:
    from hermes_cli import library_db as ldb
    with ldb.connect_closing() as conn:
        item = ldb.get_item(conn, item_id)
    if item is None or item.trashed_at or item.visibility not in _VISIBLE:
        return _out({"success": False, "error": f"no Library item '{item_id}' is available to you"})
    if item.visibility != "open":
        ok, note = _ask(callback, {
            "action": "read", "summary": f"Read “{item.title or 'Untitled'}”", "reason": reason,
            "target": _target(item)})
        if not ok:
            return _refused("read", note)
    body = {"success": True, **_summary_row(item)}
    if item.kind == "page":
        body["markdown"] = item.markdown[:_READ_CHARS]
        body["truncated"] = len(item.markdown) > _READ_CHARS
    else:
        body["path"] = item.path
        if _is_html(item) and (item.size or 0) <= _BLOCK_MAX_CHARS:
            body["html"] = _read_text(item)
    return _out(body)


def _snapshot(callback: Optional[ConsentCallback], item_id: str, slide: Optional[int]) -> Optional[str]:
    """A PNG of the open item, drawn by the owner's window, saved under the profile's Library folder. ``None``
    when there is no window to draw it or the item cannot be drawn."""
    import base64
    from hermes_constants import get_hermes_home
    if callback is None:
        return None
    try:
        answer = callback({"action": "snapshot", "item_id": item_id, "slide": slide}) or {}
    except Exception:
        return None
    data_url = str(answer.get("data_url") or "")
    head, _, body = data_url.partition(",")
    if not head.startswith("data:image/png") or not body:
        return None
    try:
        png = base64.b64decode(body, validate=True)
    except ValueError:
        return None
    folder = get_hermes_home() / "library" / "snapshots"
    folder.mkdir(parents=True, exist_ok=True)
    # One picture per item: the next look replaces it instead of piling up files.
    path = folder / f"{re.sub(r'[^A-Za-z0-9_-]', '', item_id)}.png"
    path.write_bytes(png)
    return str(path)


def library_view(look: bool = False, callback: Optional[ConsentCallback] = None) -> str:
    """What the owner is looking at in the Library right now, read fresh from the item."""
    from hermes_cli import library_db as ldb, library_deck, library_view as view_state
    view = view_state.get_view()
    if not view:
        return _out({"success": True, "viewing": None,
                     "note": "The owner has nothing open in the Library (or the app is not showing it)."})
    with ldb.connect_closing() as conn:
        item = ldb.get_item(conn, str(view.get("item_id")))
    if item is None or item.trashed_at or item.visibility not in _VISIBLE:
        return _out({"success": True, "viewing": None, "note": "What the owner has open is not available to you."})
    if item.visibility != "open":
        ok, note = _ask(callback, {
            "action": "read", "summary": f"Look at “{item.title or 'Untitled'}”, which you have open",
            "reason": "see what you are looking at", "target": _target(item)})
        if not ok:
            return _refused("read", note)
    body: dict = {"success": True, "viewing": _summary_row(item)}
    if item.kind == "page" and library_deck.is_deck(item.markdown):
        theme, slides = library_deck.parse(item.markdown)
        at = view.get("slide")
        body["deck"] = {"theme": theme, "slides": len(slides)}
        if isinstance(at, int) and 1 <= at <= len(slides):
            body["slide"] = {"number": at, "markdown": slides[at - 1]}
        else:
            body["slides"] = [{"number": n + 1, "markdown": text[:400]} for n, text in enumerate(slides)]
    elif item.kind == "page":
        body["markdown"] = item.markdown[:_READ_CHARS]
    if view.get("selection"):
        body["selection"] = view["selection"]
    if look:
        shot = _snapshot(callback, item.id, view.get("slide") if isinstance(view.get("slide"), int) else None)
        if shot:
            body["screenshot"] = shot
            body["note"] = "Pass `screenshot` to vision_analyze to see what the owner sees."
        else:
            body["note"] = "No picture is available for this item (the owner's window could not draw it); use the text above."
    return _out(body)


def library_edit(item_id: str, edits: object, reason: str = "", callback: Optional[ConsentCallback] = None,
                 session_id: Optional[str] = None) -> str:
    """Change slides of a presentation in place — one approval for the whole list, applied together or not at all."""
    from hermes_cli import library_db as ldb, library_deck
    with ldb.connect_closing() as conn:
        item = ldb.get_item(conn, item_id)
    if item is None or item.trashed_at or item.visibility not in _VISIBLE:
        return _out({"success": False, "error": f"no Library item '{item_id}' is available to you"})
    if item.kind != "page" or not library_deck.is_deck(item.markdown):
        return _out({"success": False, "error": "edit works on presentations; use update for other pages"})
    try:
        new_body, touched = library_deck.apply_ops(item.markdown, edits if isinstance(edits, list) else [])
    except ValueError as exc:
        return _out({"success": False, "error": str(exc)})
    ok, note = _ask(callback, {
        "action": "update", "summary": f"Edit slide{'s' if len(touched) != 1 else ''} "
                                       f"{', '.join(map(str, touched)) or ''} of “{item.title or 'Untitled'}”".replace("  ", " "),
        "reason": reason, "target": _target(item),
        "preview": _preview("\n\n".join(str(op.get("markdown") or "") for op in edits if isinstance(op, dict))),
        "changes": [f"{op.get('op')}" + (f" {op.get('index')}" if op.get("index") is not None else "")
                    for op in edits if isinstance(op, dict)]})
    if not ok:
        return _refused("edit", note)
    with ldb.connect_closing() as conn:
        from hermes_cli import library_versions
        library_versions.snapshot_page(conn, ldb.get_item(conn, item.id), force=True)
        updated = ldb.update_item(conn, item.id, markdown=new_body)
        ldb.mark_session(conn, item.id, session_id)
    return _out({"success": True, "updated": _summary_row(updated), "slides_changed": touched})


def library_create(title: str, markdown: str = "", icon: Optional[str] = None, reason: str = "",
                   callback: Optional[ConsentCallback] = None, session_id: Optional[str] = None) -> str:
    title = (title or "").strip()
    if not title:
        return _out({"success": False, "error": "title is required"})
    ok, note = _ask(callback, {
        "action": "create", "summary": f"Create the page “{title}”", "reason": reason,
        "target": {"title": title, "kind": "page", "visibility": _AGENT_PAGE_VISIBILITY},
        "preview": _preview(markdown), "changes": ["New page", "Access for Hermes: ask you first"]})
    if not ok:
        return _refused("create", note)
    from hermes_cli import library_db as ldb
    with ldb.connect_closing() as conn:
        item = ldb.create_page(conn, title=title, icon=icon, markdown=markdown,
                               visibility=_AGENT_PAGE_VISIBILITY, created_by="agent")
        ldb.mark_session(conn, item.id, session_id)
    return _out({"success": True, "created": _summary_row(item)})


def library_update(item_id: str, markdown: Optional[str] = None, title: Optional[str] = None,
                   mode: str = "replace", reason: str = "", callback: Optional[ConsentCallback] = None,
                   session_id: Optional[str] = None) -> str:
    from hermes_cli import library_db as ldb
    with ldb.connect_closing() as conn:
        item = ldb.get_item(conn, item_id)
    if item is None or item.trashed_at or item.visibility not in _VISIBLE:
        return _out({"success": False, "error": f"no Library item '{item_id}' is available to you"})
    if item.kind != "page":
        return _out({"success": False, "error": "only pages can be edited; files are replaced by the owner"})
    if markdown is None and not (title or "").strip():
        return _out({"success": False, "error": "nothing to change: pass markdown and/or title"})
    append = mode == "append"
    new_body = None if markdown is None else (
        (item.markdown.rstrip() + "\n\n" + markdown.strip()) if append and item.markdown.strip() else markdown)
    changes = []
    if (title or "").strip() and title.strip() != item.title:
        changes.append(f"Title: “{item.title or 'Untitled'}” → “{title.strip()}”")
    if markdown is not None:
        changes.append("Adds to the end of the page" if append else "Replaces the page content")
    ok, note = _ask(callback, {
        "action": "update", "summary": f"Edit “{item.title or 'Untitled'}”", "reason": reason,
        "target": _target(item), "preview": _preview(markdown or ""), "changes": changes})
    if not ok:
        return _refused("edit", note)
    patch = {}
    if (title or "").strip():
        patch["title"] = title.strip()
    if new_body is not None:
        patch["markdown"] = new_body
    with ldb.connect_closing() as conn:
        # The page exactly as the owner left it, so one step back undoes this edit and nothing else.
        if new_body is not None:
            from hermes_cli import library_versions

            library_versions.snapshot_page(conn, ldb.get_item(conn, item.id), force=True)
        updated = ldb.update_item(conn, item.id, **patch)
        ldb.mark_session(conn, item.id, session_id)
    return _out({"success": True, "updated": _summary_row(updated)})


def _is_html(item) -> bool:
    return item.kind == "file" and (item.file_name or "").lower().endswith(_HTML_SUFFIXES)


def _read_text(item) -> str:
    from hermes_cli import library_db as ldb

    return (ldb.library_files_dir() / item.file_ref).read_text(encoding="utf-8", errors="replace")


def _network_hosts(html: str) -> tuple[list[str], list[str]]:
    """``(hosts, invalid)`` named by the document's ``hermes:network`` meta."""
    tag = _NET_META.search(html)
    found = _NET_CONTENT.search(tag.group(0)) if tag else None
    hosts: list[str] = []
    invalid: list[str] = []
    for word in re.split(r"[\s,;]+", (found.group(2) if found else "").lower()):
        if not word:
            continue
        if not _NET_HOST.match(word) or _NET_LOCAL.search(word) or len(hosts) >= _NET_MAX_HOSTS:
            invalid.append(word)
        elif word not in hosts:
            hosts.append(word)
    return hosts, invalid


def _block_name(title: str, html: str) -> tuple[str, str]:
    """``(title, file name)`` for a block: the given title, else the document's ``<title>``."""
    found = re.search(r"<title[^>]*>([\s\S]*?)</title>", html, re.IGNORECASE)
    name = (title or "").strip() or (html_lib.unescape(found.group(1)) if found else "")
    name = " ".join("".join(c for c in name if c.isprintable() and c not in '\\/:*?"<>|[]').split())[:80]
    name = name or "Interactive block"
    return name, f"{name}.html"


def library_block(item_id: str, html: str = "", title: str = "", reason: str = "",
                  callback: Optional[ConsentCallback] = None, session_id: Optional[str] = None) -> str:
    """Put an interactive block on a page (``item_id`` a page), or give an existing block (``item_id``
    its HTML file) a new document. The previous document stays in the file's version history."""
    from hermes_cli import library_db as ldb

    html = (html or "").strip()
    if not html:
        return _out({"success": False, "error": "html is required: the whole document, one self-contained file"})
    if len(html) > _BLOCK_MAX_CHARS:
        return _out({"success": False, "error": f"html is too long (at most {_BLOCK_MAX_CHARS:,} characters)"})
    with ldb.connect_closing() as conn:
        item = ldb.get_item(conn, item_id)
    if item is None or item.trashed_at or item.visibility not in _VISIBLE:
        return _out({"success": False, "error": f"no Library item '{item_id}' is available to you"})
    if item.kind != "page" and not _is_html(item):
        return _out({"success": False, "error": "id must be a page (to add a block) or an interactive block's "
                                                "HTML file (to change it)"})
    hosts, invalid = _network_hosts(html)
    if invalid:
        return _out({"success": False, "error": "hermes:network may name only public https hosts, spelled out "
                                                f"(no wildcards, addresses or local names; at most {_NET_MAX_HOSTS}): "
                                                + ", ".join(invalid)})
    block_title, file_name = _block_name(title, html)
    adding = item.kind == "page"
    ok, note = _ask(callback, {
        "action": "create" if adding else "update",
        "summary": (f"Add an interactive block to “{item.title or 'Untitled'}”" if adding
                    else f"Change the interactive block “{block_title}”"),
        "reason": reason, "target": _target(item), "preview": _preview(html),
        "changes": (["New interactive block at the end of the page"] if adding
                    else ["Replaces the block's document — the previous one stays in its version history"])
        + ([f"Asks to reach: {', '.join(hosts)} — you approve this separately, on the block"] if hosts
           else ["It runs sandboxed: no network, no access to your data"])})
    if not ok:
        return _refused("block", note)
    from hermes_cli import library_processing

    data = html.encode("utf-8")
    with ldb.connect_closing() as conn:
        if not adding:
            updated = ldb.replace_file(conn, item.id, data=data, mime="text/html")
            ldb.mark_session(conn, updated.id, session_id)
            library_processing.schedule([updated.id])
            return _out({"success": True, "updated": _summary_row(updated)})
        created = ldb.save_file(conn, file_name=ldb.unique_name(conn, file_name, item.id), data=data,
                                mime="text/html", parent_id=item.id, created_by="agent")
        library_processing.schedule([created.id])
        link = f"[{block_title}](library://{created.id})"
        patch = {"markdown": (item.markdown.rstrip() + "\n\n" + link) if item.markdown.strip() else link}
        if item.content:
            # The page already has a block document: add to it, so nothing the owner arranged is flattened.
            blocks = json.loads(item.content)
            blocks.append({"id": str(uuid.uuid4()), "type": "interactive", "children": [],
                           "props": {"fileId": created.id, "height": 0, "title": block_title}})
            patch["content"] = json.dumps(blocks)
        from hermes_cli import library_versions

        library_versions.snapshot_page(conn, ldb.get_item(conn, item.id), force=True)
        ldb.update_item(conn, item.id, **patch)
        ldb.mark_session(conn, item.id, session_id)
        ldb.mark_session(conn, created.id, session_id)
    return _out({"success": True, "block": {"id": created.id, "page": item.id, "title": block_title}})


def library_delete(item_id: str, reason: str = "", callback: Optional[ConsentCallback] = None) -> str:
    from hermes_cli import library_db as ldb
    with ldb.connect_closing() as conn:
        item = ldb.get_item(conn, item_id)
    if item is None or item.trashed_at or item.visibility not in _VISIBLE:
        return _out({"success": False, "error": f"no Library item '{item_id}' is available to you"})
    ok, note = _ask(callback, {
        "action": "delete", "summary": f"Move “{item.title or 'Untitled'}” to the Trash", "reason": reason,
        "target": _target(item), "changes": ["Moves to the Trash — you can restore it from the Library"]})
    if not ok:
        return _refused("delete", note)
    with ldb.connect_closing() as conn:
        ldb.trash_item(conn, item.id)
    return _out({"success": True, "trashed": item.id})


_IMPORT_MAX_BYTES = 50 * 1024 * 1024


def library_import(path: str, title: str = "", reason: str = "", callback: Optional[ConsentCallback] = None,
                   session_id: Optional[str] = None) -> str:
    """Add a file Hermes made on disk (a background-free image, a chart, an export) to the Library. The
    owner approves it first, like every write; the file arrives as theirs to keep, ask-level for Hermes."""
    from pathlib import Path

    from agent.file_safety import get_read_block_error

    source = Path(str(path or "")).expanduser()
    if not source.is_absolute() or not source.is_file():
        return _out({"success": False, "error": "path must be an absolute path to an existing file"})
    if get_read_block_error(str(source)) is not None:
        return _out({"success": False, "error": "that file cannot be added to the Library"})
    size = source.stat().st_size
    if size > _IMPORT_MAX_BYTES:
        return _out({"success": False, "error": f"file is larger than {_IMPORT_MAX_BYTES // (1024 * 1024)} MB"})
    name = (title or "").strip() or source.name
    ok, note = _ask(callback, {
        "action": "create", "summary": f"Add the file “{name}” to your Library", "reason": reason,
        "target": {"title": name, "kind": "file", "visibility": _AGENT_PAGE_VISIBILITY},
        "preview": "", "changes": [f"New file · {size // 1024 or 1} KB", "Access for Hermes: ask you first"]})
    if not ok:
        return _refused("create", note)
    from hermes_cli import library_db as ldb
    with ldb.connect_closing() as conn:
        item = ldb.save_file(conn, file_name=name if Path(name).suffix else source.name,
                             source_path=str(source), visibility=_AGENT_PAGE_VISIBILITY, created_by="agent")
        ldb.mark_session(conn, item.id, session_id)
    from hermes_cli import library_processing
    library_processing.schedule([item.id])
    return _out({"success": True, "created": _summary_row(item)})


def library_tool(action: str = "", query: str = "", id: str = "", title: str = "", markdown: Optional[str] = None,
                 icon: Optional[str] = None, mode: str = "replace", include_protected: bool = False,
                 html: Optional[str] = None, path: Optional[str] = None, edits: Optional[list] = None,
                 look: bool = False,
                 reason: str = "",
                 callback: Optional[ConsentCallback] = None, session_id: Optional[str] = None) -> str:
    action = (action or "").strip()
    if action == "search":
        return library_search(query, include_protected=bool(include_protected), reason=reason, callback=callback)
    if action == "read":
        return library_read(id, reason=reason, callback=callback)
    if action == "view":
        return library_view(look=bool(look), callback=callback)
    if action == "edit":
        return library_edit(id, edits, reason=reason, callback=callback, session_id=session_id)
    if action == "create":
        return library_create(title, markdown or "", icon=icon, reason=reason, callback=callback,
                              session_id=session_id)
    if action == "update":
        return library_update(id, markdown=markdown, title=title or None, mode=mode, reason=reason,
                              callback=callback, session_id=session_id)
    if action == "delete":
        return library_delete(id, reason=reason, callback=callback)
    if action == "import":
        return library_import(path or "", title=title, reason=reason, callback=callback, session_id=session_id)
    if action == "block":
        return library_block(id, html=html or "", title=title, reason=reason, callback=callback,
                             session_id=session_id)
    return _out({"success": False, "error": "action must be one of: search, read, view, edit, create, update, delete, block, import."})


LIBRARY_SCHEMA = {
    "name": "library",
    "description": (
        "The user's Library of pages and saved files. Use it only when the user asks. search: items "
        "the user opened to you (include_protected asks them for the rest). read: one item by id "
        "(page markdown, or a file's path). create / update / delete: always shown to the user for "
        "approval first. If they decline, don't retry — ask what they want. Say why in `reason`. "
        "import: add a file you made on disk (give its absolute `path`, and a `title` to name it) to the "
        "Library — a background-free image, a chart, an export; the owner approves it first. "
        "view: what the owner is looking at right now — the open item and, in a presentation, the slide they "
        "are on (and any selection). Call it first when they say \"this\", \"here\" or \"this slide\". If you can see images, pass look=true "
        "to get a picture of the slide, then give its path to vision_analyze. "
        "edit: change a presentation (a page that starts with <!-- hermes:deck -->) slide by slide with "
        "`edits` — set_slide, insert_slide, remove_slide, move_slide, set_theme — instead of rewriting the "
        "whole page; the owner sees each slide change as you make it. Prefer it to update for decks. "
        "A file the user attached from the Library sits at `…/library/exports/<item id>/<name>`: it is a "
        "read-only copy of that item, so change the item itself with update (or block) and that id. "
        "block: an interactive block is a small web page (calculator, quiz, chart, dashboard) running "
        "inside a page. Pass a page id to add one at its end, or an existing block's HTML file id (read "
        "it first: a file's `html` comes back with it) to change it; always send the WHOLE document in "
        "`html`. Rules for the document: one self-contained file; inline CSS and JS only; it runs "
        "sandboxed: scripts, styles and fonts may load from cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com "
        "and esm.sh (pin a version in the URL — Chart.js, D3, Mermaid), but fetch and external images need a "
        "declared host as described below (data: URIs are fine); responsive, readable at 320–900px wide; label every control. The page gives the block "
        "`window.hermes`: `hermes.state` is what it saved last (JSON, or null — read it on load), "
        "`hermes.save(value)` keeps JSON (max 64 KB) with the page — call it when the user changes "
        "something worth keeping; `hermes.theme` and the CSS variables --hermes-bg, --hermes-fg, "
        "--hermes-muted, --hermes-border, --hermes-accent follow the app's light/dark theme — use them "
        "for every colour so the block matches the page; `hermes.onTheme(fn)` runs when the theme changes. "
        "For anything beyond those CDNs — data from an API — name each public https host in its document — "
        "`<meta name=\"hermes:network\" content=\"api.example.com cdn.example.net\">` (at most 8, no wildcards, "
        "addresses or local names) — and the owner approves them separately on the block; until then it "
        "must still work, with sample data or a clear message. Fetch with https only and keep requests few."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["search", "read", "view", "edit", "create", "update", "delete", "block", "import"]},
            "query": {"type": "string", "description": "search: words to find (empty lists recent items)."},
            "include_protected": {"type": "boolean", "description": "search: also items that need permission."},
            "id": {"type": "string", "description": "read / update / delete: the item id from search. "
                                                    "block: a page id (add) or an HTML block file id (change)."},
            "html": {"type": "string", "description": "block: the complete HTML document."},
            "look": {"type": "boolean", "description": "view: also draw what the owner sees as an image (a presentation's "
                                                       "current slide, a table, a page) and return its path; only if you can see images."},
            "edits": {"type": "array", "description": "edit: slide changes, applied together, in order. Slide "
                      "numbers are the ones the owner sees (the first is 1).",
                      "items": {"type": "object", "properties": {
                          "op": {"type": "string", "enum": ["set_slide", "insert_slide", "remove_slide",
                                                            "move_slide", "set_theme"]},
                          "index": {"type": "integer", "description": "The slide (insert_slide: where the new one goes)."},
                          "to": {"type": "integer", "description": "move_slide: where it goes."},
                          "markdown": {"type": "string", "description": "set_slide / insert_slide: the slide's text."},
                          "theme": {"type": "string", "enum": ["paper", "ink", "sand", "ocean"]}},
                          "required": ["op"]}},
            "path": {"type": "string", "description": "import: absolute path of the file to add."},
            "title": {"type": "string", "description": "create: page title. update: new title. import: the file's name."},
            "markdown": {"type": "string", "description": "create / update: page body in markdown."},
            "mode": {"type": "string", "enum": ["replace", "append"], "description": "update: default replace."},
            "icon": {"type": "string", "description": "create: optional emoji."},
            "reason": {"type": "string", "description": "One line the user sees: why you need this."},
        },
        "required": ["action"],
    },
}

registry.register(
    name="library",
    toolset="library",
    schema=LIBRARY_SCHEMA,
    handler=lambda args, **kw: library_tool(**{k: args.get(k) for k in LIBRARY_SCHEMA["parameters"]["properties"]
                                               if args.get(k) is not None}, callback=kw.get("callback")),
    emoji="📚",
)
