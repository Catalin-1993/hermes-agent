"""The "How Brain works" page: what Brain remembers, the skills it taught itself, and what its curator did.

Nothing here asks a model anything. It reads three things Brain already keeps — the memory files, the
skill usage records and the curator's run reports — and draws them in the notebook's usual shape, so the
owner can check how Brain works as easily as what it talked about.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime
from typing import Any, Optional

from hermes_cli import library_db as ldb
from hermes_cli import library_notebook as nb
from hermes_cli.library_notebook_text import labels

logger = logging.getLogger(__name__)

_MAX_SKILLS = 30
_MAX_ACTIONS = 25
_RUNS_READ = 12


def _name(entry: Any) -> str:
    return str(entry.get("name") or "") if isinstance(entry, dict) else str(entry or "")


def _actions_of(report: dict) -> list[dict]:
    """The decisions in one curator run, each with its reason when the curator gave one."""
    day = str(report.get("started_at") or "")[:10]
    out = [{"date": day, "kind": "merged", "name": _name(e), "into": str(e.get("into") or ""),
            "reason": str(e.get("reason") or "")} for e in report.get("consolidated") or [] if isinstance(e, dict)]
    out += [{"date": day, "kind": "archived", "name": _name(e), "reason": str(e.get("reason") or "") if isinstance(e, dict) else ""}
            for e in (report.get("pruned") or []) + (report.get("archived") or [])]
    out += [{"date": day, "kind": "added", "name": _name(e)} for e in report.get("added") or []]
    out += [{"date": day, "kind": "moved", "name": str(t.get("name") or ""), "a": t.get("from"), "b": t.get("to")}
            for t in report.get("state_transitions") or [] if isinstance(t, dict)]
    out = [a for a in out if a["name"]]
    auto = report.get("auto_transitions") or {}
    if auto.get("archived") or auto.get("marked_stale"):
        out.append({"date": day, "kind": "auto", "name": "auto", "archived": int(auto.get("archived") or 0),
                    "stale": int(auto.get("marked_stale") or 0)})
    return out


def curator_actions() -> list[dict]:
    """What the curator decided in its latest runs, newest first."""
    from agent.curator import _reports_root

    actions: list[dict] = []
    runs = sorted((d for d in _reports_root().iterdir() if d.is_dir()), reverse=True)[:_RUNS_READ]
    for run in runs:
        try:
            report = json.loads((run / "run.json").read_text(encoding="utf-8-sig"))
        except (OSError, ValueError):
            continue
        actions.extend(_actions_of(report))
        if len(actions) >= _MAX_ACTIONS:
            break
    return actions[:_MAX_ACTIONS]


def _epoch(iso: Optional[str]) -> Optional[int]:
    try:
        return int(datetime.fromisoformat(str(iso)).timestamp()) if iso else None
    except ValueError:
        return None


def build_state() -> dict[str, Any]:
    from agent import curator
    from tools.memory_tool import load_on_disk_store
    from tools.skill_usage import curated_report

    store = load_on_disk_store()
    learned = [r for r in curated_report() if r.get("provenance") == "agent"]
    learned.sort(key=lambda r: (r.get("state") != "active", -int(r.get("activity_count") or 0), r["name"]))
    state = curator.load_state()
    return {
        "user_n": len(store.user_entries), "memory_n": len(store.memory_entries),
        "skills": [{"name": r["name"], "state": r.get("state") or "active", "uses": int(r.get("use_count") or 0),
                    "patches": int(r.get("patch_count") or 0)} for r in learned[:_MAX_SKILLS]],
        "curator": {"enabled": curator.is_enabled() and not curator.is_paused(),
                    "last_run": _epoch(state.get("last_run_at"))},
        "actions": curator_actions(),
    }


def refresh(conn: sqlite3.Connection) -> Optional[ldb.LibraryItem]:
    L = labels(nb.language(conn))
    try:
        state = build_state()
    except Exception as exc:  # health: allow BLE001 -- one source being unreadable must not stop the notebook
        logger.info("notebook: how-Brain-works page not refreshed: %s", exc)
        return None
    return nb.upsert_page(conn, key="work", kind="work", title=L["work"], state=state, parent=None, icon="⚙️")
