"""Workflows plugin — backend routes, mounted at /api/plugins/workflows/.

Thin handlers over ``plugins.workflows.core``: the owner's workflows (list, create, save, delete,
versions), their runs (start, read, cancel, the reply to a waiting step), the agents a step can
use, a rule check for the Condition editor, and the events the app announces. A run never runs in
this process: ``launcher`` starts it in its own and the request returns with the run's id.

Triggers that come from outside keep their wiring in step with the document on every save: a schedule
owns a cron job (``schedule``), a webhook or GitHub trigger owns a route of the gateway's webhook server
(``ingress``). ``/connectors`` says what the owner has connected (bots, the webhook server, ``gh``, the
gateway hooks; the page turns those on through the gateway's own ``plugins.manage``, as the Plugins page does).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import urllib.error
import urllib.request
import uuid
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from plugins.workflows.core import channels, engine, ingress, launcher, media, model, rules, schedule, store

router = APIRouter()


class CreateBody(BaseModel):
    name: str = ""
    workflow: Optional[dict] = None


class SaveBody(BaseModel):
    workflow: dict


class RunBody(BaseModel):
    mode: str = "all"
    node_id: Optional[str] = None


class ReplyBody(BaseModel):
    node_id: str
    approved: Optional[bool] = None
    note: str = ""
    values: Optional[Any] = None


class ImportBody(BaseModel):
    data: Any = None


class RuleBody(BaseModel):
    rule: str


def _workflow_or_404(workflow_id: str) -> dict:
    workflow = store.get_workflow(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow-ul nu există.")
    return workflow


def _output_problem(config: dict, trigger: dict) -> str:
    if config["channel"] == "chat" and trigger["type"] not in ingress.CHAT_TYPES:
        return "Răspunsul în conversație cere un declanșator Telegram, Discord sau Slack."
    if config["channel"] == "github" and not config["target"].strip() and trigger["type"] != "github":
        return "Scrie unde se comentează: owner/repo#123."
    return ""


def _problems(doc: dict) -> list[dict]:
    """What would stop a step from running, shown on the canvas before the owner presses Run."""
    found: list[dict] = []
    trigger = model.trigger_node(doc)["config"]
    for node in doc["nodes"]:
        config, kind = node["config"], node["kind"]
        message = ""
        if kind == "condition":
            message = rules.check(config["rule"]) if config["rule"].strip() else "Scrie regula condiției."
        elif kind == "agent" and not config["task"].strip():
            message = "Scrie sarcina agentului."
        elif kind == "llm" and not config["prompt"].strip():
            message = "Scrie promptul."
        elif kind == "answer" and not config["fields"]:
            message = "Adaugă cel puțin un câmp."
        elif kind == "output":
            message = _output_problem(config, trigger)
        elif kind == "trigger" and config["type"] == "schedule":
            message = schedule.check(config["schedule"])
        if message:
            found.append({"node_id": node["id"], "message": message})
    return found


def _detail(workflow: dict) -> dict:
    detail = {k: v for k, v in workflow.items() if k != "hook_token"}
    return {**detail, "problems": _problems(workflow), "next_run": schedule.next_run(workflow.get("job_id")),
            "hook": ingress.hook_info(workflow)}


def _sync_triggers(workflow: dict) -> dict:
    """The cron job and the webhook route the trigger owns, made to match it."""
    trigger = model.trigger_node(workflow)["config"]
    if trigger["type"] == "schedule" and schedule.check(trigger["schedule"]):
        # An invalid schedule keeps no job: the canvas shows why on the trigger.
        schedule.remove(workflow)
        job_id = None
    else:
        job_id = schedule.sync(workflow)
    secret = ingress.sync_route(workflow)
    if job_id != workflow.get("job_id") or secret != workflow.get("hook_token"):
        store.set_workflow_meta(workflow["id"], job_id=job_id, hook_token=secret)
        workflow = {**workflow, "job_id": job_id, "hook_token": secret}
    return workflow


@router.get("/workflows")
def list_workflows() -> dict:
    return {"workflows": store.list_workflows()}


@router.post("/workflows")
def create_workflow(body: CreateBody) -> dict:
    doc = model.normalize({**body.workflow, "name": body.name or body.workflow.get("name", "")}) if body.workflow \
        else model.starter(body.name.strip())
    workflow = _sync_triggers(store.create_workflow(doc))
    return _detail(workflow)


@router.get("/workflows/{workflow_id}")
def get_workflow(workflow_id: str) -> dict:
    return _detail(_workflow_or_404(workflow_id))


@router.put("/workflows/{workflow_id}")
def save_workflow(workflow_id: str, body: SaveBody) -> dict:
    _workflow_or_404(workflow_id)
    workflow = store.save_workflow(workflow_id, model.normalize(body.workflow))
    return _detail(_sync_triggers(workflow))


@router.delete("/workflows/{workflow_id}")
def delete_workflow(workflow_id: str) -> dict:
    workflow = _workflow_or_404(workflow_id)
    for run in store.list_runs(workflow_id, limit=store.MAX_RUNS):
        if run["status"] in store.RUN_ACTIVE:
            pid = engine.cancel(run["id"])
            if pid:
                launcher.stop(pid)
    schedule.remove(workflow)
    ingress.remove_route(workflow)
    store.delete_workflow(workflow_id)
    return {"ok": True}


@router.post("/workflows/{workflow_id}/duplicate")
def duplicate_workflow(workflow_id: str) -> dict:
    workflow = _workflow_or_404(workflow_id)
    doc = model.normalize({**workflow, "name": f"{workflow['name']} (copie)"})
    return _detail(_sync_triggers(store.create_workflow(doc)))


@router.get("/workflows/{workflow_id}/versions")
def list_versions(workflow_id: str) -> dict:
    _workflow_or_404(workflow_id)
    return {"versions": store.list_versions(workflow_id)}


@router.get("/workflows/{workflow_id}/versions/{version}")
def get_version(workflow_id: str, version: int) -> dict:
    _workflow_or_404(workflow_id)
    doc = store.get_version(workflow_id, version)
    if doc is None:
        raise HTTPException(status_code=404, detail="Versiunea nu există.")
    return {"version": version, "workflow": model.normalize(doc)}


@router.get("/workflows/{workflow_id}/export")
def export_workflow(workflow_id: str) -> dict:
    return model.export(_workflow_or_404(workflow_id))


@router.post("/workflows/import")
def import_workflow(body: ImportBody) -> dict:
    doc = model.from_export(body.data)
    if doc is None:
        raise HTTPException(status_code=400, detail="Fișierul nu e un workflow Brain exportat.")
    return _detail(_sync_triggers(store.create_workflow(doc)))


@router.post("/workflows/{workflow_id}/versions/{version}/restore")
def restore_version(workflow_id: str, version: int) -> dict:
    _workflow_or_404(workflow_id)
    doc = store.get_version(workflow_id, version)
    if doc is None:
        raise HTTPException(status_code=404, detail="Versiunea nu există.")
    workflow = store.save_workflow(workflow_id, model.normalize(doc))
    return _detail(_sync_triggers(workflow))


@router.post("/workflows/{workflow_id}/run")
def run_workflow(workflow_id: str, body: RunBody) -> dict:
    workflow = _workflow_or_404(workflow_id)
    try:
        run_id = engine.start(workflow, mode=body.mode, node_id=body.node_id, trigger={"type": "manual"})
    except engine.RunRefused as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    launcher.launch(run_id)
    return {"run_id": run_id}


@router.get("/workflows/{workflow_id}/runs")
def list_runs(workflow_id: str, limit: int = Query(50, ge=1, le=200)) -> dict:
    _workflow_or_404(workflow_id)
    return {"runs": store.list_runs(workflow_id, limit)}


@router.get("/runs/{run_id}")
def get_run(run_id: str) -> dict:
    run = store.get_run(run_id, with_doc=True)
    if run is None:
        raise HTTPException(status_code=404, detail="Rularea nu există.")
    return run


@router.post("/runs/{run_id}/reply")
def reply(run_id: str, body: ReplyBody) -> dict:
    try:
        status = engine.resume_with(run_id, body.node_id, approved=body.approved, note=body.note, values=body.values)
    except engine.RunRefused as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if status == "queued":
        launcher.launch(run_id)
    return {"status": status}


@router.post("/runs/{run_id}/cancel")
def cancel_run(run_id: str) -> dict:
    try:
        pid = engine.cancel(run_id)
    except engine.RunRefused as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if pid and launcher.stop(pid):
        # A process stopped before it could record the cancel (or killed outright) leaves it here.
        engine.settle_cancelled(run_id)
    return {"ok": True}


@router.get("/agents")
def list_agents() -> dict:
    from hermes_cli.profiles import list_profiles

    agents = [{"name": p.name, "default": p.is_default, "model": p.model or ""}
              for p in list_profiles(lazy_skill_count=True)]
    return {"agents": agents}


@router.post("/rules/check")
def check_rule(body: RuleBody) -> dict:
    return {"error": rules.check(body.rule) if body.rule.strip() else ""}


@router.get("/events")
def events(since: float = Query(0.0)) -> dict:
    return {"events": store.events_since(since)}


@router.post("/workflows/{workflow_id}/hook/rotate")
def rotate_hook_secret(workflow_id: str) -> dict:
    """A new secret: the old one stops working at once, so the sender must be given the new one."""
    workflow = _workflow_or_404(workflow_id)
    store.set_workflow_meta(workflow_id, hook_token=None)
    return _detail(_sync_triggers({**workflow, "hook_token": None}))


def _signed_test(workflow: dict, hook: dict) -> tuple[bytes, dict]:
    trigger = model.trigger_node(workflow)["config"]
    if trigger["type"] == "github":
        event, _, action = (trigger["events"] or ["push"])[0].partition(".")
        body = json.dumps({"action": action or None, "repository": {"full_name": trigger["repository"] or "brain/test"},
                           "sender": {"login": "brain-test"}, "test": True}).encode()
        signature = "sha256=" + hmac.new(hook["secret"].encode(), body, hashlib.sha256).hexdigest()
        return body, {"X-GitHub-Event": event, "X-Hub-Signature-256": signature, "X-GitHub-Delivery": uuid.uuid4().hex}
    body = json.dumps({"test": True, "text": "Un test trimis din Brain."}, ensure_ascii=False).encode()
    stamp = str(int(time.time()))
    signature = hmac.new(hook["secret"].encode(), stamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    return body, {"X-Webhook-Timestamp": stamp, "X-Webhook-Signature-V2": signature, "X-Request-ID": uuid.uuid4().hex}


@router.post("/workflows/{workflow_id}/hook/test")
def test_hook(workflow_id: str) -> dict:
    """Send a signed sample event to the workflow's own URL, the way the real sender would."""
    workflow = _workflow_or_404(workflow_id)
    hook = ingress.hook_info(workflow)
    if hook is None:
        raise HTTPException(status_code=400, detail="Declanșatorul nu e un webhook.")
    if not hook["server_enabled"]:
        raise HTTPException(status_code=400, detail="Serverul de webhook-uri e oprit. Pornește-l din pagina Webhooks.")
    body, headers = _signed_test(workflow, hook)
    request = urllib.request.Request(hook["url"], data=body, method="POST",
                                     headers={"Content-Type": "application/json", **headers})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return {"status": response.status, "body": response.read(2_000).decode("utf-8", "replace")}
    except urllib.error.HTTPError as exc:
        return {"status": exc.code, "body": exc.read(2_000).decode("utf-8", "replace")}
    except (urllib.error.URLError, OSError) as exc:
        raise HTTPException(status_code=502, detail=(
            f"Serverul de webhook-uri nu răspunde la {hook['url']} ({exc}). "
            "Repornește gateway-ul după ce l-ai pornit.")) from exc


@router.get("/media/status")
def media_status() -> dict:
    return media.status()


@router.get("/connectors")
def connectors() -> dict:
    return channels.connectors()
