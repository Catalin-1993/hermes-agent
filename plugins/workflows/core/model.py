"""The workflow document: what the canvas saves and the engine runs.

A workflow is ``{name, description, nodes, edges, viewport}``. Every node has an ``id``, a ``kind``,
a position and a ``config`` whose shape depends on the kind. Visual kinds (text, note, shape) are
never connected and never run. An edge joins one node's output to another's input; an edge that
leaves a Condition carries the branch it belongs to (``yes`` / ``no``).

``normalize`` is the one door a document comes in through: unknown kinds and fields are dropped,
every value is coerced to its type, edges that would touch a visual node, repeat another edge or
close a loop are removed. What comes out is safe to store and to run.
"""

from __future__ import annotations

import re
import secrets
import unicodedata
from typing import Any, Optional

TRIGGER = "trigger"
STEP_KINDS = ("agent", "llm", "image", "video", "condition", "approval", "answer", "output")
VISUAL_KINDS = ("text", "note", "shape")
KINDS = (TRIGGER, *STEP_KINDS, *VISUAL_KINDS)

TRIGGER_TYPES = ("manual", "schedule", "webhook", "github", "discord", "telegram", "slack", "workflow")
# The "workflow" trigger: which ending of the source workflow starts this one.
AFTER_OUTCOMES = ("succeeded", "failed", "finished")
SCHEDULE_MODES = ("daily", "weekdays", "weekly", "hourly", "cron")
ANSWER_FIELD_TYPES = ("text", "number", "boolean", "list")
OUTPUT_CHANNELS = ("notification", "chat", "github", "discord", "telegram", "slack")
SHAPES = ("rectangle", "ellipse", "diamond")
COLORS = ("default", "yellow", "green", "blue", "purple", "red", "orange")
BRANCHES = ("yes", "no")
IMAGE_ASPECTS = ("landscape", "square", "portrait")
VIDEO_ASPECTS = ("16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9")
VIDEO_RESOLUTIONS = ("480p", "540p", "720p", "768p", "1080p")

MAX_NODES = 200
MAX_TEXT = 20_000
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_FIELD_KEY_RE = re.compile(r"[^a-z0-9_]+")
# A GitHub event, optionally narrowed to one action: ``push``, ``pull_request.opened``.
_EVENT_RE = re.compile(r"^[a-z_]{1,40}(\.[a-z_]{1,40})?$")


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(5)}"


def _text(value: Any, limit: int = MAX_TEXT) -> str:
    return value[:limit] if isinstance(value, str) else ""


def _choice(value: Any, options: tuple[str, ...], default: str) -> str:
    return value if value in options else default


def _number(value: Any, default: float, low: float, high: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return min(max(number, low), high) if number == number else default


def _int(value: Any, default: int, low: int, high: int) -> int:
    return int(_number(value, default, low, high))


def _time(value: Any) -> str:
    return value if isinstance(value, str) and _TIME_RE.match(value) else "09:00"


def _schedule(raw: Any) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    return {
        "mode": _choice(raw.get("mode"), SCHEDULE_MODES, "daily"),
        "time": _time(raw.get("time")),
        # 0 = Monday … 6 = Sunday, the order the week is shown in.
        "weekday": _int(raw.get("weekday"), 0, 0, 6),
        "minute": _int(raw.get("minute"), 0, 0, 59),
        "cron": _text(raw.get("cron"), 120).strip(),
    }


def _events(raw: Any) -> list[str]:
    events: list[str] = []
    for item in raw if isinstance(raw, list) else []:
        event = item.strip().lower() if isinstance(item, str) else ""
        if _EVENT_RE.match(event) and event not in events:
            events.append(event)
    return events[:20]


def _trigger_config(raw: dict) -> dict:
    return {
        "type": _choice(raw.get("type"), TRIGGER_TYPES, "manual"),
        "schedule": _schedule(raw.get("schedule")),
        # Chat triggers: only messages that contain this text (empty: every message).
        "filter": _text(raw.get("filter"), 400),
        "repository": _text(raw.get("repository"), 200).strip(),
        "events": _events(raw.get("events")),
        # Chat triggers: one conversation's id (empty: every conversation the bot is in).
        "channel": _text(raw.get("channel"), 200).strip(),
        # Chat triggers: the agent answers the message as well; otherwise the workflow takes it.
        "pass_through": bool(raw.get("pass_through", False)),
        # "workflow" trigger: the workflow whose run starts this one (empty: any other workflow), and when.
        "source": _text(raw.get("source"), 64).strip(),
        "when": _choice(raw.get("when"), AFTER_OUTCOMES, "succeeded"),
    }


def fold(text: str) -> str:
    """Lower case without diacritics: ``Număr`` and ``numar`` name the same field."""
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if not unicodedata.combining(c))


def field_key(label: str, index: int) -> str:
    key = _FIELD_KEY_RE.sub("_", fold(label.strip())).strip("_")
    return key[:40] or f"field_{index + 1}"


def _answer_fields(raw: Any) -> list[dict]:
    fields: list[dict] = []
    seen: set[str] = set()
    for index, item in enumerate(raw if isinstance(raw, list) else []):
        if not isinstance(item, dict) or len(fields) >= 30:
            continue
        label = _text(item.get("label"), 120).strip() or f"Câmp {index + 1}"
        key = _text(item.get("key"), 40).strip() or field_key(label, index)
        key = field_key(key, index)
        if key in seen:
            continue
        seen.add(key)
        options = item.get("options") if isinstance(item.get("options"), list) else []
        fields.append({
            "key": key,
            "label": label,
            "type": _choice(item.get("type"), ANSWER_FIELD_TYPES, "text"),
            "required": bool(item.get("required", True)),
            "options": [o.strip()[:120] for o in options if isinstance(o, str) and o.strip()][:50],
        })
    return fields


def _config(kind: str, raw: Any) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    builders = {
        TRIGGER: lambda: _trigger_config(raw),
        "agent": lambda: {"agent": _text(raw.get("agent"), 64), "task": _text(raw.get("task")),
                          "timeout_min": _int(raw.get("timeout_min"), 30, 1, 240)},
        "llm": lambda: {"prompt": _text(raw.get("prompt")), "system": _text(raw.get("system")),
                        "model": _text(raw.get("model"), 200), "json": bool(raw.get("json", False))},
        # Image / Video: the backend and model the owner chose in Brain's tool settings; ``source`` is an
        # optional image (a URL, a path, or a reference such as {{steps.<id>.image}}) to edit or animate.
        "image": lambda: {"prompt": _text(raw.get("prompt")), "source": _text(raw.get("source"), 2_000),
                          "aspect_ratio": _choice(raw.get("aspect_ratio"), IMAGE_ASPECTS, "landscape")},
        "video": lambda: {"prompt": _text(raw.get("prompt")), "source": _text(raw.get("source"), 2_000),
                          "aspect_ratio": _choice(raw.get("aspect_ratio"), VIDEO_ASPECTS, "16:9"),
                          "resolution": _choice(raw.get("resolution"), VIDEO_RESOLUTIONS, "720p"),
                          "duration": _int(raw.get("duration"), 0, 0, 60)},
        "condition": lambda: {"rule": _text(raw.get("rule"), 2_000)},
        "approval": lambda: {"message": _text(raw.get("message"), 4_000)},
        "answer": lambda: {"message": _text(raw.get("message"), 4_000), "fields": _answer_fields(raw.get("fields"))},
        "output": lambda: {"channel": _choice(raw.get("channel"), OUTPUT_CHANNELS, "notification"),
                           "message": _text(raw.get("message")), "target": _text(raw.get("target"), 300)},
        "text": lambda: {"text": _text(raw.get("text"), 4_000), "size": _int(raw.get("size"), 20, 10, 96)},
        "note": lambda: {"text": _text(raw.get("text"), 4_000), "color": _choice(raw.get("color"), COLORS, "yellow")},
        "shape": lambda: {"shape": _choice(raw.get("shape"), SHAPES, "rectangle"),
                          "color": _choice(raw.get("color"), COLORS, "default"), "label": _text(raw.get("label"), 200)},
    }
    return builders[kind]()


_DEFAULT_SIZE = {"text": (240, 48), "note": (220, 160), "shape": (200, 140)}


def _node(raw: Any) -> Optional[dict]:
    if not isinstance(raw, dict) or raw.get("kind") not in KINDS:
        return None
    kind = raw["kind"]
    node_id = raw.get("id") if isinstance(raw.get("id"), str) and _ID_RE.match(raw["id"]) else new_id("n")
    width, height = _DEFAULT_SIZE.get(kind, (0, 0))
    node = {
        "id": node_id,
        "kind": kind,
        "title": _text(raw.get("title"), 120),
        "x": _number(raw.get("x"), 0, -100_000, 100_000),
        "y": _number(raw.get("y"), 0, -100_000, 100_000),
        "config": _config(kind, raw.get("config")),
    }
    if kind in VISUAL_KINDS:
        node["w"] = _number(raw.get("w"), width, 40, 4_000)
        node["h"] = _number(raw.get("h"), height, 24, 4_000)
    return node


def _creates_loop(edges: list[dict], source: str, target: str) -> bool:
    """True when ``target`` already reaches ``source``: a new ``source → target`` would close a loop."""
    outgoing: dict[str, list[str]] = {}
    for edge in edges:
        outgoing.setdefault(edge["source"], []).append(edge["target"])
    stack, seen = [target], set()
    while stack:
        current = stack.pop()
        if current == source:
            return True
        if current not in seen:
            seen.add(current)
            stack.extend(outgoing.get(current, []))
    return False


def _edges(raw: Any, nodes: dict[str, dict]) -> list[dict]:
    edges: list[dict] = []
    seen: set[tuple] = set()
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            continue
        source, target = nodes.get(item.get("source")), nodes.get(item.get("target"))
        if not source or not target or source is target:
            continue
        if source["kind"] in VISUAL_KINDS or target["kind"] in VISUAL_KINDS or target["kind"] == TRIGGER:
            continue
        branch = _choice(item.get("branch"), BRANCHES, "yes") if source["kind"] == "condition" else None
        signature = (source["id"], target["id"], branch)
        if signature in seen or _creates_loop(edges, source["id"], target["id"]):
            continue
        seen.add(signature)
        edge_id = item.get("id") if isinstance(item.get("id"), str) and _ID_RE.match(item["id"]) else new_id("e")
        edges.append({"id": edge_id, "source": source["id"], "target": target["id"], "branch": branch})
    return edges


def _viewport(raw: Any) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    return {"x": _number(raw.get("x"), 0, -1e6, 1e6), "y": _number(raw.get("y"), 0, -1e6, 1e6),
            "zoom": _number(raw.get("zoom"), 1, 0.2, 2.5)}


def normalize(raw: Any) -> dict:
    """The stored, runnable form of a document the canvas sent. Always has exactly one trigger."""
    raw = raw if isinstance(raw, dict) else {}
    nodes: list[dict] = []
    ids: set[str] = set()
    has_trigger = False
    for item in raw.get("nodes", []) if isinstance(raw.get("nodes"), list) else []:
        node = _node(item)
        if node is None or node["id"] in ids or len(nodes) >= MAX_NODES:
            continue
        if node["kind"] == TRIGGER:
            if has_trigger:
                continue
            has_trigger = True
        ids.add(node["id"])
        nodes.append(node)
    if not has_trigger:
        nodes.insert(0, _node({"kind": TRIGGER, "x": 0, "y": 0, "id": new_id("n")}))
    by_id = {node["id"]: node for node in nodes}
    return {
        "name": _text(raw.get("name"), 120).strip() or "Workflow nou",
        "description": _text(raw.get("description"), 2_000),
        "nodes": nodes,
        "edges": _edges(raw.get("edges"), by_id),
        "viewport": _viewport(raw.get("viewport")),
    }


def starter(name: str = "") -> dict:
    """A new workflow: a manual trigger, one agent step after it."""
    trigger, agent = new_id("n"), new_id("n")
    return normalize({
        "name": name or "Workflow nou",
        "nodes": [
            {"id": trigger, "kind": TRIGGER, "x": 0, "y": 0, "config": {"type": "manual"}},
            {"id": agent, "kind": "agent", "x": 340, "y": 0, "config": {"task": ""}},
        ],
        "edges": [{"source": trigger, "target": agent}],
    })


def _content(node: dict) -> dict:
    return {k: v for k, v in node.items() if k not in ("x", "y", "w", "h")}


def diff(before: Optional[dict], after: dict) -> dict:
    """What a version changed against the one before it: steps added, removed or edited (by name),
    links added and removed, a new name. Moving things on the canvas is not a change."""
    if before is None:
        return {"first": True}
    old = {n["id"]: n for n in before["nodes"]}
    new = {n["id"]: n for n in after["nodes"]}

    def links(doc: dict) -> set:
        return {(e["source"], e["target"], e["branch"]) for e in doc["edges"]}

    return {
        "added": [node_label(new[i]) for i in new if i not in old],
        "removed": [node_label(old[i]) for i in old if i not in new],
        "changed": [node_label(new[i]) for i in new if i in old and _content(new[i]) != _content(old[i])],
        "links_added": len(links(after) - links(before)),
        "links_removed": len(links(before) - links(after)),
        "renamed": before["name"] != after["name"],
        "described": before.get("description", "") != after.get("description", ""),
    }


EXPORT_FORMAT = "brain-workflow"
EXPORT_VERSION = 1


def export(workflow: dict) -> dict:
    """A workflow as a file another Brain can import: the document only. The webhook secret, the cron
    job, the runs and the versions stay here; an import gets its own."""
    doc = normalize(workflow)
    return {"format": EXPORT_FORMAT, "version": EXPORT_VERSION, "workflow": doc}


def from_export(data: Any) -> Optional[dict]:
    """The document inside an exported file (or a bare document), or None when it is neither."""
    if isinstance(data, dict) and data.get("format") == EXPORT_FORMAT and isinstance(data.get("workflow"), dict):
        data = data["workflow"]
    if not isinstance(data, dict) or not isinstance(data.get("nodes"), list):
        return None
    return normalize(data)


def trigger_node(doc: dict) -> dict:
    return next(node for node in doc["nodes"] if node["kind"] == TRIGGER)


def node_label(node: dict) -> str:
    return node.get("title") or {
        TRIGGER: "Declanșator", "agent": "Agent", "llm": "LLM", "image": "Imagine", "video": "Video",
        "condition": "Condiție",
        "approval": "Aprobare", "answer": "Răspuns", "output": "Ieșire", "text": "Text", "note": "Notă",
        "shape": "Formă",
    }.get(node["kind"], node["kind"])
