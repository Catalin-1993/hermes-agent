"""Brain's notebook (the second library): the two spaces stay apart, pages are kept under one key, what the
owner edited or deleted is respected, and "About you" is the real memory."""

import json
import time

import pytest

from hermes_cli import library_db as ldb
from hermes_cli import library_notebook as nb
from hermes_cli import library_notebook_about as about
from hermes_cli import library_notebook_scribe as scribe


@pytest.fixture
def conn():
    with ldb.connect_closing() as c:
        nb.ensure_schema(c)
        yield c


def _conversation(conn, sid="s1", summary="We chose Postgres.", parent=None):
    return nb.upsert_page(
        conn, key=f"conversation:{sid}", kind="conversation", title="Database choice", parent=parent,
        state={"title": "Database choice", "summary": summary, "decisions": [{"text": "Use Postgres", "why": "it scales"}],
               "next": ["Write the schema"], "learned": [], "details": "", "date": time.time()},
        note=summary)


def test_the_two_libraries_never_mix(conn):
    mine = ldb.create_page(conn, title="Mine", markdown="my own")
    folder = nb.ensure_folder(conn, "projects", "Projects")
    notes = _conversation(conn, parent=folder)

    assert [i.id for i in ldb.list_items(conn)] == [mine.id]
    assert {i.id for i in ldb.list_items(conn, space="agent")} >= {notes.id, folder}
    assert notes.space == "agent" and notes.created_by == "agent" and notes.visibility == "open"
    # Something made inside Brain's folder belongs to Brain's notebook, and cannot be moved out of it.
    inside = ldb.create_page(conn, title="Mine too", parent_id=folder)
    assert inside.space == "agent"
    with pytest.raises(ValueError):
        ldb.move_items(conn, [mine.id], folder)


def test_a_key_keeps_one_page_and_rewrites_it(conn):
    first = _conversation(conn, summary="First version.")
    second = _conversation(conn, summary="Second version.")

    assert first.id == second.id
    assert "Second version." in second.markdown and "First version." not in second.markdown
    assert len([i for i in ldb.list_items(conn, space="agent", kind="page")]) == 1


def test_a_page_the_owner_edited_is_never_rewritten(conn):
    page = _conversation(conn, summary="Brain's words.")
    ldb.update_item(conn, page.id, markdown=page.markdown.replace("Use Postgres", "Use SQLite"))

    after = _conversation(conn, summary="Brain returns with news.")

    assert "Use SQLite" in after.markdown and "Use Postgres" not in after.markdown
    assert "Brain returns with news." in after.markdown.split("## Brain's updates")[1]
    # And it stays the owner's from then on.
    again = _conversation(conn, summary="Even more news.")
    assert "Use SQLite" in again.markdown and "Even more news." in again.markdown


def test_what_the_owner_deleted_does_not_come_back(conn):
    page = _conversation(conn)
    ldb.trash_item(conn, page.id)
    nb.user_deleted(conn, page)

    assert _conversation(conn, summary="Again.") is None
    ldb.trash_item(conn, page.id, restore=True)
    nb.user_restored(conn, page)
    assert _conversation(conn, summary="Back.") is not None


def test_the_fixed_pages_follow_the_language_unless_renamed(conn):
    ids = nb.ensure_skeleton(conn)
    assert ldb.get_item(conn, ids["about"]).title == "About you"

    nb.set_language(conn, "ro")
    nb.ensure_skeleton(conn)
    assert ldb.get_item(conn, ids["about"]).title == "Despre tine"
    assert ldb.get_item(conn, ids["projects"]).title == "Proiecte"

    ldb.update_item(conn, ids["topics"], title="My ideas")
    nb.set_language(conn, "de")
    nb.ensure_skeleton(conn)
    assert ldb.get_item(conn, ids["topics"]).title == "My ideas"


def test_about_you_is_the_real_memory_both_ways(conn, monkeypatch):
    from tools.memory_tool import load_on_disk_store

    store = load_on_disk_store()
    assert store.add("user", "Prefers short answers")["success"]
    assert store.add("memory", "Works on a trading app")["success"]

    page = about.refresh(conn)
    assert "Prefers short answers" in page.markdown and "Works on a trading app" in page.markdown

    # The owner corrects one line, deletes one and adds one.
    edited = page.markdown.replace("Prefers short answers", "Prefers short, plain answers")
    edited = edited.replace("- Works on a trading app\n", "") + "\n"
    ldb.update_item(conn, page.id, markdown=edited.replace("## Brain's own notes", "## Brain's own notes\n\n- Lives in Cluj"))
    nb.user_edited(conn, ldb.get_item(conn, page.id))

    fresh = load_on_disk_store()
    assert fresh.user_entries == ["Prefers short, plain answers"]
    assert fresh.memory_entries == ["Lives in Cluj"]
    # The page is drawn again from the memory it now matches.
    assert "Lives in Cluj" in about.refresh(conn).markdown


def test_the_models_answer_is_cut_down_to_what_the_pages_expect():
    raw = "```json\n" + json.dumps({
        "language": "RO", "conversation": {"title": "T" * 200, "summary": "Ok.", "next": ["a", "", "b"],
                                           "decisions": ["plain", {"text": "x", "why": "y"}], "unknown": 1},
        "project": {"status": "weird", "summary": "S", "log": "did it"},
        "topics": [{"name": "Crypto", "points": ["p"]}, "junk", {"name": ""}]}) + "\n```"

    answer = scribe.parse_answer(raw)

    assert answer["language"] == "ro" and len(answer["conversation"]["title"]) == 90
    assert answer["conversation"]["next"] == ["a", "b"]
    assert answer["conversation"]["decisions"][0] == {"text": "plain", "why": ""}
    assert answer["project"]["status"] == "active"
    assert [t["name"] for t in answer["topics"]] == ["Crypto"]
    assert scribe.parse_answer("not json") is None
    assert scribe.parse_answer(json.dumps({"conversation": {"summary": ""}})) is None


def test_a_conversation_lands_in_its_conversation_project_and_topic_pages(conn, monkeypatch):
    monkeypatch.setattr(scribe, "_project_of", lambda row: {"name": "Trading app", "slug": "trading-app"})
    answer = scribe.parse_answer(json.dumps({
        "language": "ro", "conversation": {"title": "Alegem baza de date", "summary": "Am ales Postgres.",
                                           "next": ["Scrie schema"]},
        "project": {"status": "active", "summary": "Aplicația avansează.", "next": ["Scrie schema"], "log": "Am ales baza"},
        "topics": [{"name": "Baze de date", "summary": "Despre Postgres.", "points": ["Postgres scalează"]}]}))

    scribe.write_answer(conn, {"id": "s9", "last_active": time.time(), "title": "x"}, answer)
    scribe.refresh_overview(conn)

    titles = {i.title for i in ldb.list_items(conn, space="agent", kind="page")}
    assert {"Alegem baza de date", "Trading app", "Baze de date", "Ce urmează", "Începe aici"} <= titles
    project = next(i for i in ldb.list_items(conn, space="agent", kind="page") if i.title == "Trading app")
    assert "În lucru" in project.markdown and "Scrie schema" in project.markdown
    todo = next(i for i in ldb.list_items(conn, space="agent", kind="page") if i.title == "Ce urmează")
    assert "Trading app" in todo.markdown and "- [ ] Scrie schema" in todo.markdown


def test_only_quiet_conversations_with_something_new_are_picked(conn):
    now = time.time()

    class Db:
        def list_sessions_rich(self, **_):
            return [{"id": "quiet", "last_active": now - 4000, "message_count": 8},
                    {"id": "busy", "last_active": now - 60, "message_count": 8},
                    {"id": "done", "last_active": now - 4000, "message_count": 8},
                    {"id": "grown", "last_active": now - 4000, "message_count": 12}]

    for sid, count in (("done", 8), ("grown", 8)):
        conn.execute("INSERT INTO notebook_sessions VALUES (?, ?, ?)", (sid, count, 1))
    conn.execute("INSERT INTO notebook_ignored VALUES ('session:quiet')")
    conn.commit()

    assert [r["id"] for r in scribe.pending_sessions(conn, Db(), idle_seconds=1800, min_messages=4)] == ["grown"]
