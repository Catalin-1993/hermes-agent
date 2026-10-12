"""Library store contracts: the visibility filter, the two page renditions staying in step, and file
bytes following their item through trash and purge."""

import os
from pathlib import Path

import pytest

from hermes_cli import library_db as ldb


@pytest.fixture
def conn():
    with ldb.connect_closing() as c:
        yield c


def test_agent_visibility_filter_never_returns_private_items(conn):
    secret = ldb.create_page(conn, title="Diary", markdown="the launch plan", visibility="private")
    asked = ldb.create_page(conn, title="Budget", markdown="the launch plan", visibility="ask")
    opened = ldb.create_page(conn, title="Roadmap", markdown="the launch plan", visibility="open")

    agent_view = ldb.list_items(conn, query="launch", visibilities=("ask", "open"))

    assert {i.id for i in agent_view} == {asked.id, opened.id}
    assert secret.id not in {i.id for i in ldb.list_items(conn, visibilities=("open", "ask"))}
    # The owner's own view is unfiltered.
    assert secret.id in {i.id for i in ldb.list_items(conn, query="launch")}


def test_markdown_only_write_retires_the_block_document(conn):
    page = ldb.create_page(conn, title="Notes", content='[{"type":"paragraph"}]', markdown="old")

    agent_edit = ldb.update_item(conn, page.id, markdown="new body")
    assert agent_edit.markdown == "new body" and agent_edit.content is None

    editor_save = ldb.update_item(conn, page.id, content='[{"type":"heading"}]', markdown="# Heading")
    assert editor_save.content == '[{"type":"heading"}]' and editor_save.markdown == "# Heading"


def test_file_bytes_follow_their_item_through_trash_and_purge(conn, tmp_path):
    page = ldb.create_page(conn, title="Trip")
    src = tmp_path / "photo.PNG"
    src.write_bytes(b"\x89PNG....")
    photo = ldb.save_file(conn, file_name=src.name, source_path=str(src), parent_id=page.id)

    stored = Path(photo.path)
    assert stored.read_bytes() == src.read_bytes()
    assert photo.mime == "image/png" and photo.size == src.stat().st_size

    ldb.trash_item(conn, page.id)
    # The Trash lists what was deleted; the photo travels with its page.
    assert {i.id for i in ldb.list_items(conn, trashed=True)} == {page.id}
    assert ldb.get_item(conn, photo.id).trashed_at is not None
    ldb.trash_item(conn, page.id, restore=True)
    assert {i.id for i in ldb.list_items(conn)} >= {page.id, photo.id}

    renditions = [ldb.library_derived_dir("previews") / f"{photo.id}.{ext}" for ext in ("pdf", "json")]
    for rendition in renditions:
        rendition.parent.mkdir(parents=True, exist_ok=True)
        rendition.write_bytes(b"derived")

    ldb.purge_item(conn, page.id)
    assert ldb.get_item(conn, photo.id) is None and not stored.exists()
    assert not any(r.exists() for r in renditions)


def test_an_edit_made_in_another_app_is_taken_in(conn, tmp_path):
    src = tmp_path / "notes.txt"
    src.write_text("first")
    item = ldb.save_file(conn, file_name=src.name, source_path=str(src))
    assert ldb.reconcile_external_edit(conn, item) is None

    stored = Path(item.path)
    stored.write_text("second, longer")
    later = item.updated_at + 5
    os.utime(stored, (later, later))

    edited = ldb.reconcile_external_edit(conn, ldb.get_item(conn, item.id))
    assert edited is not None and edited.size == stored.stat().st_size and edited.status == "pending"
    assert edited.sha256 != item.sha256 and edited.updated_at == later
    assert ldb.reconcile_external_edit(conn, edited) is None


def test_search_treats_wildcards_as_text(conn):
    literal = ldb.create_page(conn, title="100% done")
    ldb.create_page(conn, title="1000 done")

    assert [i.id for i in ldb.list_items(conn, query="100%")] == [literal.id]


def test_invalid_visibility_is_refused(conn):
    page = ldb.create_page(conn, title="x")
    with pytest.raises(ValueError):
        ldb.update_item(conn, page.id, visibility="public")


def test_excerpt_reads_as_prose_not_markdown(conn):
    page = ldb.create_page(conn, title="Plan", markdown="## Goals\n\n- Ship the **Library**\n- [ ] Tidy up\n![shot](library://fl_1)")

    assert page.excerpt == "Goals Ship the Library Tidy up shot"

    table = ldb.create_page(conn, title="Risks", markdown="| Risk | Impact |\n| --- | :---: |\n| Delay | High |\n\n---\n\nEnd")

    assert table.excerpt == "Risk Impact Delay High End"


def test_folders_hold_the_tree_and_refuse_impossible_moves(conn):
    research = ldb.create_folder(conn, title="Research")
    reports = ldb.create_folder(conn, title="Reports", parent_id=research.id)
    page = ldb.create_page(conn, title="Notes", parent_id=reports.id)

    with pytest.raises(ValueError):
        ldb.create_folder(conn, title="Inside a page", parent_id=page.id)
    with pytest.raises(ValueError):
        ldb.move_items(conn, [research.id], reports.id)

    ldb.move_items(conn, [page.id], "")
    assert [i.id for i in ldb.ancestors(conn, reports.id)] == [research.id]
    assert {i.id for i in ldb.list_items(conn, parent_id="")} == {research.id, page.id}
    assert ldb.list_items(conn, parent_id="")[0].kind == "folder"


def test_trash_takes_the_subtree_and_restore_brings_back_only_what_went_with_it(conn, tmp_path):
    folder = ldb.create_folder(conn, title="Trip")
    inner = ldb.create_folder(conn, title="Photos", parent_id=folder.id)
    src = tmp_path / "beach.png"
    src.write_bytes(b"\x89PNG beach")
    photo = ldb.save_file(conn, file_name=src.name, source_path=str(src), parent_id=inner.id)
    gone_before = ldb.create_page(conn, title="Old note", parent_id=folder.id)
    ldb.trash_item(conn, gone_before.id)

    ldb.trash_item(conn, folder.id)
    assert {i.id for i in ldb.list_items(conn, trashed=True)} == {folder.id, gone_before.id}

    ldb.trash_item(conn, folder.id, restore=True)
    assert ldb.get_item(conn, photo.id).trashed_at is None
    assert ldb.get_item(conn, gone_before.id).trashed_at is not None

    stored = Path(photo.path)
    ldb.trash_item(conn, folder.id)
    ldb.purge_item(conn, folder.id)
    assert ldb.get_item(conn, photo.id) is None and not stored.exists()


def test_duplicates_are_recognised_by_bytes_and_by_name(conn, tmp_path):
    folder = ldb.create_folder(conn, title="Reports")
    first = tmp_path / "q1.pdf"
    first.write_bytes(b"%PDF quarter one")
    saved = ldb.save_file(conn, file_name="q1.pdf", source_path=str(first), parent_id=folder.id)

    size, digest = ldb.file_digest(source_path=str(first))
    kind, clash = ldb.find_conflict(conn, file_name="copy.pdf", size=size, sha256=digest, parent_id=None)
    assert (kind, clash.id) == ("content", saved.id)

    size, digest = ldb.file_digest(data=b"%PDF a different quarter")
    kind, clash = ldb.find_conflict(conn, file_name="Q1.pdf", size=size, sha256=digest, parent_id=folder.id)
    assert (kind, clash.id) == ("name", saved.id)
    assert ldb.unique_name(conn, "q1.pdf", folder.id) == "q1 (2).pdf"

    replaced = ldb.replace_file(conn, saved.id, data=b"%PDF a different quarter")
    assert replaced.id == saved.id and Path(replaced.path).read_bytes() == b"%PDF a different quarter"


def test_a_copy_takes_everything_below_and_its_links_follow(conn, tmp_path):
    folder = ldb.create_folder(conn, title="Plans")
    page = ldb.create_page(conn, title="Q4", parent_id=folder.id)
    sub = ldb.create_page(conn, title="Hiring", parent_id=page.id)
    src = tmp_path / "chart.png"
    src.write_bytes(b"\x89PNG chart")
    chart = ldb.save_file(conn, file_name=src.name, source_path=str(src), parent_id=page.id)
    links = f'[{{"type": "page", "props": {{"pageId": "{sub.id}"}}}}, "library://{chart.id}"]'
    with ldb.write_txn(conn):
        conn.execute("UPDATE library_items SET content = ? WHERE id = ?", (links, page.id))

    [twin] = ldb.copy_items(conn, [page.id], in_place=True)

    assert twin.title == "Q4 (2)" and twin.parent_id == folder.id
    children = {c.title or c.file_name: c for c in ldb.list_items(conn, parent_id=twin.id)}
    assert set(children) == {"Hiring", "chart.png"}
    assert Path(children["chart.png"].path).read_bytes() == src.read_bytes()
    copied = ldb.get_item(conn, twin.id).content
    assert children["Hiring"].id in copied and children["chart.png"].id in copied
    assert sub.id not in copied and chart.id not in copied
    assert ldb.get_item(conn, page.id).content == links


def test_a_page_cover_is_kept_cleared_and_follows_its_image_into_a_copy(conn, tmp_path):
    page = ldb.create_page(conn, title="Trip")
    src = tmp_path / "beach.jpg"
    src.write_bytes(b"\xff\xd8 beach")
    photo = ldb.save_file(conn, file_name=src.name, source_path=str(src), parent_id=page.id)

    covered = ldb.update_item(conn, page.id, cover=f"image:{photo.id}@40")
    assert covered.to_dict()["cover"] == f"image:{photo.id}@40"

    [twin] = ldb.copy_items(conn, [page.id], in_place=True)
    [twin_photo] = ldb.list_items(conn, parent_id=twin.id)
    assert twin.cover == f"image:{twin_photo.id}@40"

    assert ldb.update_item(conn, page.id, cover="").cover is None
    assert ldb.get_item(conn, twin.id).cover == f"image:{twin_photo.id}@40"


def test_a_presentations_marker_is_not_part_of_its_reading_text(conn):
    deck = ldb.create_page(conn, title="Pitch", markdown="<!-- hermes:deck theme=ink -->\n\n# Launch\n\nQ4\n\n---\n\n## Goals")

    assert "hermes:deck" not in deck.excerpt and deck.excerpt.startswith("Launch")


def test_a_presentation_lists_with_its_theme_and_first_slide_only(conn):
    deck = ldb.create_page(conn, title="Pitch", markdown="<!-- hermes:deck theme=ocean -->\n\n# Launch\n\nQ4\n\n---\n\n## Goals")
    plain = ldb.create_page(conn, title="Notes", markdown="# Launch\n\n---\n\nmore")

    assert deck.to_dict()["deck"] == {"theme": "ocean", "slide": "# Launch\n\nQ4"}
    assert "deck" not in plain.to_dict()
