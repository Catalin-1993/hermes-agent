"""One run, from its start to its end or to a step that waits for the owner.

A run is created ``queued`` (``start``), then executed by one process (``execute``): it takes the run,
starts every step that is ready, one at a time, and settles the rest as skipped. A failed step ends
the run as failed. An Approval or Answer step parks the run as ``waiting``; the owner's reply
(``resume_with``) records the step and queues the run again, and the next ``execute`` carries on
from there with every earlier output intact. A cancel stops the run between steps, or at once when
it is waiting.

The run keeps a copy of the workflow as it was when the run began: editing the canvas never changes
a run in flight, and a run always reads back against the steps it actually ran.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Optional

from plugins.workflows.core import graph, model, steps, store, templates

logger = logging.getLogger(__name__)


class RunRefused(ValueError):
    """A run that cannot start or a reply that cannot be taken; the message says why."""


class Cancelled(BaseException):  # never caught as a step failure
    """The owner stopped the run."""


def _first_runnable(doc: dict, node_id: Optional[str]) -> dict:
    node = next((n for n in doc["nodes"] if n["id"] == node_id), None)
    if node is None:
        raise RunRefused("Pasul nu mai există în workflow.")
    if node["kind"] in model.VISUAL_KINDS:
        raise RunRefused("Textele, notele și formele nu rulează.")
    return node


def start(workflow: dict, *, mode: str = "all", node_id: Optional[str] = None,
          trigger: Optional[dict] = None) -> str:
    """Create the run and return its id; the caller launches it (``launcher.launch``)."""
    if mode not in ("all", "from", "step"):
        raise RunRefused("Mod de rulare necunoscut.")
    if mode == "all":
        node_id = model.trigger_node(workflow)["id"]
    else:
        _first_runnable(workflow, node_id)
    payload = {"type": "manual", **(trigger or {})}
    return store.create_run(workflow, mode=mode, start_node=node_id, trigger=payload)


def _now() -> float:
    return time.time()


def _finish(run_id: str, status: str, error: str = "") -> None:
    run = store.get_run(run_id) or {"steps": []}
    for step in run["steps"]:
        if step["status"] in ("pending", "running", "waiting"):
            store.set_step(run_id, step["node_id"], status="skipped", finished_at=_now())
    store.update_run(run_id, status=status, finished_at=_now(), error=error or None, pid=None, waiting_node=None)


class _Run:
    def __init__(self, run_id: str):
        run = store.get_run(run_id, with_doc=True)
        if run is None:
            raise RunRefused("Rularea nu există.")
        self.run_id, self.run = run_id, run
        self.doc = run["doc"]
        self.nodes = {n["id"]: n for n in self.doc["nodes"]}
        self.plan = graph.plan(self.doc, mode=run["mode"], start=run["start_node"])
        self.states = {s["node_id"]: s for s in run["steps"]}
        for node_id in self.plan.order:  # every step the run covers is listed from the start
            if node_id not in self.states:
                self._set(node_id, status="pending")
        earlier = store.last_outputs(run["workflow_id"], run_id) if run["mode"] != "all" else {}
        self.outputs: dict[str, dict] = {**earlier, **{k: s for k, s in self.states.items() if s["status"] == "succeeded"}}

    def cancelled(self) -> bool:
        current = store.get_run(self.run_id)
        return bool(current and current["cancel"])

    def _set(self, node_id: str, **fields: Any) -> None:
        store.set_step(self.run_id, node_id, **fields)
        state = self.states.setdefault(node_id, {"node_id": node_id, "status": "pending", "data": None, "output": ""})
        state.update(fields)
        if state["status"] == "succeeded":
            self.outputs[node_id] = state

    def step(self, node_id: str) -> steps.Result:
        node = self.nodes[node_id]
        input_text = graph.upstream_input(self.plan, node_id, self.outputs)
        values = templates.context(input_text=input_text, steps=self.outputs, trigger=self.run["trigger"],
                                   run_id=self.run_id)
        self._set(node_id, status="running", started_at=_now(), error=None)
        ctx = steps.StepContext(run_id=self.run_id, values=values, input_text=input_text)
        try:
            result = steps.EXECUTORS[node["kind"]](node, ctx)
        except Exception as exc:  # health: allow BLE001 -- a step's own failure belongs on the step
            logger.exception("workflow step %s failed", node_id)
            result = steps.Result("failed", error=f"{exc.__class__.__name__}: {exc}"[:2_000])
        finished = None if result.status == "waiting" else _now()
        self._set(node_id, status=result.status, output=result.output, data=result.data,
                  error=result.error or None, finished_at=finished)
        return result

    def loop(self) -> str:
        start_node = self.run["start_node"]
        while True:
            if self.cancelled():
                raise Cancelled()
            ready, skipped = graph.next_steps(self.plan, self.states, start_node)
            for node_id in skipped:
                self._set(node_id, status="skipped", finished_at=_now())
            if not ready:
                if skipped:
                    continue
                return "done"
            for node_id in ready:
                result = self.step(node_id)
                if result.status == "waiting":
                    store.update_run(self.run_id, status="waiting", waiting_node=node_id, pid=None)
                    return "waiting"
                if result.status == "failed":
                    _finish(self.run_id, "failed", f"{model.node_label(self.nodes[node_id])}: {result.error}")
                    return "failed"


def execute(run_id: str) -> str:
    """Run (or carry on with) a queued run in this process. Returns how it stopped."""
    if not store.claim_run(run_id, os.getpid()):
        return "taken"
    try:
        outcome = _Run(run_id).loop()
    except Cancelled:
        _finish(run_id, "cancelled", "Oprită de tine.")
        return "cancelled"
    except Exception as exc:
        _finish(run_id, "failed", f"{exc.__class__.__name__}: {exc}"[:2_000])
        raise
    if outcome == "done":
        _finish(run_id, "succeeded")
        return "succeeded"
    return outcome


def resume_with(run_id: str, node_id: str, *, approved: Optional[bool] = None, note: str = "",
                values: Any = None) -> str:
    """Record the owner's reply to the step the run waits on. Returns the run's next status
    (``queued`` to carry on, ``rejected`` when an approval was refused)."""
    run = store.get_run(run_id, with_doc=True)
    if run is None or run["status"] != "waiting" or run["waiting_node"] != node_id:
        raise RunRefused("Rularea nu mai așteaptă la acest pas.")
    node = next(n for n in run["doc"]["nodes"] if n["id"] == node_id)
    now = _now()
    if node["kind"] == "approval":
        if approved is None:
            raise RunRefused("Alege Aprob sau Resping.")
        decision = {"approved": approved, "note": note[:2_000], "branch": "yes" if approved else "no"}
        if not approved:
            store.set_step(run_id, node_id, status="failed", data=decision, error="Respins" + (f": {note}" if note else ""),
                           finished_at=now)
            _finish(run_id, "rejected", f"{model.node_label(node)}: respins")
            return "rejected"
        prompt = next((s["output"] for s in run["steps"] if s["node_id"] == node_id), "")
        store.set_step(run_id, node_id, status="succeeded", data=decision, finished_at=now,
                       output=note or prompt or "Aprobat")
    elif node["kind"] == "answer":
        clean, error = steps.validate_answer(node, values)
        if error:
            raise RunRefused(error)
        store.set_step(run_id, node_id, status="succeeded", data=clean, finished_at=now,
                       output=json.dumps(clean, ensure_ascii=False, indent=2))
    else:
        raise RunRefused("Pasul acesta nu așteaptă un răspuns.")
    store.update_run(run_id, status="queued", waiting_node=None)
    return "queued"


def cancel(run_id: str) -> Optional[int]:
    """Ask the run to stop. Returns the pid of the process running it, for the caller to signal."""
    run = store.get_run(run_id)
    if run is None or run["status"] not in store.RUN_ACTIVE:
        raise RunRefused("Rularea s-a terminat deja.")
    if run["status"] in ("waiting", "queued"):
        _finish(run_id, "cancelled", "Oprită de tine.")
        return None
    store.update_run(run_id, cancel=1)
    with store.connect() as conn:
        row = conn.execute("SELECT pid FROM runs WHERE id = ?", (run_id,)).fetchone()
    return row["pid"] if row else None


def settle_cancelled(run_id: str) -> None:
    """Record a cancel whose process ended without recording it itself."""
    run = store.get_run(run_id)
    if run and run["status"] in store.RUN_ACTIVE:
        _finish(run_id, "cancelled", "Oprită de tine.")
