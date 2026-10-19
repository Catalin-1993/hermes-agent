"""The owner edits a page on the Library consent card before approving it; the edit is what gets saved."""

import json

import pytest


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    return tmp_path


def _approve(edits=None):
    seen = {}

    def callback(payload):
        seen.update(payload)
        return {"approved": True, **(edits or {})}

    return callback, seen


def _page(item_id):
    from hermes_cli import library_db as ldb
    with ldb.connect_closing() as conn:
        return ldb.get_item(conn, item_id)


def test_the_card_carries_the_whole_page_and_saves_the_owner_edit(home):
    from tools.library_tool import library_create
    callback, seen = _approve({"title": "Plan corectat", "content": "# Plan\n\nVarianta lui Vasi."})
    result = json.loads(library_create("Plan", markdown="# Plan\n\n" + "x" * 3000, callback=callback))

    assert seen["editable"] is True and seen["content"].endswith("x" * 3000)
    assert result["edited_by_owner"] is True
    page = _page(result["created"]["id"])
    assert (page.title, page.markdown) == ("Plan corectat", "# Plan\n\nVarianta lui Vasi.")


def test_an_approval_without_edits_saves_the_proposal(home):
    from tools.library_tool import library_create
    callback, _seen = _approve()
    result = json.loads(library_create("Note", markdown="body", callback=callback))

    assert result["edited_by_owner"] is False
    assert _page(result["created"]["id"]).markdown == "body"


def test_an_edited_append_is_what_is_added(home):
    from tools.library_tool import library_create, library_update
    callback, _ = _approve()
    created = json.loads(library_create("Jurnal", markdown="Ziua 1", callback=callback))["created"]
    edit, seen = _approve({"content": "Ziua 2 (corectat)"})
    result = json.loads(library_update(created["id"], markdown="Ziua 2", mode="append", callback=edit))

    assert seen["content"] == "Ziua 2" and result["edited_by_owner"] is True
    assert _page(created["id"]).markdown == "Ziua 1\n\nZiua 2 (corectat)"
