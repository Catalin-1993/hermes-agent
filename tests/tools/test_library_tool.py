"""Library tool consent contracts: private items stay invisible, `open` reads never ask, `ask` reads
and every write go through the owner's card, and no card (non-desktop) means refusal."""

import json

import pytest

from hermes_cli import library_db as ldb
from tools import library_tool as lt


class Card:
    """The owner's consent card: records what was asked, answers with ``approve``."""

    def __init__(self, approve: bool):
        self.approve, self.asked = approve, []

    def __call__(self, payload: dict) -> dict:
        self.asked.append(payload)
        return {"approved": self.approve}


@pytest.fixture
def items():
    with ldb.connect_closing() as conn:
        return {v: ldb.create_page(conn, title=f"{v} plan", markdown=f"{v} launch notes", visibility=v)
                for v in ldb.VISIBILITIES}


def test_private_items_are_invisible_even_to_an_approved_search(items):
    card = Card(approve=True)
    found = json.loads(lt.library_search("launch", include_protected=True, callback=card))

    ids = {i["id"] for i in found["items"]}
    assert items["private"].id not in ids and {items["ask"].id, items["open"].id} <= ids
    read = json.loads(lt.library_read(items["private"].id, callback=card))
    assert read["success"] is False and len(card.asked) == 1  # only the search asked


def test_open_reads_never_ask_and_ask_reads_always_do(items):
    card = Card(approve=False)

    assert json.loads(lt.library_read(items["open"].id, callback=card))["markdown"] == "open launch notes"
    assert card.asked == []

    declined = json.loads(lt.library_read(items["ask"].id, callback=card))
    assert declined["success"] is False and "markdown" not in declined
    assert card.asked[0]["action"] == "read" and card.asked[0]["target"]["id"] == items["ask"].id


@pytest.mark.parametrize("approve", [True, False])
def test_every_write_is_decided_by_the_owner(items, approve):
    card = Card(approve=approve)
    target = items["open"]  # open still needs consent to be written

    lt.library_update(target.id, markdown="rewritten", callback=card)
    lt.library_create("From Hermes", markdown="hello", callback=card)
    lt.library_delete(items["ask"].id, callback=card)

    assert [a["action"] for a in card.asked] == ["update", "create", "delete"]
    with ldb.connect_closing() as conn:
        assert (ldb.get_item(conn, target.id).markdown == "rewritten") is approve
        assert bool(ldb.list_items(conn, query="From Hermes")) is approve
        assert (ldb.get_item(conn, items["ask"].id).trashed_at is not None) is approve


def test_without_a_consent_card_protected_reads_and_writes_are_refused(items):
    assert json.loads(lt.library_read(items["ask"].id, callback=None))["success"] is False
    assert json.loads(lt.library_create("x", callback=None))["success"] is False
    with ldb.connect_closing() as conn:
        assert not ldb.list_items(conn, query="x", kind="page", visibilities=("ask",)) or all(
            i.title != "x" for i in ldb.list_items(conn))


def test_a_failing_bridge_is_a_refusal_not_consent(items):
    def broken(_payload):
        raise RuntimeError("socket closed")

    result = json.loads(lt.library_update(items["open"].id, markdown="gone", callback=broken))
    assert result["success"] is False
    with ldb.connect_closing() as conn:
        assert ldb.get_item(conn, items["open"].id).markdown == "open launch notes"


def test_every_consent_payload_fits_the_wire_contract(items):
    """The card only renders what the gateway accepts: each payload the tool can send must validate
    against ``library.consent``'s params once the transport adds the session id."""
    from tui_gateway.contracts.library import LibraryConsentParams

    card = Card(approve=False)
    lt.library_search("plan", include_protected=True, reason="find the plan", callback=card)
    lt.library_read(items["ask"].id, callback=card)
    lt.library_create("New", markdown="body", callback=card)
    lt.library_update(items["open"].id, markdown="x", title="Renamed", mode="append", callback=card)
    lt.library_delete(items["open"].id, callback=card)

    assert len(card.asked) == 5
    for payload in card.asked:
        LibraryConsentParams.model_validate({**payload, "session_id": "sid-1"})


DOC = "<!doctype html><title>ROI calculator</title><input id=c><script>1</script>"


def test_a_block_is_added_to_a_page_without_flattening_what_the_owner_arranged(items):
    page = items["open"]
    arranged = json.dumps([{"id": "b1", "type": "page", "props": {"pageId": "sub", "title": "Sub"}, "children": []}])
    with ldb.connect_closing() as conn:
        ldb.update_item(conn, page.id, content=arranged, markdown="open launch notes\n\n[Sub](library://sub)")
    card = Card(approve=True)

    result = json.loads(lt.library_block(page.id, html=DOC, callback=card))

    assert result["success"] is True and card.asked[0]["action"] == "create"
    block = result["block"]
    with ldb.connect_closing() as conn:
        after = ldb.get_item(conn, page.id)
        file = ldb.get_item(conn, block["id"])
    blocks = json.loads(after.content)
    assert [b["type"] for b in blocks] == ["page", "interactive"]  # the sub-page block is still a block
    assert blocks[1]["props"]["fileId"] == file.id and blocks[1]["props"]["title"] == "ROI calculator"
    assert after.markdown.endswith(f"[ROI calculator](library://{file.id})")
    assert file.parent_id == page.id and file.file_name == "ROI calculator.html" and file.created_by == "agent"
    assert lt._read_text(file) == DOC


def test_a_markdown_only_page_gets_the_block_as_a_link_the_editor_turns_back_into_a_block(items):
    page = items["ask"]
    result = json.loads(lt.library_block(page.id, html=DOC, title="Calc [v2]", callback=Card(approve=True)))

    with ldb.connect_closing() as conn:
        after = ldb.get_item(conn, page.id)
    assert after.content is None
    assert after.markdown.endswith(f"[Calc v2](library://{result['block']['id']})")


def test_a_block_is_changed_in_place_and_the_old_document_is_kept(items):
    page = items["open"]
    block = json.loads(lt.library_block(page.id, html=DOC, callback=Card(approve=True)))["block"]
    card = Card(approve=True)

    result = json.loads(lt.library_block(block["id"], html=DOC.replace("ROI", "Payback"), callback=card))

    assert result["success"] is True and card.asked[0]["action"] == "update"
    with ldb.connect_closing() as conn:
        file = ldb.get_item(conn, block["id"])
        from hermes_cli import library_versions

        assert len(library_versions.list_versions(conn, file.id)) == 1
    assert "Payback" in lt._read_text(file)
    assert "Payback" in json.loads(lt.library_read(block["id"], callback=Card(approve=True)))["html"]


@pytest.mark.parametrize("approve", [False, None])
def test_a_block_needs_the_owners_yes(items, approve):
    page = items["open"]
    card = Card(approve=bool(approve)) if approve is not None else None

    result = json.loads(lt.library_block(page.id, html=DOC, callback=card))

    assert result["success"] is False
    with ldb.connect_closing() as conn:
        assert ldb.list_items(conn, parent_id=page.id) == []


def test_a_block_refuses_what_it_cannot_hold(items):
    card = Card(approve=True)
    page = items["open"]

    assert json.loads(lt.library_block(page.id, html="  ", callback=card))["success"] is False
    assert json.loads(lt.library_block(page.id, html="x" * (lt._BLOCK_MAX_CHARS + 1), callback=card))["success"] is False
    assert json.loads(lt.library_block(items["private"].id, html=DOC, callback=card))["success"] is False
    assert card.asked == []
    with ldb.connect_closing() as conn:
        notes = ldb.save_file(conn, file_name="notes.txt", data=b"hi", visibility="open")
    assert json.loads(lt.library_block(notes.id, html=DOC, callback=card))["success"] is False


def test_block_consent_payloads_fit_the_wire_contract(items):
    from tui_gateway.contracts.library import LibraryConsentParams

    card = Card(approve=True)
    block = json.loads(lt.library_block(items["open"].id, html=DOC, reason="build it", callback=card))["block"]
    lt.library_block(block["id"], html=DOC + "<!-- v2 -->", callback=card)

    assert len(card.asked) == 2
    for payload in card.asked:
        LibraryConsentParams.model_validate({**payload, "session_id": "sid-1"})


NET_DOC = '<!doctype html><title>Rates</title><meta name="hermes:network" content="api.frankfurter.dev"><p>x</p>'


def test_a_block_that_asks_for_the_network_says_so_on_the_consent_card(items):
    card = Card(approve=True)

    assert json.loads(lt.library_block(items["open"].id, html=NET_DOC, callback=card))["success"] is True

    changes = " ".join(card.asked[0]["changes"])
    assert "api.frankfurter.dev" in changes and "separately" in changes and "no network" not in changes


@pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "192.168.1.5", "*.example.com", "nas.local", "a.com:8080", "https://a.com"])
def test_a_block_may_not_ask_to_reach_the_owners_own_machine_or_network(items, host):
    card = Card(approve=True)
    doc = f'<title>x</title><meta name="hermes:network" content="{host}"><p>x</p>'

    result = json.loads(lt.library_block(items["open"].id, html=doc, callback=card))

    assert result["success"] is False and "public https hosts" in result["error"]
    assert card.asked == []  # refused before the owner is bothered
    with ldb.connect_closing() as conn:
        assert ldb.list_items(conn, parent_id=items["open"].id) == []


def test_the_network_rule_matches_what_the_renderer_enforces():
    hosts, invalid = lt._network_hosts(
        '<meta content="api.frankfurter.dev CDN.Example.org, api.frankfurter.dev nas.local" name=\'hermes:network\'>')

    assert hosts == ["api.frankfurter.dev", "cdn.example.org"] and invalid == ["nas.local"]
    assert lt._network_hosts("<p>offline</p>") == ([], [])
    assert len(lt._network_hosts(f'<meta name="hermes:network" content="{" ".join(f"h{n}.example.org" for n in range(12))}">')[0]) == 8


def test_one_step_back_after_an_agent_edit_is_the_page_the_owner_left(items):
    page = items["open"]
    with ldb.connect_closing() as conn:
        # The owner edits, then Hermes edits moments later — inside the editor's snapshot interval.
        ldb.update_item(conn, page.id, markdown="first draft")
        ldb.update_item(conn, page.id, markdown="owner's latest words")

    json.loads(lt.library_update(page.id, markdown="Hermes rewrote this", callback=Card(approve=True)))

    from hermes_cli import library_versions
    with ldb.connect_closing() as conn:
        latest = library_versions.list_versions(conn, page.id)[0]
        assert latest["markdown"] == "owner's latest words"
        assert ldb.get_item(conn, page.id).markdown == "Hermes rewrote this"


def test_a_file_hermes_made_enters_the_library_only_with_the_owners_yes(items, tmp_path):
    made = tmp_path / "logo-no-bg.png"
    made.write_bytes(b"\x89PNG\r\n\x1a\n-pixels-")

    refused = Card(approve=False)
    assert json.loads(lt.library_import(str(made), callback=refused))["success"] is False
    asked = refused.asked[0]
    assert asked["target"]["kind"] == "file" and "KB" in asked["changes"][0]

    approved = Card(approve=True)
    done = json.loads(lt.library_import(str(made), title="Logo — no background.png", callback=approved,
                                        session_id="sess-9"))
    assert done["success"] is True and done["created"]["kind"] == "file"
    with ldb.connect_closing() as conn:
        item = ldb.get_item(conn, done["created"]["id"])
    assert item.visibility == "ask" and item.session_id == "sess-9" and item.created_by == "agent"
    assert item.file_name == "Logo — no background.png"
    assert open(item.path, "rb").read() == made.read_bytes()

    from tui_gateway.contracts.library import LibraryConsentParams
    LibraryConsentParams.model_validate({**approved.asked[0], "session_id": "sid-1"})


def test_the_library_will_not_take_a_credential_file_or_a_relative_path(items, tmp_path, monkeypatch):
    card = Card(approve=True)
    assert json.loads(lt.library_import("notes.txt", callback=card))["success"] is False
    from hermes_constants import get_hermes_home
    env = get_hermes_home() / ".env"
    env.write_text("KEY=1")
    assert json.loads(lt.library_import(str(env), callback=card))["success"] is False
    assert card.asked == []


DECK = "<!-- hermes:deck theme=paper -->\n\n# Launch\n\n---\n\n## Plan\n\n- one\n\n---\n\n## Risks\n"


@pytest.fixture
def deck():
    with ldb.connect_closing() as conn:
        return ldb.create_page(conn, title="Deck", markdown=DECK, visibility="open")


def test_the_agent_sees_the_slide_the_owner_is_on(deck):
    from hermes_cli import library_view

    assert json.loads(lt.library_view())["viewing"] is None  # nothing open yet

    library_view.set_view(deck.id, slide=2, selection="one")
    seen = json.loads(lt.library_view())

    assert seen["viewing"]["id"] == deck.id
    assert seen["slide"] == {"number": 2, "markdown": "## Plan\n\n- one"}
    assert seen["selection"] == "one"

    # Read fresh: a later edit shows up with no new push from the desktop.
    with ldb.connect_closing() as conn:
        ldb.update_item(conn, deck.id, markdown=DECK.replace("- one", "- uno"))
    assert "- uno" in json.loads(lt.library_view())["slide"]["markdown"]

    library_view.set_view(None)
    assert json.loads(lt.library_view())["viewing"] is None


def test_what_the_owner_has_open_stays_private_when_the_item_is(deck):
    from hermes_cli import library_view

    with ldb.connect_closing() as conn:
        ldb.update_item(conn, deck.id, visibility="private")
    library_view.set_view(deck.id, slide=1)

    assert json.loads(lt.library_view())["viewing"] is None


def test_slide_edits_are_one_approval_one_undo_and_all_or_nothing(deck):
    card = Card(approve=True)
    edits = [{"op": "set_slide", "index": 2, "markdown": "## Plan\n\n- two"},
             {"op": "insert_slide", "index": 3, "markdown": "## New"}]

    done = json.loads(lt.library_edit(deck.id, edits, callback=card))

    assert done["success"] and done["slides_changed"] == [2, 3] and len(card.asked) == 1
    with ldb.connect_closing() as conn:
        body = ldb.get_item(conn, deck.id).markdown
        from hermes_cli import library_versions
        before = library_versions.list_versions(conn, deck.id)
    assert "- two" in body and "## New" in body and before  # the deck as it was is kept

    bad = json.loads(lt.library_edit(deck.id, [{"op": "set_slide", "index": 1, "markdown": "x"},
                                                {"op": "remove_slide", "index": 9}], callback=card))
    assert bad["success"] is False
    with ldb.connect_closing() as conn:
        assert ldb.get_item(conn, deck.id).markdown == body  # the valid first op was not applied alone


def test_a_declined_slide_edit_changes_nothing_and_a_plain_page_is_refused(deck, items):
    declined = json.loads(lt.library_edit(deck.id, [{"op": "set_theme", "theme": "ink"}], callback=Card(False)))
    assert declined["success"] is False and declined.get("declined")
    with ldb.connect_closing() as conn:
        assert ldb.get_item(conn, deck.id).markdown == DECK

    plain = json.loads(lt.library_edit(items["open"].id, [{"op": "set_theme", "theme": "ink"}], callback=Card(True)))
    assert plain["success"] is False


_PNG_1PX = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")


def test_look_draws_the_open_slide_through_the_owners_window_and_hands_back_a_path(deck):
    from hermes_cli import library_view

    library_view.set_view(deck.id, slide=2)
    asked = []

    def window(payload):
        asked.append(payload)
        return {"data_url": _PNG_1PX}

    seen = json.loads(lt.library_view(look=True, callback=window))

    assert asked == [{"action": "snapshot", "item_id": deck.id, "slide": 2}]
    assert seen["screenshot"].endswith(f"{deck.id}.png") and open(seen["screenshot"], "rb").read(8) == b"\x89PNG\r\n\x1a\n"
    # Without `look` no picture is asked for; and a window that cannot draw it leaves the text answer intact.
    asked.clear()
    assert "screenshot" not in json.loads(lt.library_view(callback=window)) and asked == []
    none = json.loads(lt.library_view(look=True, callback=lambda p: {"data_url": None}))
    assert "screenshot" not in none and none["slide"]["number"] == 2


def test_a_snapshot_answer_that_is_not_a_png_is_ignored(deck):
    from hermes_cli import library_view

    library_view.set_view(deck.id, slide=1)
    for bad in ("", "data:text/html;base64,PGI+", "data:image/png;base64,@@@", "https://example.com/a.png"):
        assert "screenshot" not in json.loads(lt.library_view(look=True, callback=lambda p, bad=bad: {"data_url": bad}))


def test_the_library_bridge_sends_a_snapshot_to_its_own_request_not_a_consent_card(monkeypatch):
    from tui_gateway import agent_callbacks, server_requests

    sent = []
    monkeypatch.setattr(server_requests, "send", lambda method, sid, payload, timeout: sent.append((method, timeout)))

    agent_callbacks._library_consent_request("s1", {"action": "snapshot", "item_id": "x"})
    agent_callbacks._library_consent_request("s1", {"action": "update"})

    assert [m for m, _ in sent] == ["library.snapshot", "library.consent"]
    assert sent[0][1] < sent[1][1]  # a render is quick; a human decision waits
