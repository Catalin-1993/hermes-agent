"""Triggers that arrive from outside: a webhook call, a GitHub event, a chat message.

Webhook and GitHub: a workflow with such a trigger owns one route of the gateway's webhook server,
``workflow-<id>`` in ``webhook_subscriptions.json`` (the store ``hermes webhook`` and the Webhooks page
edit; the server re-reads it on the next request). The server checks the signature (the workflow's own
secret), the size and the rate, and filters GitHub events by type; then ``on_webhook``, a
``pre_gateway_dispatch`` hook, starts the run with the parsed body and drops the delivery, so no agent
turn is spent on it. The route's prompt is ``{event_type}``, which is how the event's type reaches the
hook. A GitHub ``ping`` (sent when the hook is added) never starts a run.

Telegram, Discord, Slack: ``on_message``, a ``post_gateway_admission`` hook, sees each message the gateway
admitted (an authorized sender, under that message's profile). A workflow whose trigger matches the
platform, the conversation and the filter starts; the message is the workflow's unless every matching
trigger lets the agent answer as well.

Both hooks run in the gateway process and only start a run (``launcher``): the run itself is elsewhere.
"""

from __future__ import annotations

import logging
import secrets
import time
from typing import Any, Optional

from plugins.workflows.core import engine, launcher, model, store

logger = logging.getLogger(__name__)

ROUTE_PREFIX = "workflow-"
HOOK_TYPES = ("webhook", "github")
CHAT_TYPES = ("telegram", "discord", "slack")
_SKIP = {"action": "skip", "reason": "workflow trigger"}


def route_name(workflow_id: str) -> str:
    return f"{ROUTE_PREFIX}{workflow_id.lower()}"


def _route(workflow: dict, secret: str) -> dict:
    trigger = model.trigger_node(workflow)["config"]
    events = sorted({event.partition(".")[0] for event in trigger["events"]}) if trigger["type"] == "github" else []
    return {"description": f"Workflow: {workflow['name']}", "events": events, "secret": secret,
            "prompt": "{event_type}", "skills": [], "deliver": "log"}


def sync_route(workflow: dict) -> Optional[str]:
    """Make the workflow's webhook route match its trigger; returns the route's secret (kept across
    trigger changes, so going back to a webhook keeps the URL and secret the sender was given)."""
    import hermes_cli.webhook as wh

    name = route_name(workflow["id"])
    secret = workflow.get("hook_token")
    if model.trigger_node(workflow)["config"]["type"] not in HOOK_TYPES:
        if name in wh._load_subscriptions():
            remove_route(workflow)
        return secret
    secret = secret or secrets.token_urlsafe(32)
    wanted = _route(workflow, secret)
    current = wh._load_subscriptions().get(name)
    if isinstance(current, dict) and {k: current.get(k) for k in wanted} == wanted:
        return secret  # unchanged: never rewrite the file the server watches on every autosave

    def publish(subscriptions: dict) -> None:
        before = subscriptions.get(name) if isinstance(subscriptions.get(name), dict) else {}
        route = {**wanted, "created_at": before.get("created_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        if before.get("enabled") is False:
            route["enabled"] = False  # turned off on the Webhooks page: a save does not turn it back on
        subscriptions[name] = route

    wh._mutate_subscriptions(publish)
    return secret


def remove_route(workflow: dict) -> None:
    import hermes_cli.webhook as wh

    wh._mutate_subscriptions(lambda subscriptions: subscriptions.pop(route_name(workflow["id"]), None))


def hook_info(workflow: dict) -> Optional[dict]:
    """Where the sender posts and the secret it signs with; None for a trigger that is not a webhook."""
    import hermes_cli.webhook as wh

    if model.trigger_node(workflow)["config"]["type"] not in HOOK_TYPES or not workflow.get("hook_token"):
        return None
    name = route_name(workflow["id"])
    route = wh._load_subscriptions().get(name)
    return {"url": wh._route_url(name, route if isinstance(route, dict) else {}), "secret": workflow["hook_token"],
            "server_enabled": wh._is_webhook_enabled(),
            "route_enabled": not (isinstance(route, dict) and route.get("enabled") is False)}


# ── matching ───────────────────────────────────────────────────────────────────────────────────


def github_matches(trigger: dict, event_type: str, payload: Any) -> bool:
    """An event the trigger asked for (``pull_request.opened`` also checks the action), on its repository."""
    if event_type == "ping":
        return False
    body = payload if isinstance(payload, dict) else {}
    repository = trigger["repository"].lower()
    full_name = str((body.get("repository") or {}).get("full_name") or "").lower()
    if repository and full_name != repository:
        return False
    if not trigger["events"]:
        return True
    for wanted in trigger["events"]:
        event, _, action = wanted.partition(".")
        if event == event_type and (not action or action == body.get("action")):
            return True
    return False


def chat_matches(trigger: dict, source: dict, text: str) -> bool:
    """The conversation the trigger names (any, when it names none), and a message containing its filter."""
    if trigger["channel"] and str(source.get("chat_id") or "") != trigger["channel"]:
        return False
    wanted = trigger["filter"].strip()
    return not wanted or model.fold(wanted) in model.fold(text or "")


# ── starting a run ─────────────────────────────────────────────────────────────────────────────


def _start(workflow: dict, trigger: dict) -> Optional[str]:
    delivery = trigger.get("delivery_id")
    if delivery and store.has_delivery(workflow["id"], delivery):
        logger.info("workflow %s: delivery %s already started a run", workflow["id"], delivery)
        return None
    run_id = engine.start(workflow, trigger=trigger)
    launcher.launch(run_id)
    logger.info("workflow %s: %s trigger started run %s", workflow["id"], trigger["type"], run_id)
    return run_id


# A chain of "workflow" triggers stops here, so two workflows that start each other cannot run forever.
MAX_CHAIN = 5


def _final_output(run: dict) -> str:
    done = [s for s in run["steps"] if s["status"] == "succeeded" and s.get("output")]
    return max(done, key=lambda s: s.get("finished_at") or 0)["output"] if done else ""


def after_run(run_id: str) -> list[str]:
    """A run ended (succeeded or failed): start every workflow whose "workflow" trigger waits on it. The
    last step's output is the followers' input; returns the runs it started."""
    run = store.get_run(run_id)
    if run is None or run["status"] not in ("succeeded", "failed"):
        return []
    depth = int((run.get("trigger") or {}).get("depth") or 0)
    if depth >= MAX_CHAIN:
        logger.info("workflow run %s: chain of %d workflows, not starting more", run_id, depth)
        return []
    source = store.get_workflow(run["workflow_id"]) or {}
    output = _final_output(run)
    started = []
    for workflow in store.workflows_with_trigger(("workflow",)):
        trigger = model.trigger_node(workflow)["config"]
        if workflow["id"] == run["workflow_id"] or (trigger["source"] and trigger["source"] != run["workflow_id"]):
            continue
        if trigger["when"] != "finished" and trigger["when"] != run["status"]:
            continue
        payload = {"type": "workflow", "source_id": run["workflow_id"], "source_name": source.get("name", ""),
                   "status": run["status"], "error": run.get("error") or "", "body": output, "text": output,
                   "run_id": run_id, "depth": depth + 1, "delivery_id": f"run:{run_id}"}
        try:
            run_started = _start(workflow, payload)
        except Exception:  # health: allow BLE001 -- one follower's failure must not stop the others
            logger.exception("workflow %s: workflow trigger failed", workflow["id"])
            continue
        if run_started:
            started.append(run_started)
    return started


def on_webhook(event: Any = None, **_: Any) -> Optional[dict]:
    """``pre_gateway_dispatch``: a delivery on a workflow's route starts that workflow and goes no further."""
    source = getattr(event, "source", None)
    platform = getattr(getattr(source, "platform", None), "value", "")
    route = str(getattr(source, "user_id", "") or "").removeprefix("webhook:")
    if platform != "webhook" or not route.startswith(ROUTE_PREFIX):
        return None
    try:
        workflow = store.get_workflow(route[len(ROUTE_PREFIX):])
        trigger = model.trigger_node(workflow)["config"] if workflow else None
        if trigger is None or trigger["type"] not in HOOK_TYPES:
            return _SKIP
        event_type = (getattr(event, "text", "") or "").strip()
        payload = getattr(event, "raw_message", None)
        if trigger["type"] == "github" and not github_matches(trigger, event_type, payload):
            return _SKIP
        _start(workflow, {"type": trigger["type"], "event": event_type, "body": payload,
                          "delivery_id": str(getattr(event, "message_id", "") or "") or None})
    except Exception:  # health: allow BLE001 -- a workflow route's delivery must never fall through to an agent turn
        logger.exception("workflow webhook trigger failed on route %s", route)
    return _SKIP


def on_message(platform: str = "", source: Optional[dict] = None, text: str = "", message_id: Any = None,
               **_: Any) -> Optional[dict]:
    """``post_gateway_admission``: an admitted chat message starts every workflow whose trigger matches it."""
    if platform not in CHAT_TYPES:
        return None
    source = source or {}
    handled = False
    for workflow in store.workflows_with_trigger((platform,)):
        trigger = model.trigger_node(workflow)["config"]
        if not chat_matches(trigger, source, text):
            continue
        payload = {"type": platform, "body": text, "text": text, "platform": platform,
                   "chat_id": source.get("chat_id"), "chat_name": source.get("chat_name"),
                   "chat_type": source.get("chat_type"), "thread_id": source.get("thread_id"),
                   "user_id": source.get("user_id"), "user_name": source.get("user_name"),
                   "message_id": str(message_id) if message_id is not None else None,
                   "delivery_id": f"{platform}:{source.get('chat_id')}:{message_id}" if message_id is not None else None}
        try:
            _start(workflow, payload)
        except Exception:  # health: allow BLE001 -- one workflow's failure must not take the message from the others
            logger.exception("workflow %s: chat trigger failed", workflow["id"])
            continue
        handled = handled or not trigger["pass_through"]
    return {"action": "handled"} if handled else None
