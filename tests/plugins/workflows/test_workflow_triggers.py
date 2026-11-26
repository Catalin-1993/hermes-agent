"""Triggers from outside and Outputs to channels, against the test's own HERMES_HOME: the webhook route a
workflow owns, a webhook or GitHub delivery reaching the hook, a chat message reaching the hook, and what an
Output step sends where."""

import json
from types import SimpleNamespace

import pytest

from plugins.workflows.core import channels, engine, ingress, launcher, model, store
from plugins.workflows.dashboard import plugin_api


@pytest.fixture
def launched(monkeypatch):
    """Runs a trigger starts, recorded instead of spawned."""
    started: list[str] = []
    monkeypatch.setattr(launcher, "launch", lambda run_id: started.append(run_id) or 0)
    return started


def _workflow(trigger: dict, nodes=(), edges=()) -> dict:
    doc = model.normalize({"name": "Test", "nodes": [{"id": "t", "kind": "trigger", "config": trigger}, *nodes],
                           "edges": [{"source": s, "target": t} for s, t in edges]})
    return plugin_api._sync_triggers(store.create_workflow(doc))


def _subscriptions() -> dict:
    import hermes_cli.webhook as wh

    return wh._load_subscriptions()


def _delivery(workflow_id: str, event_type: str, payload, delivery: str = "d1"):
    source = SimpleNamespace(platform=SimpleNamespace(value="webhook"), user_id=f"webhook:workflow-{workflow_id}")
    return SimpleNamespace(source=source, text=event_type, raw_message=payload, message_id=delivery)


def test_a_github_trigger_owns_one_signed_route_that_follows_the_trigger():
    wf = _workflow({"type": "github", "repository": "acme/app", "events": ["pull_request.opened", "push", "PUSH"]})
    name = ingress.route_name(wf["id"])
    route = _subscriptions()[name]

    assert route["events"] == ["pull_request", "push"]
    assert route["secret"] == wf["hook_token"] and len(route["secret"]) > 30
    assert plugin_api.get_workflow(wf["id"])["hook"]["url"].endswith(f"/webhooks/{name}")

    manual = model.normalize({**wf, "nodes": [{**wf["nodes"][0], "config": {"type": "manual"}}]})
    plugin_api.save_workflow(wf["id"], plugin_api.SaveBody(workflow=manual))
    assert name not in _subscriptions()

    back = model.normalize({**wf, "nodes": [{**wf["nodes"][0], "config": {"type": "webhook"}}]})
    plugin_api.save_workflow(wf["id"], plugin_api.SaveBody(workflow=back))
    assert _subscriptions()[name]["secret"] == wf["hook_token"]  # same secret the sender was given

    plugin_api.delete_workflow(wf["id"])
    assert name not in _subscriptions()


def test_a_github_delivery_starts_the_run_once_and_never_reaches_an_agent(launched):
    wf = _workflow({"type": "github", "repository": "Acme/App", "events": ["pull_request.opened"]},
                   [{"id": "out", "kind": "output", "config": {"message": "PR {{trigger.body.pull_request.title}}"}}],
                   [("t", "out")])
    opened = {"action": "opened", "repository": {"full_name": "acme/app"}, "pull_request": {"number": 7, "title": "Fix"}}

    assert ingress.on_webhook(event=_delivery(wf["id"], "pull_request", opened)) == ingress._SKIP
    assert ingress.on_webhook(event=_delivery(wf["id"], "pull_request", opened)) == ingress._SKIP  # a retry
    assert ingress.on_webhook(event=_delivery(wf["id"], "pull_request", {**opened, "action": "closed"}, "d2"))
    assert ingress.on_webhook(event=_delivery(wf["id"], "ping", {}, "d3")) == ingress._SKIP
    assert len(launched) == 1

    run = store.get_run(launched[0])
    assert (run["trigger"]["type"], run["trigger"]["event"]) == ("github", "pull_request")
    assert engine.execute(launched[0]) == "succeeded"
    out = next(s for s in store.get_run(launched[0])["steps"] if s["node_id"] == "out")
    assert out["output"] == "PR Fix"


def test_a_webhook_body_is_the_first_steps_input(launched, monkeypatch):
    sent = []
    monkeypatch.setattr(channels, "send_message", lambda *args: sent.append(args) or "")
    wf = _workflow({"type": "webhook"},
                   [{"id": "if", "kind": "condition", "config": {"rule": "total > 100"}},
                    {"id": "out", "kind": "output", "config": {"channel": "slack", "target": "C1",
                                                               "message": "Comandă de {{input.total}}"}}],
                   [("t", "if"), ("if", "out")])

    ingress.on_webhook(event=_delivery(wf["id"], "order", {"total": 250}))
    assert engine.execute(launched[0]) == "succeeded"
    assert sent == [("slack", "C1", "Comandă de 250")]


def test_another_route_is_left_to_the_gateway():
    other = SimpleNamespace(source=SimpleNamespace(platform=SimpleNamespace(value="webhook"), user_id="webhook:deploys"))
    chat = SimpleNamespace(source=SimpleNamespace(platform=SimpleNamespace(value="telegram"), user_id="5"))

    assert ingress.on_webhook(event=other) is None
    assert ingress.on_webhook(event=chat) is None


def test_a_chat_message_starts_the_matching_workflows_and_is_theirs_unless_the_agent_may_answer(launched):
    takes = _workflow({"type": "telegram", "channel": "42", "filter": "factura"})
    shares = _workflow({"type": "telegram", "filter": "Factură", "pass_through": True})
    _workflow({"type": "discord"})
    source = {"platform": "telegram", "chat_id": "42", "thread_id": "7", "user_name": "ana"}

    assert ingress.on_message(platform="telegram", source=source, text="Am trimis FACTURA nr 3", message_id=1) == \
        {"action": "handled"}
    assert {store.get_run(r)["workflow_id"] for r in launched} == {takes["id"], shares["id"]}

    launched.clear()
    assert ingress.on_message(platform="telegram", source={**source, "chat_id": "9"}, text="factură", message_id=2) is None
    assert [store.get_run(r)["workflow_id"] for r in launched] == [shares["id"]]

    launched.clear()
    assert ingress.on_message(platform="telegram", source=source, text="salut", message_id=3) is None
    assert ingress.on_message(platform="webhook", source=source, text="factura", message_id=4) is None
    assert launched == []


def test_a_reply_goes_back_to_the_conversation_and_its_topic(launched, monkeypatch):
    sent = []
    monkeypatch.setattr(channels, "send_message", lambda *args: sent.append(args) or "")
    _workflow({"type": "telegram"}, [{"id": "out", "kind": "output", "config": {"channel": "chat",
                                                                                "message": "Primit: {{input}}"}}],
              [("t", "out")])

    ingress.on_message(platform="telegram", source={"chat_id": "-100", "thread_id": "7"}, text="comanda 5",
                       message_id=9)
    assert engine.execute(launched[0]) == "succeeded"
    assert sent == [("telegram", "-100:7", "Primit: comanda 5")]
    out = next(s for s in store.get_run(launched[0])["steps"] if s["node_id"] == "out")
    assert out["data"]["sent_to"] == "telegram:-100:7"


def test_an_output_that_cannot_go_anywhere_fails_with_the_reason(monkeypatch):
    monkeypatch.setattr(channels, "send_message", lambda *args: "No home channel set for discord")
    wf = _workflow({"type": "manual"},
                   [{"id": "chat", "kind": "output", "config": {"channel": "chat", "message": "x"}},
                    {"id": "dc", "kind": "output", "config": {"channel": "discord", "message": "x"}}],
                   [("t", "chat"), ("t", "dc")])
    assert {p["node_id"] for p in plugin_api.get_workflow(wf["id"])["problems"]} == {"chat"}

    for node_id, reason in (("chat", "Telegram, Discord sau Slack"), ("dc", "No home channel")):
        run_id = engine.start(wf, mode="step", node_id=node_id)
        assert engine.execute(run_id) == "failed"
        assert reason in store.get_run(run_id)["steps"][0]["error"]


@pytest.mark.parametrize(("target", "body", "expected"), [
    ("acme/app#12", {}, ("acme/app", 12)),
    ("", {"repository": {"full_name": "acme/app"}, "issue": {"number": 4}}, ("acme/app", 4)),
    ("", {"repository": {"full_name": "acme/app"}, "pull_request": {"number": 9}}, ("acme/app", 9)),
    ("", {"repository": {"full_name": "acme/app"}}, ("", 0)),
])
def test_a_github_comment_goes_to_the_issue_named_or_the_one_the_event_is_about(target, body, expected):
    assert channels._github_issue(target, {"type": "github", "body": body}) == expected


def test_a_signed_test_event_is_what_the_webhook_server_accepts():
    """The test button signs exactly the way the gateway's webhook server checks."""
    import hashlib
    import hmac

    wf = _workflow({"type": "webhook"})
    hook = ingress.hook_info(store.get_workflow(wf["id"]))
    body, headers = plugin_api._signed_test(store.get_workflow(wf["id"]), hook)
    expected = hmac.new(hook["secret"].encode(), headers["X-Webhook-Timestamp"].encode() + b"." + body,
                        hashlib.sha256).hexdigest()

    assert headers["X-Webhook-Signature-V2"] == expected
    assert json.loads(body)["test"] is True
