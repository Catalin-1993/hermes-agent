"""Memory Atlas: read-only views of the active external memory for the desktop Library home.

The Library home shows the agent's long-term memory beside the owner's notes: a graph, a few
counts, recent documents and knowledge pages. Only Hindsight keeps a browsable graph today, so this
reads its HTTP API; any other provider answers ``unavailable`` and the Library shows the notes alone.

Reads never start anything. A local embedded daemon exits after its idle timeout, so ``wake``
restarts it the same way the provider does at agent start (through the installed provider package,
never a hardcoded import), and the client asks for it only when the owner opens the Library.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from hermes_constants import get_hermes_home

GraphMode = Literal["entities", "world", "experience", "observation"]
DetailKind = Literal["memory", "entity", "document"]

GRAPH_MODES: tuple[GraphMode, ...] = ("entities", "world", "experience", "observation")
DETAIL_PATHS: dict[DetailKind, str] = {"memory": "memories", "entity": "entities", "document": "documents"}

_PROVIDER = "hindsight"
_TIMEOUT_S = 6.0
# The graph is drawn on a canvas; past this many nodes it stops reading as a constellation.
_GRAPH_LIMIT = 400
_RECENT_DOCUMENTS = 6
_TOP_ENTITIES = 8
_DEFAULT_CLOUD_URL = "https://api.hindsight.vectorize.io"
_DEFAULT_EXTERNAL_URL = "http://localhost:8888"


class AtlasUnavailable(Exception):
    """The memory cannot be read: ``reason`` is ``provider`` (not Hindsight), ``asleep`` (a local daemon
    that is not running) or ``error`` (anything else; the message says what)."""

    def __init__(self, reason: Literal["provider", "asleep", "error"], message: str = ""):
        super().__init__(message or reason)
        self.reason = reason


@dataclass(frozen=True)
class Endpoint:
    base_url: str
    bank_id: str
    api_key: str
    local: bool
    profile: str


def _active_provider() -> str:
    from hermes_cli.config import load_config

    return str(((load_config() or {}).get("memory") or {}).get("provider") or "")


def _hindsight_config() -> dict[str, Any]:
    """The provider's own config file: the profile's, else the legacy shared one."""
    for path in (get_hermes_home() / "hindsight" / "config.json", Path.home() / ".hindsight" / "config.json"):
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8") or "{}")
            except (OSError, ValueError):
                continue
            if isinstance(data, dict) and data:
                return data
    return {}


def _embedded_port(profile: str) -> str:
    """The port ``hindsight-embed`` gave this profile's daemon, from the env file it boots from."""
    env = Path.home() / ".hindsight" / "profiles" / f"{profile}.env"
    try:
        for line in env.read_text(encoding="utf-8-sig").splitlines():
            key, _, value = line.strip().partition("=")
            if key == "HINDSIGHT_API_PORT" and value.strip():
                return value.strip()
    except OSError:
        pass
    return ""


def resolve_endpoint() -> Endpoint:
    if _active_provider() != _PROVIDER:
        raise AtlasUnavailable("provider")
    cfg = _hindsight_config()
    mode = str(cfg.get("mode") or "cloud")
    bank = str(cfg.get("bank_id") or "hermes")
    profile = str(cfg.get("profile") or "hermes")
    if mode in ("local", "local_embedded"):
        port = _embedded_port(profile)
        if not port:
            raise AtlasUnavailable("asleep")
        return Endpoint(f"http://127.0.0.1:{port}", bank, "", True, profile)
    from agent.secret_scope import get_secret

    key = str(cfg.get("apiKey") or cfg.get("api_key") or get_secret("HINDSIGHT_API_KEY", "") or "")
    default = _DEFAULT_EXTERNAL_URL if mode == "local_external" else _DEFAULT_CLOUD_URL
    url = str(cfg.get("api_url") or get_secret("HINDSIGHT_API_URL", "") or default)
    return Endpoint(url.rstrip("/"), bank, key, False, profile)


def _get(ep: Endpoint, path: str, query: dict[str, Any] | None = None) -> Any:
    bank = urllib.parse.quote(ep.bank_id, safe="")
    url = f"{ep.base_url}/v1/default/banks/{bank}{path}"
    if query:
        url += "?" + urllib.parse.urlencode({k: v for k, v in query.items() if v is not None})
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    if ep.api_key:
        request.add_header("Authorization", f"Bearer {ep.api_key}")
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_S) as response:
            return json.loads(response.read().decode("utf-8") or "null")
    except urllib.error.HTTPError as exc:
        raise AtlasUnavailable("error", f"Hindsight answered {exc.code} for {path}") from exc
    except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
        if ep.local:
            raise AtlasUnavailable("asleep") from exc
        raise AtlasUnavailable("error", f"Hindsight is unreachable: {exc}") from exc


def _items(payload: Any) -> list[dict[str, Any]]:
    rows = payload.get("items") if isinstance(payload, dict) else payload
    return [row for row in rows or [] if isinstance(row, dict)]


def _document(row: dict[str, Any]) -> dict[str, Any]:
    params = row.get("retain_params") if isinstance(row.get("retain_params"), dict) else {}
    meta = params.get("metadata") if isinstance(params.get("metadata"), dict) else {}
    return {
        "id": str(row.get("id") or ""),
        "context": str(params.get("context") or ""),
        "platform": str(meta.get("platform") or ""),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "memories": int(row.get("memory_unit_count") or 0),
        "chars": int(row.get("text_length") or 0),
    }


def _knowledge(nodes: Any, depth: int = 0) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for node in nodes or []:
        if not isinstance(node, dict):
            continue
        out.append({
            "id": str(node.get("id") or ""),
            "title": str(node.get("title") or node.get("name") or ""),
            "kind": "folder" if node.get("children") is not None and node.get("type") != "page" else "page",
            "depth": depth,
        })
        out.extend(_knowledge(node.get("children"), depth + 1))
    return out


def overview() -> dict[str, Any]:
    """Counts, a 30-day activity series, recent documents, top entities and knowledge pages."""
    ep = resolve_endpoint()
    stats = _get(ep, "/stats") or {}
    series = _get(ep, "/stats/memories-timeseries", {"period": "30d"}) or {}
    documents = _items(_get(ep, "/documents", {"limit": _RECENT_DOCUMENTS}))
    entities = _items(_get(ep, "/entities", {"limit": 200}))
    tree = _get(ep, "/knowledge-base/tree") or {}
    models = _items(_get(ep, "/mental-models"))
    by_type = stats.get("nodes_by_fact_type") if isinstance(stats.get("nodes_by_fact_type"), dict) else {}
    entities.sort(key=lambda row: int(row.get("mention_count") or 0), reverse=True)
    return {
        "bank": ep.bank_id,
        "counts": {
            "memories": int(stats.get("total_nodes") or 0),
            "links": int(stats.get("total_links") or 0),
            "documents": int(stats.get("total_documents") or 0),
            "entities": len(entities),
            "world": int(by_type.get("world") or 0),
            "experience": int(by_type.get("experience") or 0),
            "observation": int(by_type.get("observation") or 0),
        },
        "last_write_at": stats.get("last_memory_write_at"),
        "activity": [
            {
                "time": bucket.get("time"),
                "count": sum(int(bucket.get(kind) or 0) for kind in ("world", "experience", "observation")),
            }
            for bucket in series.get("buckets") or []
            if isinstance(bucket, dict)
        ],
        "documents": [_document(row) for row in documents],
        "entities": [
            {"id": str(row.get("id") or ""), "name": str(row.get("canonical_name") or ""),
             "mentions": int(row.get("mention_count") or 0)}
            for row in entities[:_TOP_ENTITIES]
        ],
        "knowledge": _knowledge(tree.get("roots")) + [
            {"id": str(row.get("id") or ""), "title": str(row.get("name") or row.get("title") or ""),
             "kind": "model", "depth": 0}
            for row in models
        ],
    }


def _cyto(rows: Any) -> list[dict[str, Any]]:
    """Hindsight's graph rows are Cytoscape elements (``{"data": {...}}``)."""
    return [row["data"] for row in rows or [] if isinstance(row, dict) and isinstance(row.get("data"), dict)]


def graph(mode: GraphMode) -> dict[str, Any]:
    """Nodes and links for one view of the memory, in one shape whatever the view."""
    if mode not in GRAPH_MODES:
        raise ValueError(f"mode must be one of {', '.join(GRAPH_MODES)}")
    ep = resolve_endpoint()
    if mode == "entities":
        payload = _get(ep, "/entities/graph", {"limit": _GRAPH_LIMIT}) or {}
        nodes = [
            {"id": str(n.get("id")), "label": str(n.get("label") or ""), "text": str(n.get("label") or ""),
             "weight": int(n.get("mentionCount") or 1), "date": None}
            for n in _cyto(payload.get("nodes"))
        ]
    else:
        payload = _get(ep, "/graph", {"type": mode, "limit": _GRAPH_LIMIT}) or {}
        nodes = [
            {"id": str(n.get("id")), "label": str(n.get("label") or ""), "text": str(n.get("text") or ""),
             "weight": 1, "date": n.get("date")}
            for n in _cyto(payload.get("nodes"))
        ]
    ids = {node["id"] for node in nodes}
    # Hindsight sends one edge per link type, so a pair can come twice or three times: keep the
    # strongest, or the graph draws the same line over itself.
    strongest: dict[tuple[str, str], dict[str, Any]] = {}
    for e in _cyto(payload.get("edges")):
        source, target = str(e.get("source")), str(e.get("target"))
        if source not in ids or target not in ids or source == target:
            continue
        link = {"source": source, "target": target, "type": str(e.get("linkType") or "semantic"),
                "weight": float(e.get("weight") or 1)}
        pair = (min(source, target), max(source, target))
        if pair not in strongest or link["weight"] > strongest[pair]["weight"]:
            strongest[pair] = link
    links = list(strongest.values())
    if mode != "entities":
        degree: dict[str, int] = {}
        for link in links:
            degree[link["source"]] = degree.get(link["source"], 0) + 1
            degree[link["target"]] = degree.get(link["target"], 0) + 1
        for node in nodes:
            node["weight"] = degree.get(node["id"], 0)
    return {"mode": mode, "nodes": nodes, "links": links}


def detail(kind: DetailKind, item_id: str) -> dict[str, Any]:
    """One memory, entity or document as Hindsight stores it (the client picks what it shows)."""
    if kind not in DETAIL_PATHS:
        raise ValueError(f"kind must be one of {', '.join(DETAIL_PATHS)}")
    if not item_id:
        raise ValueError("id is required")
    ep = resolve_endpoint()
    data = _get(ep, f"/{DETAIL_PATHS[kind]}/{urllib.parse.quote(item_id, safe='')}")
    return data if isinstance(data, dict) else {}


def wake() -> None:
    """Start the profile's local embedded daemon if it is down; returns once it answers."""
    ep = resolve_endpoint()
    if not ep.local:
        return
    try:
        _get(ep, "/stats")
        return
    except AtlasUnavailable as exc:
        if exc.reason != "asleep":
            raise
    from plugins.memory import import_provider_module

    package = import_provider_module(_PROVIDER)
    embedded = import_provider_module(_PROVIDER, "embedded")
    cfg = package._load_config()
    embedded._export_port_health_grace_timeout(cfg)
    env = embedded._build_embedded_profile_env(cfg)
    if cfg.get("idle_timeout") not in (None, ""):
        env["HINDSIGHT_EMBED_DAEMON_IDLE_TIMEOUT"] = str(cfg["idle_timeout"])
    embedded._start_daemon(env, ep.profile)
    _get(resolve_endpoint(), "/stats")
