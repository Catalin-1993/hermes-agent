"""Workflows, their versions, their runs and each run's steps, in ``<HERMES_HOME>/workflows/workflows.db``.

One connection per call (the API and every run process write the same file), WAL so a reader never
waits for a run that is writing. Documents are stored as JSON; the columns are what lists and
filters need. Deleting a workflow deletes its versions, runs and steps with it.
"""

from __future__ import annotations

import contextlib
import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Iterator, Optional

from hermes_constants import get_hermes_home

from plugins.workflows.core import model

MAX_VERSIONS = 50
MAX_RUNS = 200

_SCHEMA = """
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, doc TEXT NOT NULL, version INTEGER NOT NULL,
    created_at REAL NOT NULL, updated_at REAL NOT NULL, job_id TEXT, hook_token TEXT
);
CREATE TABLE IF NOT EXISTS versions (
    workflow_id TEXT NOT NULL, version INTEGER NOT NULL, doc TEXT NOT NULL, created_at REAL NOT NULL,
    PRIMARY KEY (workflow_id, version)
);
CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, version INTEGER NOT NULL, doc TEXT NOT NULL,
    status TEXT NOT NULL, mode TEXT NOT NULL, start_node TEXT, trigger TEXT NOT NULL,
    created_at REAL NOT NULL, started_at REAL, finished_at REAL, error TEXT, pid INTEGER,
    waiting_node TEXT, cancel INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS runs_by_workflow ON runs (workflow_id, created_at DESC);
CREATE TABLE IF NOT EXISTS steps (
    run_id TEXT NOT NULL, node_id TEXT NOT NULL, status TEXT NOT NULL, seq INTEGER NOT NULL,
    output TEXT NOT NULL DEFAULT '', data TEXT, error TEXT, started_at REAL, finished_at REAL,
    PRIMARY KEY (run_id, node_id)
);
"""

RUN_ACTIVE = ("queued", "running", "waiting")
RUN_DONE = ("succeeded", "failed", "cancelled", "rejected")


def db_path() -> Path:
    return get_hermes_home() / "workflows" / "workflows.db"


@contextlib.contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=15, isolation_level=None)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=15000")
        conn.executescript(_SCHEMA)
        yield conn
    finally:
        conn.close()


def _now() -> float:
    return time.time()


# ── workflows ──────────────────────────────────────────────────────────────────────────────────


def _summary(row: sqlite3.Row, last: Optional[sqlite3.Row]) -> dict:
    doc = json.loads(row["doc"])
    trigger = model.trigger_node(doc)
    return {
        "id": row["id"],
        "name": row["name"],
        "version": row["version"],
        "updated_at": row["updated_at"],
        "created_at": row["created_at"],
        "trigger": trigger["config"]["type"],
        "steps": sum(1 for node in doc["nodes"] if node["kind"] in model.STEP_KINDS),
        "last_run": {"id": last["id"], "status": last["status"], "created_at": last["created_at"]} if last else None,
    }


def list_workflows() -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM workflows ORDER BY updated_at DESC").fetchall()
        result = []
        for row in rows:
            last = conn.execute(
                "SELECT id, status, created_at FROM runs WHERE workflow_id = ? ORDER BY created_at DESC LIMIT 1",
                (row["id"],),
            ).fetchone()
            result.append(_summary(row, last))
        return result


def get_workflow(workflow_id: str) -> Optional[dict]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
    if row is None:
        return None
    return {"id": row["id"], "version": row["version"], "created_at": row["created_at"],
            "updated_at": row["updated_at"], "job_id": row["job_id"], "hook_token": row["hook_token"],
            **json.loads(row["doc"])}


def workflows_with_trigger(types: tuple[str, ...]) -> list[dict]:
    """Every workflow a trigger of one of ``types`` starts. Runs on each message the gateway admits, so a
    profile that never opened Workflows (no database) costs one ``stat``."""
    if not db_path().is_file():
        return []
    with connect() as conn:
        rows = conn.execute("SELECT id FROM workflows").fetchall()
    found = []
    for row in rows:
        workflow = get_workflow(row["id"])
        if workflow is not None and model.trigger_node(workflow)["config"]["type"] in types:
            found.append(workflow)
    return found


def create_workflow(doc: dict) -> dict:
    workflow_id, now = model.new_id("wf"), _now()
    text = json.dumps(doc, ensure_ascii=False)
    with connect() as conn:
        conn.execute("INSERT INTO workflows (id, name, doc, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
                     (workflow_id, doc["name"], text, now, now))
        conn.execute("INSERT INTO versions (workflow_id, version, doc, created_at) VALUES (?, 1, ?, ?)",
                     (workflow_id, text, now))
    return get_workflow(workflow_id)


def save_workflow(workflow_id: str, doc: dict) -> Optional[dict]:
    """Store ``doc``. A change of steps or links is a new version; a moved view or node is not."""
    current = get_workflow(workflow_id)
    if current is None:
        return None
    text, now = json.dumps(doc, ensure_ascii=False), _now()
    before = {k: current[k] for k in ("name", "description", "nodes", "edges")}
    after = {k: doc[k] for k in ("name", "description", "nodes", "edges")}
    changed = _shape(before) != _shape(after)
    version = current["version"] + (1 if changed else 0)
    with connect() as conn:
        conn.execute("UPDATE workflows SET name = ?, doc = ?, version = ?, updated_at = ? WHERE id = ?",
                     (doc["name"], text, version, now, workflow_id))
        if changed:
            conn.execute("INSERT OR REPLACE INTO versions (workflow_id, version, doc, created_at) VALUES (?, ?, ?, ?)",
                         (workflow_id, version, text, now))
            conn.execute("DELETE FROM versions WHERE workflow_id = ? AND version <= ?",
                         (workflow_id, version - MAX_VERSIONS))
        else:
            conn.execute("UPDATE versions SET doc = ? WHERE workflow_id = ? AND version = ?",
                         (text, workflow_id, version))
    return get_workflow(workflow_id)


def _shape(doc: dict) -> str:
    """The document without positions: what makes a version."""
    nodes = [{k: v for k, v in node.items() if k not in ("x", "y", "w", "h")} for node in doc["nodes"]]
    return json.dumps({**doc, "nodes": nodes}, sort_keys=True)


def set_workflow_meta(workflow_id: str, *, job_id: Any = ..., hook_token: Any = ...) -> None:
    sets, args = [], []
    if job_id is not ...:
        sets.append("job_id = ?")
        args.append(job_id)
    if hook_token is not ...:
        sets.append("hook_token = ?")
        args.append(hook_token)
    if sets:
        with connect() as conn:
            conn.execute(f"UPDATE workflows SET {', '.join(sets)} WHERE id = ?", (*args, workflow_id))


def delete_workflow(workflow_id: str) -> bool:
    with connect() as conn:
        run_ids = [r["id"] for r in conn.execute("SELECT id FROM runs WHERE workflow_id = ?", (workflow_id,))]
        conn.execute("BEGIN")
        for run_id in run_ids:
            conn.execute("DELETE FROM steps WHERE run_id = ?", (run_id,))
        conn.execute("DELETE FROM runs WHERE workflow_id = ?", (workflow_id,))
        conn.execute("DELETE FROM versions WHERE workflow_id = ?", (workflow_id,))
        deleted = conn.execute("DELETE FROM workflows WHERE id = ?", (workflow_id,)).rowcount
        conn.execute("COMMIT")
    return bool(deleted)


def list_versions(workflow_id: str) -> list[dict]:
    """Newest first, each with what it changed against the version before it."""
    with connect() as conn:
        rows = conn.execute("SELECT version, created_at, doc FROM versions WHERE workflow_id = ? ORDER BY version",
                            (workflow_id,)).fetchall()
    versions, previous = [], None
    for row in rows:
        doc = model.normalize(json.loads(row["doc"]))  # an older version, read as today's documents are
        versions.append({"version": row["version"], "created_at": row["created_at"],
                         "steps": sum(1 for n in doc["nodes"] if n["kind"] in model.STEP_KINDS),
                         "changes": model.diff(previous, doc)})
        previous = doc
    return versions[::-1]


def get_version(workflow_id: str, version: int) -> Optional[dict]:
    with connect() as conn:
        row = conn.execute("SELECT doc FROM versions WHERE workflow_id = ? AND version = ?",
                           (workflow_id, version)).fetchone()
    return json.loads(row["doc"]) if row else None


# ── runs ──────────────────────────────────────────────────────────────────────────────────────


def create_run(workflow: dict, *, mode: str, start_node: Optional[str], trigger: dict) -> str:
    run_id = model.new_id("run")
    doc = {k: workflow[k] for k in ("name", "description", "nodes", "edges")}
    with connect() as conn:
        conn.execute(
            "INSERT INTO runs (id, workflow_id, version, doc, status, mode, start_node, trigger, created_at) "
            "VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?)",
            (run_id, workflow["id"], workflow["version"], json.dumps(doc, ensure_ascii=False), mode, start_node,
             json.dumps(trigger, ensure_ascii=False), _now()),
        )
        stale = conn.execute("SELECT id FROM runs WHERE workflow_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET ?",
                             (workflow["id"], MAX_RUNS)).fetchall()
        for row in stale:
            conn.execute("DELETE FROM steps WHERE run_id = ?", (row["id"],))
            conn.execute("DELETE FROM runs WHERE id = ?", (row["id"],))
    return run_id


def _run_row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"], "workflow_id": row["workflow_id"], "version": row["version"], "status": row["status"],
        "mode": row["mode"], "start_node": row["start_node"], "trigger": json.loads(row["trigger"]),
        "created_at": row["created_at"], "started_at": row["started_at"], "finished_at": row["finished_at"],
        "error": row["error"], "waiting_node": row["waiting_node"], "cancel": bool(row["cancel"]),
    }


def _step_row(row: sqlite3.Row) -> dict:
    return {"node_id": row["node_id"], "status": row["status"], "seq": row["seq"], "output": row["output"],
            "data": json.loads(row["data"]) if row["data"] else None, "error": row["error"],
            "started_at": row["started_at"], "finished_at": row["finished_at"]}


def has_delivery(workflow_id: str, delivery_id: str) -> bool:
    """True when a run of the workflow was already started by this delivery (a provider's retry)."""
    with connect() as conn:
        row = conn.execute("SELECT 1 FROM runs WHERE workflow_id = ? AND json_extract(trigger, '$.delivery_id') = ?",
                           (workflow_id, delivery_id)).fetchone()
    return row is not None


def get_run(run_id: str, *, with_doc: bool = False) -> Optional[dict]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if row is None:
            return None
        steps = conn.execute("SELECT * FROM steps WHERE run_id = ? ORDER BY seq", (run_id,)).fetchall()
    run = _run_row(row)
    run["steps"] = [_step_row(s) for s in steps]
    if with_doc:
        run["doc"] = json.loads(row["doc"])
    return run


def list_runs(workflow_id: str, limit: int = 50) -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM runs WHERE workflow_id = ? ORDER BY created_at DESC LIMIT ?",
                            (workflow_id, limit)).fetchall()
        result = []
        for row in rows:
            run = _run_row(row)
            counts = conn.execute("SELECT status, COUNT(*) AS n FROM steps WHERE run_id = ? GROUP BY status",
                                  (row["id"],)).fetchall()
            run["counts"] = {c["status"]: c["n"] for c in counts}
            result.append(run)
    return result


def update_run(run_id: str, **fields: Any) -> None:
    allowed = {"status", "started_at", "finished_at", "error", "pid", "waiting_node", "cancel"}
    keys = [k for k in fields if k in allowed]
    if keys:
        with connect() as conn:
            conn.execute(f"UPDATE runs SET {', '.join(f'{k} = ?' for k in keys)} WHERE id = ?",
                         (*[fields[k] for k in keys], run_id))


def claim_run(run_id: str, pid: int) -> bool:
    """Take a queued (or resumed) run for this process; False when another process has it or it ended."""
    with connect() as conn:
        changed = conn.execute(
            "UPDATE runs SET status = 'running', pid = ?, started_at = COALESCE(started_at, ?) "
            "WHERE id = ? AND status = 'queued'",
            (pid, _now(), run_id),
        ).rowcount
    return bool(changed)


def set_step(run_id: str, node_id: str, **fields: Any) -> None:
    with connect() as conn:
        row = conn.execute("SELECT seq FROM steps WHERE run_id = ? AND node_id = ?", (run_id, node_id)).fetchone()
        if row is None:
            seq = conn.execute("SELECT COALESCE(MAX(seq), 0) + 1 FROM steps WHERE run_id = ?", (run_id,)).fetchone()[0]
            conn.execute("INSERT INTO steps (run_id, node_id, status, seq) VALUES (?, ?, 'pending', ?)",
                         (run_id, node_id, seq))
        allowed = {"status", "output", "data", "error", "started_at", "finished_at"}
        keys = [k for k in fields if k in allowed]
        values = [json.dumps(fields[k], ensure_ascii=False) if k == "data" and fields[k] is not None else fields[k]
                  for k in keys]
        if keys:
            conn.execute(f"UPDATE steps SET {', '.join(f'{k} = ?' for k in keys)} WHERE run_id = ? AND node_id = ?",
                         (*values, run_id, node_id))


def last_outputs(workflow_id: str, before_run: str) -> dict[str, dict]:
    """The newest succeeded output of each step across earlier runs: what ``from step`` starts with."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT s.node_id, s.output, s.data FROM steps s JOIN runs r ON r.id = s.run_id "
            "WHERE r.workflow_id = ? AND r.id != ? AND s.status = 'succeeded' ORDER BY s.finished_at ASC",
            (workflow_id, before_run),
        ).fetchall()
    return {r["node_id"]: {"output": r["output"], "data": json.loads(r["data"]) if r["data"] else None} for r in rows}


def events_since(since: float) -> list[dict]:
    """Runs that ended or began to wait, and Output notifications, after ``since``: what the app announces."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT r.id, r.workflow_id, r.status, r.finished_at, r.waiting_node, r.error, w.name "
            "FROM runs r LEFT JOIN workflows w ON w.id = r.workflow_id "
            "WHERE COALESCE(r.finished_at, 0) > ? OR (r.status = 'waiting' AND r.started_at > ?)",
            (since, since - 86_400),
        ).fetchall()
        notes = conn.execute(
            "SELECT s.run_id, s.node_id, s.output, s.finished_at, r.workflow_id, w.name, s.data FROM steps s "
            "JOIN runs r ON r.id = s.run_id LEFT JOIN workflows w ON w.id = r.workflow_id "
            "WHERE s.finished_at > ? AND s.status = 'succeeded' AND s.data LIKE '%\"notify\": true%'",
            (since,),
        ).fetchall()
    events = [{"type": "run", "run_id": r["id"], "workflow_id": r["workflow_id"], "workflow": r["name"] or "",
               "status": r["status"], "at": r["finished_at"], "waiting_node": r["waiting_node"],
               "error": r["error"]} for r in rows]
    events += [{"type": "notification", "run_id": n["run_id"], "workflow_id": n["workflow_id"],
                "workflow": n["name"] or "", "node_id": n["node_id"], "message": n["output"], "at": n["finished_at"]}
               for n in notes]
    return sorted(events, key=lambda e: e["at"] or 0)
