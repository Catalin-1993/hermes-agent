"""Library RPC surface: per-profile folders, Notion-style pages and saved files for the desktop
Library view. Bodies are rebound onto server.py's globals at install (method_ctx.bind_module)."""

from __future__ import annotations

from .method_ctx import HandlerRegistry, bind_module

_registry = HandlerRegistry()
method = _registry.method

# JSON-RPC error codes: generic failure / id resolved to nothing / invalid argument.
_E_LIBRARY, _E_NO_ITEM, _E_LIBRARY_ARG = 5171, 5172, 5173
# Data-URL uploads cross the socket as base64; big media goes by path or as a staged upload.
_DATA_URL_MAX_BYTES = 64 * 1024 * 1024
_CHUNK_MAX_BYTES = 8 * 1024 * 1024
# `library.read` hands bytes to the viewers in slices, so any size arrives (with progress).
_READ_CHUNK_BYTES = 8 * 1024 * 1024
# A listing kicks off processing for files saved before processing existed, a few at a time.
_BACKFILL_PER_LIST = 12
_ON_DUPLICATE = ("ask", "keep", "replace", "skip")


class _NoItem(Exception):
    """Raised inside a library handler when ``params['id']`` resolves to nothing."""


def _library_method(name: str):
    """Register a library RPC, injecting (ldb, conn) and unifying error mapping; profile-scoped
    so a pooled/multiplexed backend reads the focused profile's ``library.db``."""
    def decorator(fn):
        @method(name)
        @_registry.profile_scoped
        def handler(rid, params: dict) -> dict:
            try:
                from hermes_cli import library_db as ldb
                with ldb.connect_closing() as conn:
                    return fn(rid, params, ldb, conn)
            except _NoItem:
                return _err(rid, _E_NO_ITEM, "no such library item")
            except ValueError as e:
                return _err(rid, _E_LIBRARY_ARG, str(e))
            except Exception as e:
                return _err(rid, _E_LIBRARY, str(e))
        return handler
    return decorator


def _require_item(ldb, conn, params: dict):
    item = ldb.get_item(conn, str(params.get("id") or ""))
    if item is None:
        raise _NoItem
    return item


def _decode_library_data_url(data_url: str) -> tuple[bytes, str]:
    # Imported here: bind_module republishes functions onto server.py's globals, not modules.
    import base64
    import binascii

    text = (data_url or "").strip()
    if not text.startswith("data:") or "," not in text or ";base64" not in text.split(",", 1)[0]:
        raise ValueError("data_url must be a base64 data URL")
    header, encoded = text.split(",", 1)
    try:
        data = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("data_url is not valid base64")
    if len(data) > _DATA_URL_MAX_BYTES:
        raise ValueError("file is too large to upload; import it by path instead")
    return data, header[5:].split(";", 1)[0] or "application/octet-stream"


def _process(ids) -> None:
    """Thumbnail / preview / search text for freshly stored files, in the background."""
    from hermes_cli import library_processing

    library_processing.schedule(ids)


def _store_incoming(ldb, conn, params: dict, *, source_path=None, data=None, mime=None,
                    move_source: bool = False) -> dict:
    """Save one incoming file, honouring ``on_duplicate`` against what it collides with:
    ``ask`` answers the conflict and stores nothing; ``skip`` answers the existing item; ``replace``
    overwrites a same-named file in place (identical bytes are already there); ``keep`` stores it
    beside the other, renamed ``name (2)`` on a name clash."""
    policy = str(params.get("on_duplicate") or "keep")
    if policy not in _ON_DUPLICATE:
        raise ValueError(f"on_duplicate must be one of: {', '.join(_ON_DUPLICATE)}")
    parent = params.get("parent_id") or None
    name = str(params.get("file_name") or "") or (
        str(source_path).replace("\\", "/").rsplit("/", 1)[-1] if source_path else "file")
    size, digest = ldb.file_digest(source_path=source_path, data=data)
    conflict = ldb.find_conflict(conn, file_name=name, size=size, sha256=digest, parent_id=parent)
    if conflict and policy == "ask":
        kind, existing = conflict
        return {"item": None, "conflict": {"type": kind, "item": existing.to_dict()}}
    if conflict and (policy == "skip" or (policy == "replace" and conflict[0] == "content")):
        return {"item": conflict[1].to_dict(with_body=True), "skipped": True}
    if conflict and policy == "replace":
        item = ldb.replace_file(conn, conflict[1].id, source_path=source_path, data=data, mime=mime,
                                move_source=move_source)
        _process([item.id])
        return {"item": item.to_dict(with_body=True)}
    if conflict and conflict[0] == "name":
        name = ldb.unique_name(conn, name, parent)
    item = ldb.save_file(conn, file_name=name, source_path=source_path, data=data, mime=mime, parent_id=parent,
                         visibility=params.get("visibility") or None, sha256=digest,
                         move_source=move_source)
    _process([item.id])
    return {"item": item.to_dict(with_body=True)}


@_library_method("library.list")
def _library_list(rid, params, ldb, conn) -> dict:
    scope = str(params.get("scope") or "all")
    parent = params.get("parent_id")
    items = ldb.list_items(
        conn, kind=params.get("kind") or None, query=params.get("query") or None,
        trashed=scope == "trash", favorites=scope == "favorites", parent_id=parent, tag=params.get("tag") or None,
        sort=str(params.get("sort") or "updated"), order=params.get("order") or None,
        limit=int(params.get("limit") or 500))
    stale = [i.id for i in items if i.kind == "file" and i.status is None][:_BACKFILL_PER_LIST]
    if stale:
        for item_id in stale:
            ldb.set_processed(conn, item_id, status="pending")
        _process(stale)
    result = {"items": [i.to_dict() for i in items], "trail": []}
    if parent:
        # Browsing a container: its breadcrumb, outermost first and ending with the container.
        here = ldb.get_item(conn, str(parent))
        if here is None:
            raise _NoItem
        result["trail"] = [i.to_dict() for i in [*ldb.ancestors(conn, here.id), here]]
    return _ok(rid, result)


def _current(ldb, conn, params):
    """The item, after taking in an edit made to its file by another app (then reprocessed)."""
    item = _require_item(ldb, conn, params)
    edited = ldb.reconcile_external_edit(conn, item)
    if edited is None:
        return item
    _process([edited.id])
    return edited


@_library_method("library.get")
def _library_get(rid, params, ldb, conn) -> dict:
    item = _current(ldb, conn, params)
    return _ok(rid, {"item": item.to_dict(with_body=True),
                     "trail": [i.to_dict() for i in ldb.ancestors(conn, item.id)]})


@_library_method("library.create_page")
def _library_create_page(rid, params, ldb, conn) -> dict:
    item = ldb.create_page(
        conn, title=str(params.get("title") or ""), icon=params.get("icon"), parent_id=params.get("parent_id"),
        content=params.get("content"), markdown=str(params.get("markdown") or ""),
        visibility=params.get("visibility") or None)
    return _ok(rid, {"item": item.to_dict(with_body=True)})


@_library_method("library.create_folder")
def _library_create_folder(rid, params, ldb, conn) -> dict:
    item = ldb.create_folder(conn, title=str(params.get("title") or ""), parent_id=params.get("parent_id"),
                             visibility=params.get("visibility") or None)
    return _ok(rid, {"item": item.to_dict(with_body=True)})


@_library_method("library.move")
def _library_move(rid, params, ldb, conn) -> dict:
    ids = [str(i) for i in (params.get("ids") or []) if i]
    if not ids:
        raise ValueError("ids required")
    moved = ldb.move_items(conn, ids, params.get("parent_id") or None)
    return _ok(rid, {"items": [i.to_dict() for i in moved]})


@_library_method("library.copy")
def _library_copy(rid, params, ldb, conn) -> dict:
    ids = [str(i) for i in (params.get("ids") or []) if i]
    if not ids:
        raise ValueError("ids required")
    copies = ldb.copy_items(conn, ids, params.get("parent_id") or None, in_place=bool(params.get("in_place")))
    # Processing skips what is not a file, so every copy and everything below it can be handed over.
    _process([made for copy in copies for made in (copy.id, *ldb.descendant_ids(conn, copy.id))])
    return _ok(rid, {"items": [i.to_dict() for i in copies]})


_UPDATABLE = ("title", "icon", "cover", "content", "markdown", "visibility", "favorite", "parent_id")


@_library_method("library.update")
def _library_update(rid, params, ldb, conn) -> dict:
    item = _require_item(ldb, conn, params)
    patch = {k: params[k] for k in _UPDATABLE if k in params and params[k] is not None}
    # parent_id / icon / cover may be cleared explicitly with an empty string.
    updated = ldb.update_item(conn, item.id, **patch)
    return _ok(rid, {"item": updated.to_dict(with_body=True)})


@_library_method("library.import")
def _library_import(rid, params, ldb, conn) -> dict:
    path, data_url = params.get("path"), params.get("data_url")
    if bool(path) == bool(data_url):
        raise ValueError("pass exactly one of path or data_url")
    if data_url:
        data, mime = _decode_library_data_url(str(data_url))
        return _ok(rid, _store_incoming(ldb, conn, params, data=data, mime=params.get("mime") or mime))
    return _ok(rid, _store_incoming(ldb, conn, params, source_path=str(path), mime=params.get("mime")))


@_library_method("library.import_folder")
def _library_import_folder(rid, params, ldb, conn) -> dict:
    result = ldb.import_folder(conn, str(params.get("path") or ""), parent_id=params.get("parent_id") or None,
                               visibility=params.get("visibility") or None)
    _process(ldb.descendant_ids(conn, result["folder"].id))
    return _ok(rid, {**result, "folder": result["folder"].to_dict()})


@_library_method("library.export")
def _library_export(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_export

    return _ok(rid, {"path": str(library_export.export_path(_current(ldb, conn, params)))})


@_library_method("library.versions")
def _library_versions(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_versions

    return _ok(rid, {"versions": library_versions.list_versions(conn, _require_item(ldb, conn, params).id)})


@_library_method("library.restore_version")
def _library_restore_version(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_versions

    restored = library_versions.restore(conn, _require_item(ldb, conn, params), str(params.get("version_id") or ""))
    if restored.kind == "file":
        _process([restored.id])
    return _ok(rid, {"item": restored.to_dict(with_body=True)})


@_library_method("library.tags")
def _library_tags(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_tags

    return _ok(rid, {"tags": library_tags.list_tags(conn)})


@_library_method("library.tag")
def _library_tag(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_tags

    ids = [str(i) for i in (params.get("ids") or []) if i]
    return _ok(rid, library_tags.tag_items(conn, ids, str(params.get("name") or ""), on=params.get("on", True) is not False,
                                           color=params.get("color")))


@_library_method("library.tag_update")
def _library_tag_update(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_tags

    return _ok(rid, library_tags.update_tag(conn, str(params.get("name") or ""), color=params.get("color"),
                                            new_name=params.get("new_name")))


@_library_method("library.tag_delete")
def _library_tag_delete(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_tags

    library_tags.delete_tag(conn, str(params.get("name") or ""))
    return _ok(rid, {"ok": True})


@_library_method("library.smart_list")
def _library_smart_list(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_tags

    return _ok(rid, {"searches": library_tags.list_smart(conn)})


@_library_method("library.smart_create")
def _library_smart_create(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_tags

    return _ok(rid, library_tags.create_smart(conn, str(params.get("title") or ""), params.get("query") or {}))


@_library_method("library.smart_delete")
def _library_smart_delete(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_tags

    library_tags.delete_smart(conn, str(params.get("id") or ""))
    return _ok(rid, {"ok": True})


@_library_method("library.extract")
def _library_extract(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_archive

    result = library_archive.extract(conn, _require_item(ldb, conn, params))
    _process(ldb.descendant_ids(conn, result["folder"].id))
    return _ok(rid, {**result, "folder": result["folder"].to_dict()})


@_library_method("library.upload_begin")
def _library_upload_begin(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_uploads as uploads

    return _ok(rid, uploads.begin(file_name=str(params.get("file_name") or "file"),
                                  size=int(params.get("size") or 0), mime=params.get("mime")))


@_library_method("library.upload_chunk")
def _library_upload_chunk(rid, params, ldb, conn) -> dict:
    import base64
    import binascii

    from hermes_cli import library_uploads as uploads

    try:
        data = base64.b64decode(str(params.get("data") or ""), validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("chunk is not valid base64")
    if len(data) > _CHUNK_MAX_BYTES:
        raise ValueError("chunk is too large")
    offset = uploads.append(str(params.get("upload_id") or ""), offset=int(params.get("offset") or 0), data=data)
    return _ok(rid, {"offset": offset})


@_library_method("library.upload_finish")
def _library_upload_finish(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_uploads as uploads

    upload_id = str(params.get("upload_id") or "")
    part, meta = uploads.staged(upload_id)
    incoming = {**params, "file_name": params.get("file_name") or meta.get("file_name")}
    result = _store_incoming(ldb, conn, incoming, source_path=str(part), mime=params.get("mime") or meta.get("mime"),
                             move_source=True)
    # A conflict waits for the owner's answer: the staged bytes stay until it comes.
    if result.get("item") is not None:
        uploads.abort(upload_id)
    return _ok(rid, result)


@_library_method("library.upload_abort")
def _library_upload_abort(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_uploads as uploads

    uploads.abort(str(params.get("upload_id") or ""))
    return _ok(rid, {"ok": True})


@_library_method("library.preview")
def _library_preview(rid, params, ldb, conn) -> dict:
    from hermes_cli import library_preview

    return _ok(rid, library_preview.preview(_current(ldb, conn, params)))


@_library_method("library.read")
def _library_read(rid, params, ldb, conn) -> dict:
    import base64
    import mimetypes
    from pathlib import Path

    from hermes_cli import library_preview

    item = _require_item(ldb, conn, params)
    if item.kind != "file" or not item.path:
        raise ValueError("only files have bytes to read")
    source, mime = Path(item.path), item.mime
    if params.get("rendition"):
        rendition = library_preview.rendition_path(item)
        if rendition is None:
            raise ValueError("this file has no rendition yet")
        source, mime = rendition, mimetypes.guess_type(rendition.name)[0]
    offset = max(0, int(params.get("offset") or 0))
    length = min(_READ_CHUNK_BYTES, max(1, int(params.get("length") or _READ_CHUNK_BYTES)))
    with source.open("rb") as handle:
        handle.seek(offset)
        data = handle.read(length)
    return _ok(rid, {"data": base64.b64encode(data).decode(), "mime": mime, "offset": offset,
                     "size": source.stat().st_size})


@_library_method("library.write_text")
def _library_write_text(rid, params, ldb, conn) -> dict:
    item = _require_item(ldb, conn, params)
    if item.kind != "file":
        raise ValueError("only files hold text to write")
    updated = ldb.replace_file(conn, item.id, data=str(params.get("text") or "").encode("utf-8"))
    _process([updated.id])
    return _ok(rid, {"item": updated.to_dict(with_body=True)})


@_library_method("library.write_file")
def _library_write_file(rid, params, ldb, conn) -> dict:
    """New bytes for a saved file (an edited image): same item, the earlier bytes kept as a version."""
    item = _require_item(ldb, conn, params)
    if item.kind != "file":
        raise ValueError("only files hold bytes to write")
    data, mime = _decode_library_data_url(str(params.get("data_url") or ""))
    updated = ldb.replace_file(conn, item.id, data=data, mime=mime)
    _process([updated.id])
    return _ok(rid, {"item": updated.to_dict(with_body=True)})


@method("library.set_view")
@_registry.profile_scoped
def _library_set_view(rid, params: dict) -> dict:
    from hermes_cli import library_view

    slide = params.get("slide")
    library_view.set_view(
        str(params.get("item_id") or "") or None,
        slide=int(slide) if isinstance(slide, int) and not isinstance(slide, bool) else None,
        selection=str(params.get("selection") or "") or None)
    return _ok(rid, {"ok": True})


@_library_method("library.trash")
def _library_trash(rid, params, ldb, conn) -> dict:
    item = _require_item(ldb, conn, params)
    return _ok(rid, {"item": ldb.trash_item(conn, item.id, restore=bool(params.get("restore"))).to_dict()})


@_library_method("library.purge")
def _library_purge(rid, params, ldb, conn) -> dict:
    item = _require_item(ldb, conn, params)
    return _ok(rid, {"ok": True, "removed": 1 if ldb.purge_item(conn, item.id) else 0})


@_library_method("library.empty_trash")
def _library_empty_trash(rid, params, ldb, conn) -> dict:
    return _ok(rid, {"ok": True, "removed": ldb.empty_trash(conn)})


def register(server) -> None:
    """Publish this module's helpers + handlers onto ``server``, rebound to its globals."""
    bind_module(globals(), server, skip=("_",))
