"""Organizing the Library: versions survive a replace and a restore is itself undoable; tags follow
renames and never count as edits; access flows from a folder to what inherits it."""

from pathlib import Path

import pytest

from hermes_cli import library_db as ldb, library_tags, library_versions


@pytest.fixture
def conn():
    with ldb.connect_closing() as c:
        yield c


def test_a_replaced_file_keeps_its_old_bytes_and_a_restore_can_be_undone(conn, tmp_path):
    src = tmp_path / "plan.txt"
    src.write_text("first draft")
    item = ldb.save_file(conn, file_name=src.name, source_path=str(src))

    ldb.replace_file(conn, item.id, data=b"second draft")
    [old] = library_versions.list_versions(conn, item.id)
    assert old["size"] == len("first draft")

    restored = library_versions.restore(conn, ldb.get_item(conn, item.id), old["id"])
    assert Path(restored.path).read_text() == "first draft"
    # What was current before the restore is a version now.
    assert len(library_versions.list_versions(conn, item.id)) == 2

    ldb.purge_item(conn, item.id)
    assert library_versions.list_versions(conn, item.id) == []
    assert not any(ldb.library_derived_dir("versions").iterdir())


def test_tags_follow_a_rename_filter_listings_and_are_not_edits(conn):
    a = ldb.create_page(conn, title="A")
    b = ldb.create_page(conn, title="B")

    library_tags.tag_items(conn, [a.id, b.id], "Urgent", on=True)
    library_tags.tag_items(conn, [b.id], "urgent", on=False)

    assert [i.id for i in ldb.list_items(conn, tag="URGENT")] == [a.id]
    assert ldb.get_item(conn, a.id).updated_at == a.updated_at
    library_tags.update_tag(conn, "Urgent", new_name="Today", color="blue")
    assert ldb.get_item(conn, a.id).to_dict()["tags"] == ["Today"]
    assert library_tags.list_tags(conn) == [{"name": "Today", "color": "blue", "count": 1}]
    library_tags.delete_tag(conn, "today")
    assert ldb.get_item(conn, a.id).to_dict()["tags"] == []


def test_access_flows_from_a_folder_to_what_inherits_it(conn):
    folder = ldb.create_folder(conn, title="Shared", visibility="open")
    inherits = ldb.create_page(conn, title="Notes", parent_id=folder.id)
    kept = ldb.create_page(conn, title="Secret", parent_id=folder.id, visibility="private")
    assert inherits.visibility == "open"

    ldb.update_item(conn, folder.id, visibility="ask")

    assert ldb.get_item(conn, inherits.id).visibility == "ask"
    assert ldb.get_item(conn, kept.id).visibility == "private"


def test_items_go_out_to_a_chat_under_the_names_the_user_knows(conn, tmp_path):
    from hermes_cli import library_export

    src = tmp_path / "Q3 report.pdf"
    src.write_bytes(b"%PDF q3")
    report = ldb.save_file(conn, file_name=src.name, source_path=str(src))
    page = ldb.create_page(conn, title="Plan: Q4/2026", markdown="- ship it")

    attached = library_export.export_path(report)
    note = library_export.export_path(page)

    assert attached.name == "Q3 report.pdf" and attached.read_bytes() == b"%PDF q3"
    assert note.name == "Plan_ Q4_2026.md" and "- ship it" in note.read_text()
    ldb.purge_item(conn, report.id)
    assert not attached.exists()
