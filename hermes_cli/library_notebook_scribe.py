"""The scribe: writes Brain's notebook from the conversations it has finished.

A conversation is documented once it has been quiet for a while (``library.notebook.min_idle_minutes``),
and again only when it has grown. One small auxiliary-model call per conversation returns the *content*
(summary, decisions, next steps…) as JSON; the pages themselves are drawn by ``library_notebook_text.py``
and written by ``library_notebook.py``, so the model never touches the notebook's layout and a bad reply
costs nothing but that one conversation's update. Nothing here runs inside a chat turn, so the chat's
prompt cache is never involved.
"""

from __future__ import annotations

import json
import logging
import re
import sqlite3
import threading
import time
from contextlib import closing
from pathlib import Path
from typing import Any, Optional

from hermes_cli import library_db as ldb
from hermes_cli import library_notebook as nb
from hermes_cli.library_notebook_text import STATUSES, labels
from hermes_cli.sqlite_util import write_txn

logger = logging.getLogger(__name__)

_RUN_LOCK = threading.Lock()
_TRANSCRIPT_CHARS = 24_000
_MAX_ITEMS = 12
_MAX_TEXT = 320
_MIN_NEW_MESSAGES = 2

_PROMPT = """You keep Brain's notebook: a calm, well-organised record of what the owner and Brain did together, \
which the owner will read to remember and to check Brain for mistakes.

Write for a complete beginner: short sentences, plain words, no jargon, no filler. Write in the same language the \
owner writes in. Use only what the conversation actually says; never guess. Never copy passwords, keys, tokens or \
other secrets.

Reply with ONE JSON object and nothing else:
{
  "language": "two-letter code of the language the owner writes in, e.g. ro, en, de, es, fr",
  "conversation": {
    "title": "3-8 words naming what this conversation was about",
    "summary": "one or two short sentences: what happened and the result",
    "decisions": [{"text": "something decided", "why": "the reason, if it was said"}],
    "next": ["a step still left to do, as a short action"],
    "learned": ["a lasting fact or preference about the owner, ONLY if the owner clearly said it"],
    "details": "optional: a few short paragraphs of what is worth remembering, or empty"
  },
  "project": null or {
    "status": "active | blocked | done | idea",
    "summary": "where the project stands now, in one or two sentences",
    "decisions": [{"text": "...", "why": "..."}],
    "next": ["every step that is still open for the project now"],
    "questions": ["something still unanswered"],
    "log": "one short line: what this conversation changed in the project"
  },
  "topics": [{"name": "a subject, 1-3 words", "summary": "one sentence", "points": ["a thing worth remembering"]}]
}
Rules: "project" is null unless a project is named below. When a project already exists, return its COMPLETE updated \
lists (keep what is still true, drop what is finished). At most 2 topics; reuse an existing topic name when it fits. \
Keep every list under 10 items. Leave a list empty rather than inventing."""


# ---------------------------------------------------------------- settings

def settings() -> dict[str, Any]:
    from hermes_cli.config import load_config_readonly

    section = ((load_config_readonly() or {}).get("library") or {}).get("notebook") or {}
    return {
        "enabled": bool(section.get("enabled", True)),
        "min_idle_minutes": max(1, int(section.get("min_idle_minutes", 30))),
        "max_per_run": max(1, int(section.get("max_per_run", 5))),
        "max_per_day": max(1, int(section.get("max_per_day", 40))),
        "min_messages": max(2, int(section.get("min_messages", 4))),
        "include_profiles": bool(section.get("include_profiles", True)),
    }


# ---------------------------------------------------------------- picking conversations

def _documented_today(conn: sqlite3.Connection) -> int:
    midnight = time.mktime(time.localtime()[:3] + (0, 0, 0, 0, 0, -1))
    return conn.execute("SELECT COUNT(*) FROM notebook_sessions WHERE documented_at >= ?", (int(midnight),)).fetchone()[0]


def pending_sessions(conn: sqlite3.Connection, db, *, idle_seconds: float, min_messages: int,
                     since: Optional[float] = None, limit: int = 200, scope: str = "") -> list[dict]:
    """Conversations that are quiet and have something new since they were last documented, oldest first.
    ``scope`` is the profile's name plus a colon for a profile other than the one running (ids repeat across profiles)."""
    now = time.time()
    rows = db.list_sessions_rich(order_by_last_active=True, min_message_count=min_messages, limit=limit,
                                 exclude_sources=["cron"])
    seen = {r[0]: r[1] for r in conn.execute("SELECT session_id, msg_count FROM notebook_sessions")}
    picked = []
    for row in rows:
        sid = str(row.get("id") or "")
        last = float(row.get("last_active") or row.get("started_at") or 0)
        if not sid or now - last < idle_seconds or (since is not None and last < since):
            continue
        if nb.is_ignored(conn, f"session:{scope}{sid}"):
            continue
        if f"{scope}{sid}" in seen and int(row.get("message_count") or 0) < seen[f"{scope}{sid}"] + _MIN_NEW_MESSAGES:
            continue
        picked.append(row)
    return sorted(picked, key=lambda r: float(r.get("last_active") or r.get("started_at") or 0))


def _transcript(db, session_id: str) -> str:
    from agent.message_content import flatten_message_text
    from agent.redact import redact_for_egress

    lines = []
    for message in db.get_messages(session_id, include_ancestors=True):
        role = message.get("role")
        if role not in ("user", "assistant"):
            continue
        text = flatten_message_text(message.get("content")).strip()
        if text:
            lines.append(f"{'Owner' if role == 'user' else 'Brain'}: {text}")
    text = "\n\n".join(lines)
    if len(text) > _TRANSCRIPT_CHARS:
        head = _TRANSCRIPT_CHARS // 6
        text = text[:head] + "\n\n[… the middle of the conversation is left out …]\n\n" + text[-(_TRANSCRIPT_CHARS - head):]
    return redact_for_egress(text)


# ---------------------------------------------------------------- the model's answer

def _text(value: Any, limit: int = _MAX_TEXT) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _texts(value: Any) -> list[str]:
    return [t for t in (_text(v) for v in (value if isinstance(value, list) else [])) if t][:_MAX_ITEMS]


def _decisions(value: Any) -> list[dict[str, str]]:
    out = []
    for entry in value if isinstance(value, list) else []:
        item = entry if isinstance(entry, dict) else {"text": entry}
        if _text(item.get("text")):
            out.append({"text": _text(item.get("text")), "why": _text(item.get("why"))})
    return out[:_MAX_ITEMS]


def parse_answer(raw: str) -> Optional[dict[str, Any]]:
    """The model's JSON, cut down to the shapes the pages expect; None when there is nothing usable."""
    match = re.search(r"\{.*\}", raw or "", re.DOTALL)
    try:
        data = json.loads(match.group(0)) if match else None
    except ValueError:
        return None
    if not isinstance(data, dict) or not isinstance(data.get("conversation"), dict):
        return None
    c = data["conversation"]
    answer: dict[str, Any] = {
        "language": _text(data.get("language"), 5).lower(),
        "conversation": {"title": _text(c.get("title"), 90), "summary": _text(c.get("summary"), 500),
                         "decisions": _decisions(c.get("decisions")), "next": _texts(c.get("next")),
                         "learned": _texts(c.get("learned")), "details": str(c.get("details") or "").strip()[:2500]},
        "project": None, "topics": [],
    }
    p = data.get("project")
    if isinstance(p, dict):
        answer["project"] = {"status": p.get("status") if p.get("status") in STATUSES else "active",
                             "summary": _text(p.get("summary"), 500), "decisions": _decisions(p.get("decisions")),
                             "next": _texts(p.get("next")), "questions": _texts(p.get("questions")),
                             "log": _text(p.get("log"))}
    for t in (data.get("topics") if isinstance(data.get("topics"), list) else [])[:2]:
        if isinstance(t, dict) and _text(t.get("name"), 40):
            answer["topics"].append({"name": _text(t.get("name"), 40), "summary": _text(t.get("summary"), 300),
                                     "points": _texts(t.get("points"))})
    return answer if answer["conversation"]["summary"] else None


def ask_model(*, transcript: str, project: Optional[dict], topics: list[str]) -> Optional[dict[str, Any]]:
    from agent.auxiliary_client import call_llm, extract_content_or_reasoning

    known = {"project": project["name"] if project else None,
             "existing_project_notes": project.get("state") if project else None, "existing_topics": topics[:40]}
    response = call_llm(
        task="library_notebook", temperature=None, max_tokens=2400,
        messages=[{"role": "system", "content": _PROMPT},
                  {"role": "user", "content": f"Known so far:\n{json.dumps(known, ensure_ascii=False)}\n\n"
                                              f"The conversation:\n\n{transcript}"}])
    return parse_answer(extract_content_or_reasoning(response))


# ---------------------------------------------------------------- writing the pages

def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", _text(text, 60).lower().replace("ă", "a").replace("â", "a").replace("î", "i")
                  .replace("ș", "s").replace("ş", "s").replace("ț", "t").replace("ţ", "t")).strip("-") or "x"


def _project_of(row: dict) -> Optional[dict]:
    """The Project a conversation belongs to, from the folder it ran in; None for the home folder and below."""
    from pathlib import Path

    from hermes_cli import projects_db
    from hermes_state_sessions import workspace_key

    folder = workspace_key(row)
    if not folder or Path(folder).expanduser() == Path.home():
        return None
    try:
        with projects_db.connect_closing() as pconn:
            found = projects_db.find_by_primary_path(pconn, folder)
        name = found.name if found is not None else ""
    except Exception:  # health: allow BLE001 -- no Projects store yet: the folder's own name stands in
        name = ""
    name = name or Path(folder).name
    return {"name": name, "slug": _slug(name)}


def _month_folder(conn: sqlite3.Connection, when: float) -> Optional[str]:
    L = labels(nb.language(conn))
    parent = nb.ensure_folder(conn, "conversations", L["conversations"], None, "💬")
    month = time.strftime("%Y-%m", time.localtime(when))
    return nb.ensure_folder(conn, f"month:{month}", month, parent) if parent else None


def _merge_project(old: dict, new: dict, name: str, day: str, talk: dict) -> dict:
    talks = [t for t in old.get("talks", []) if t.get("id") != talk["id"]] + [talk]
    log = list(old.get("log", []))
    if new.get("log"):
        log.append({"date": day, "text": new["log"]})
    return {"name": name, "status": new["status"], "summary": new["summary"] or old.get("summary", ""),
            "decisions": new["decisions"] or old.get("decisions", []), "next": new["next"],
            "questions": new["questions"], "talks": talks[-30:], "log": log[-40:]}


def _merge_topic(old: dict, new: dict, talk: dict) -> dict:
    points = list(dict.fromkeys(old.get("points", []) + new["points"]))[-_MAX_ITEMS * 2:]
    talks = [t for t in old.get("talks", []) if t.get("id") != talk["id"]] + [talk]
    return {"name": old.get("name") or new["name"], "summary": new["summary"] or old.get("summary", ""),
            "points": points, "talks": talks[-30:]}


def _profile_folder(conn: sqlite3.Connection, name: str) -> Optional[str]:
    L = labels(nb.language(conn))
    parent = nb.ensure_folder(conn, "profiles", L["profiles"], None, "👥")
    return nb.ensure_folder(conn, f"profilefolder:{name}", name, parent, "👤") if parent else None


def refresh_profile_page(conn: sqlite3.Connection, name: str) -> None:
    """One overview per profile — what it decided, what is left, what was said — drawn from its conversation pages."""
    L = labels(nb.language(conn))
    rows = conn.execute("SELECT state FROM notebook_pages WHERE key LIKE ? ORDER BY updated_at DESC LIMIT 12",
                        (f"conversation:{name}:%",)).fetchall()
    states = [json.loads(r[0] or "{}") for r in rows]
    day = lambda st: time.strftime("%Y-%m-%d", time.localtime(st.get("date") or time.time()))
    state = {"name": name,
             "decisions": [{"date": day(st), **d} for st in states for d in st.get("decisions", [])][:10],
             "next": list(dict.fromkeys(t for st in states for t in st.get("next", [])))[:12],
             "talks": [{"date": day(st), "title": st.get("title"), "summary": st.get("summary")} for st in states]}
    nb.upsert_page(conn, key=f"profile:{name}", kind="profile", title=L["overview"], state=state,
                   parent=_profile_folder(conn, name), icon="👤")


def write_answer(conn: sqlite3.Connection, row: dict, answer: dict[str, Any], profile: Optional[str] = None) -> None:
    """Put one conversation's answer into its pages: the conversation, and — for the profile running — its
    project and topics. A conversation from another profile gets its page under that profile's folder."""
    nb.set_language(conn, answer["language"])
    nb.ensure_skeleton(conn)
    L = labels(nb.language(conn))
    sid, when = str(row["id"]), float(row.get("last_active") or row.get("started_at") or time.time())
    day = time.strftime("%Y-%m-%d", time.localtime(when))
    project = _project_of(row) if answer["project"] is not None and profile is None else None
    c = answer["conversation"]
    title = c["title"] or _text(row.get("title"), 90) or L["conversations"]
    talk = {"id": sid, "title": title, "date": day}
    state = {**c, "title": title, "date": when, "project": project["slug"] if project else "", "profile": profile or ""}
    key = f"conversation:{profile}:{sid}" if profile else f"conversation:{sid}"
    nb.upsert_page(conn, key=key, kind="conversation", title=title, state=state,
                   parent=_profile_folder(conn, profile) if profile else _month_folder(conn, when), icon="💬",
                   session_id=None if profile else sid, note=c["summary"])
    if profile:
        refresh_profile_page(conn, profile)
        return
    if project and answer["project"] is not None:
        key = f"project:{project['slug']}"
        merged = _merge_project(nb.state_of(conn, key), answer["project"], project["name"], day, talk)
        nb.upsert_page(conn, key=key, kind="project", title=project["name"], state=merged,
                       parent=nb.ensure_folder(conn, "projects", L["projects"], None, "📁"), icon="📁",
                       note=answer["project"]["log"] or answer["project"]["summary"])
    for topic in answer["topics"]:
        key = f"topic:{_slug(topic['name'])}"
        merged = _merge_topic(nb.state_of(conn, key), topic, talk)
        nb.upsert_page(conn, key=key, kind="topic", title=merged["name"], state=merged,
                       parent=nb.ensure_folder(conn, "topics", L["topics"], None, "🧠"), icon="🧠",
                       note=topic["summary"])


def _known_topics(conn: sqlite3.Connection) -> list[str]:
    return [r[0] for r in conn.execute("SELECT title FROM notebook_pages WHERE key LIKE 'topic:%'")]


def document_session(conn: sqlite3.Connection, db, row: dict, profile: Optional[str] = None) -> bool:
    sid = str(row["id"])
    transcript = _transcript(db, sid)
    if len(transcript) < 80:
        return False
    project = _project_of(row) if profile is None else None
    known = None
    if project:
        known = {"name": project["name"], "state": nb.state_of(conn, f"project:{project['slug']}")}
    answer = ask_model(transcript=transcript, project=known, topics=_known_topics(conn))
    if answer is None:
        return False
    write_answer(conn, row, answer, profile)
    with write_txn(conn):
        conn.execute("INSERT INTO notebook_sessions (session_id, msg_count, documented_at) VALUES (?, ?, ?) "
                     "ON CONFLICT(session_id) DO UPDATE SET msg_count = excluded.msg_count, "
                     "documented_at = excluded.documented_at",
                     (f"{profile}:{sid}" if profile else sid, int(row.get("message_count") or 0), int(time.time())))
    return True


# ---------------------------------------------------------------- the overview pages

def refresh_overview(conn: sqlite3.Connection) -> None:
    """"What's next" and "Start here" are drawn from the other pages: no model involved."""
    L = labels(nb.language(conn))
    groups, loose, others = [], [], {}
    for key, state in ((r[0], json.loads(r[1] or "{}")) for r in
                       conn.execute("SELECT key, state FROM notebook_pages WHERE kind IN ('project', 'conversation') "
                                    "ORDER BY updated_at DESC")):
        if key.startswith("project:") and state.get("next"):
            groups.append({"title": state.get("name"), "next": state["next"]})
        elif key.startswith("conversation:") and state.get("profile") and state.get("next"):
            others.setdefault(state["profile"], []).extend(state["next"])
        elif key.startswith("conversation:") and not state.get("project") and state.get("next"):
            loose.extend(state["next"])
    groups += [{"title": f"{L['profile']}: {name}", "next": list(dict.fromkeys(items))[:10]}
               for name, items in others.items()]
    if loose:
        groups.append({"title": L["no_project"], "next": loose[:15]})
    nb.upsert_page(conn, key="todo", kind="todo", title=L["todo"], state={"groups": groups}, parent=None, icon="✅")
    recent = [{"title": r[0], "date": time.strftime("%Y-%m-%d", time.localtime(r[1]))} for r in conn.execute(
        "SELECT title, updated_at FROM notebook_pages WHERE kind IN ('project', 'conversation', 'topic') "
        "ORDER BY updated_at DESC LIMIT 8")]
    nb.upsert_page(conn, key="start", kind="start", title=L["start"], state={"recent": recent}, parent=None, icon="🧭")


# ---------------------------------------------------------------- the run

def _other_profiles() -> list[tuple[str, Path]]:
    """``(name, state.db path)`` of every other profile that has conversations of its own."""
    from hermes_cli.profiles import get_profile_dir, list_profile_names
    from hermes_constants import get_hermes_home

    own = get_hermes_home().resolve()
    found = []
    for name in list_profile_names():
        try:
            home = get_profile_dir(name)
        except ValueError:
            continue
        if home.resolve() != own and (home / "state.db").is_file():
            found.append((name, home / "state.db"))
    return found


def _document_all(conn: sqlite3.Connection, picks: list[tuple[Optional[str], Any, dict]]) -> int:
    done = 0
    for profile, db, row in picks:
        try:
            done += 1 if document_session(conn, db, row, profile) else 0
        except Exception as exc:  # health: allow BLE001 -- one conversation's trouble never stops the rest
            logger.info("notebook: %s not documented: %s", row.get("id"), exc)
    return done


def run_once(*, days: Optional[int] = None, limit: Optional[int] = None, idle_minutes: Optional[float] = None) -> dict:
    """Document what is waiting — this profile's conversations first, then the other profiles'. ``days`` reaches
    back that far (the owner asked for a catch-up); the scheduled tick only looks at what went quiet recently
    and is held to the daily cap."""
    cfg = settings()
    if not cfg["enabled"] and days is None:
        return {"ran": False, "reason": "disabled", "documented": 0}
    if not _RUN_LOCK.acquire(blocking=False):
        return {"ran": False, "reason": "busy", "documented": 0}
    documented = 0
    try:
        from hermes_cli.library_notebook_about import refresh
        from hermes_cli.library_notebook_work import refresh as refresh_work
        from hermes_state import SessionDB

        with ldb.connect_closing() as conn, closing(SessionDB(read_only=True)) as own_db:
            nb.ensure_skeleton(conn)
            nb.set_meta(conn, "last_run", int(time.time()))
            budget = cfg["max_per_run"] if days is None else (limit or 25)
            if days is None:
                budget = min(budget, max(0, cfg["max_per_day"] - _documented_today(conn)))
            idle = (cfg["min_idle_minutes"] if idle_minutes is None else idle_minutes) * 60
            since = time.time() - days * 86400 if days else None
            ask = {"idle_seconds": idle, "min_messages": cfg["min_messages"], "since": since}
            picks = [(None, own_db, r) for r in pending_sessions(conn, own_db, **ask)[:budget]]
            documented += _document_all(conn, picks)
            for name, path in _other_profiles() if cfg["include_profiles"] else []:
                if documented >= budget:
                    break
                with closing(SessionDB(db_path=path, read_only=True)) as db:
                    rows = pending_sessions(conn, db, scope=f"{name}:", **ask)[:budget - documented]
                    documented += _document_all(conn, [(name, db, r) for r in rows])
            refresh(conn)
            refresh_work(conn)
            refresh_overview(conn)
            nb.set_meta(conn, "last_documented", documented)
    finally:
        _RUN_LOCK.release()
    return {"ran": True, "documented": documented}


def run_in_background(**kwargs: Any) -> bool:
    """Start a run on its own thread; False when one is already going."""
    if _RUN_LOCK.locked():
        return False
    from agent.memory_provider import spawn_context_thread

    spawn_context_thread(run_once, name="library-notebook", kwargs=kwargs).start()
    return True


def maybe_run() -> Optional[dict]:
    """The hourly tick of ``hermes serve``: best effort, never raises."""
    try:
        return run_once() if settings()["enabled"] else None
    except Exception as exc:  # health: allow BLE001 -- best-effort hourly tick; the next one retries
        logger.debug("notebook tick skipped: %s", exc)
        return None
