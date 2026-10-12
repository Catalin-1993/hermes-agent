"""library.* JSON-RPC contracts: items land in the profile the call names (A→B→A), uploads round-trip
their bytes, and the trash is reversible until purged."""

from __future__ import annotations

import base64
from pathlib import Path

import pytest

import tui_gateway.server as server


def _call(method, params=None):
    resp = server._methods[method](1, params or {})
    assert "error" not in resp, resp.get("error")
    return resp["result"]


@pytest.fixture(autouse=True)
def _process_inline(monkeypatch):
    """Processing runs on background threads in the app; here it runs inline so results are asserted."""
    from hermes_cli import library_preview, library_processing

    # The OS previewers are host-specific and wait out their timeouts on these placeholder files.
    monkeypatch.setattr(library_processing, "_quicklook", lambda source, target: False)
    monkeypatch.setattr(library_preview, "_quicklook_preview", lambda path, item_id: None)
    from hermes_cli import library_ocr

    monkeypatch.setattr(library_ocr, "recognize", lambda path: "")
    monkeypatch.setattr(library_processing, "schedule",
                        lambda ids: [library_processing.process_item(i) for i in dict.fromkeys(ids)])


@pytest.fixture
def work_home(tmp_path, monkeypatch):
    home = tmp_path / "profiles" / "work"
    home.mkdir(parents=True)
    monkeypatch.setattr(server, "_profile_home", lambda name: home if name == "work" else None)
    return home


def test_items_stay_in_the_profile_that_wrote_them(work_home):
    launch = _call("library.create_page", {"title": "Launch note", "markdown": "alpha"})["item"]
    work = _call("library.create_page", {"title": "Work note", "markdown": "beta", "profile": "work"})["item"]
    again = _call("library.create_page", {"title": "Launch again"})["item"]

    launch_ids = {i["id"] for i in _call("library.list")["items"]}
    work_ids = {i["id"] for i in _call("library.list", {"profile": "work"})["items"]}

    assert launch_ids == {launch["id"], again["id"]}
    assert work_ids == {work["id"]}
    assert (work_home / "library.db").exists()


def test_data_url_upload_round_trips_bytes_and_type():
    payload = b"%PDF-1.7 minimal"
    data_url = "data:application/pdf;base64," + base64.b64encode(payload).decode()

    item = _call("library.import", {"file_name": "brief.pdf", "data_url": data_url})["item"]

    assert item["kind"] == "file" and item["mime"] == "application/pdf" and item["size"] == len(payload)
    assert Path(item["path"]).read_bytes() == payload


def test_markdown_edit_is_visible_to_get_and_search():
    page = _call("library.create_page", {"title": "Plan"})["item"]
    _call("library.update", {"id": page["id"], "markdown": "ship the library", "visibility": "open"})

    got = _call("library.get", {"id": page["id"]})["item"]
    hits = _call("library.list", {"query": "library"})["items"]

    assert got["markdown"] == "ship the library" and got["visibility"] == "open"
    assert [h["id"] for h in hits] == [page["id"]]


def test_trash_is_reversible_until_purged():
    page = _call("library.create_page", {"title": "Scratch"})["item"]

    _call("library.trash", {"id": page["id"]})
    assert page["id"] in {i["id"] for i in _call("library.list", {"scope": "trash"})["items"]}
    _call("library.trash", {"id": page["id"], "restore": True})
    assert page["id"] in {i["id"] for i in _call("library.list")["items"]}

    _call("library.trash", {"id": page["id"]})
    assert _call("library.empty_trash")["removed"] == 1
    resp = server._methods["library.get"](1, {"id": page["id"]})
    assert resp["error"]["code"] == 5172


def test_import_requires_exactly_one_source():
    resp = server._methods["library.import"](1, {"file_name": "x.txt"})
    assert resp["error"]["code"] == 5173


def test_staged_upload_asks_before_duplicating_and_keeps_bytes_until_answered():
    payload = b"%PDF staged report"
    first = _call("library.import", {"file_name": "report.pdf",
                                     "data_url": "data:application/pdf;base64," + base64.b64encode(payload).decode()})

    begun = _call("library.upload_begin", {"file_name": "report.pdf", "size": len(payload)})
    _call("library.upload_chunk", {"upload_id": begun["upload_id"], "offset": 0,
                                   "data": base64.b64encode(payload).decode()})
    asked = _call("library.upload_finish", {"upload_id": begun["upload_id"], "on_duplicate": "ask"})
    assert asked["item"] is None and asked["conflict"]["type"] == "content"
    assert asked["conflict"]["item"]["id"] == first["item"]["id"]

    kept = _call("library.upload_finish", {"upload_id": begun["upload_id"], "on_duplicate": "keep"})
    assert kept["item"]["id"] != first["item"]["id"] and Path(kept["item"]["path"]).read_bytes() == payload


def test_browsing_a_folder_answers_its_breadcrumb():
    outer = _call("library.create_folder", {"title": "Investments"})["item"]
    inner = _call("library.create_folder", {"title": "Research", "parent_id": outer["id"]})["item"]
    page = _call("library.create_page", {"title": "NVIDIA", "parent_id": inner["id"]})["item"]

    listed = _call("library.list", {"parent_id": inner["id"]})
    assert [i["id"] for i in listed["items"]] == [page["id"]]
    assert [c["id"] for c in listed["trail"]] == [outer["id"], inner["id"]]
    assert [c["id"] for c in _call("library.get", {"id": page["id"]})["trail"]] == [outer["id"], inner["id"]]


def test_edited_text_replaces_the_file_and_its_search_text():
    note = _call("library.import", {"file_name": "todo.md",
                                    "data_url": "data:text/markdown;base64," + base64.b64encode(b"buy milk").decode()})
    item_id = note["item"]["id"]

    _call("library.write_text", {"id": item_id, "text": "renew passport"})

    assert Path(_call("library.get", {"id": item_id})["item"]["path"]).read_text() == "renew passport"
    assert [h["id"] for h in _call("library.list", {"query": "passport"})["items"]] == [item_id]
    assert _call("library.list", {"query": "milk"})["items"] == []


def test_read_arrives_in_slices_that_rebuild_any_size():
    payload = bytes(range(256)) * (40 * 1024)  # 10 MB: more than one slice
    data_url = "data:application/pdf;base64," + base64.b64encode(payload).decode()
    item = _call("library.import", {"file_name": "big.pdf", "data_url": data_url})["item"]

    rebuilt, offset = b"", 0
    while True:
        part = _call("library.read", {"id": item["id"], "offset": offset})
        chunk = base64.b64decode(part["data"])
        assert part["size"] == len(payload) and part["offset"] == offset
        if not chunk:
            break
        rebuilt += chunk
        offset += len(chunk)

    assert rebuilt == payload



def test_an_edited_image_replaces_the_bytes_and_the_old_ones_stay_a_version():
    original = b"\x89PNG\r\n\x1a\n-original-"
    edited = b"\x89PNG\r\n\x1a\n-cropped-"
    item = _call("library.import", {"file_name": "photo.png", "data_url": "data:image/png;base64," + base64.b64encode(original).decode()})["item"]

    saved = _call("library.write_file", {"id": item["id"], "data_url": "data:image/png;base64," + base64.b64encode(edited).decode()})["item"]

    assert saved["id"] == item["id"] and Path(saved["path"]).read_bytes() == edited
    versions = _call("library.versions", {"id": item["id"]})["versions"]
    assert len(versions) == 1
    page = _call("library.create_page", {"title": "A page"})["item"]
    resp = server._methods["library.write_file"](1, {"id": page["id"], "data_url": "data:image/png;base64,AAAA"})
    assert "error" in resp
