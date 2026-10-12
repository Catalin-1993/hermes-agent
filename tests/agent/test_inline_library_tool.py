"""The inline Library executor hands the tool everything the model sent (a block's ``html`` too) and the
conversation it runs in, so what Hermes makes in a chat can be found from that chat."""

import json
from types import SimpleNamespace

from agent.inline_tool_executors import INLINE_TOOL_EXECUTORS, InlineToolContext
from hermes_cli import library_db as ldb


def test_hermes_work_carries_its_html_and_remembers_the_chat():
    agent = SimpleNamespace(session_id="sess-42", library_consent_callback=lambda payload: {"approved": True})
    ctx = InlineToolContext(effective_task_id="task-1", tool_call_id="call-1")

    def call(**args):
        return json.loads(INLINE_TOOL_EXECUTORS["library"](agent, args, ctx))

    page = call(action="create", title="Launch plan", markdown="Goals")["created"]
    block = call(action="block", id=page["id"], title="Budget", html="<!doctype html><p>Budget</p>")
    assert block["success"], block

    with ldb.connect_closing() as conn:
        made = [ldb.get_item(conn, page["id"]), ldb.get_item(conn, block["block"]["id"])]
        assert [item.session_id for item in made] == ["sess-42", "sess-42"]
        assert "<p>Budget</p>" in open(made[1].path, encoding="utf-8").read()

        # The owner's own edits are not Hermes's work: they leave the chat link as it was.
        mine = ldb.create_page(conn, title="Mine")
        ldb.update_item(conn, mine.id, markdown="by hand")
        assert ldb.get_item(conn, mine.id).session_id is None
