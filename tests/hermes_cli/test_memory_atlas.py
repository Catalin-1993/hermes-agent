"""Memory Atlas reads the active Hindsight memory over HTTP for the Library home (hermes_cli/memory_atlas.py).

E2E against a stub Hindsight API on a local port and a temp HERMES_HOME: which provider is active,
where the endpoint comes from, and the one graph shape the desktop draws.
"""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

from hermes_cli import memory_atlas

_BANK = "/v1/default/banks/notes"


def _cy(**data):
    return {"data": data}


_ROUTES = {
    f"{_BANK}/graph": {
        "nodes": [_cy(id="a", label="A…", text="Alpha fact", date="2026-11-25T00:00:00Z"),
                  _cy(id="b", label="B…", text="Beta fact", date=None)],
        # One pair three times (one per link type) and an edge to a node outside the answer.
        "edges": [_cy(source="a", target="b", linkType="temporal", weight=0.4),
                  _cy(source="b", target="a", linkType="semantic", weight=0.9),
                  _cy(source="a", target="b", linkType="entity", weight=0.1),
                  _cy(source="a", target="zzz", linkType="semantic", weight=1)],
    },
    f"{_BANK}/entities/graph": {
        "nodes": [_cy(id="e1", label="Hermes", mentionCount=7), _cy(id="e2", label="Vasi", mentionCount=2)],
        "edges": [_cy(source="e1", target="e2", linkType="cooccurrence", weight=3)],
    },
}


class _Stub(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlparse(self.path)
        _Stub.seen.append((url.path, parse_qs(url.query)))
        body = _ROUTES.get(url.path)
        self.send_response(200 if body is not None else 404)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body or {}).encode())

    def log_message(self, *args):
        pass


@pytest.fixture
def hindsight(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    (home / "hindsight").mkdir(parents=True)
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    monkeypatch.setenv("HERMES_HOME", str(home))
    (home / "config.yaml").write_text("memory:\n  provider: hindsight\n", encoding="utf-8")
    _Stub.seen = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), _Stub)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield home, f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    server.server_close()


def _config(home: Path, **cfg) -> None:
    (home / "hindsight" / "config.json").write_text(json.dumps(cfg), encoding="utf-8")


def test_fact_graph_keeps_one_strongest_line_per_pair(hindsight):
    home, url = hindsight
    _config(home, mode="local_external", api_url=url, bank_id="notes")

    graph = memory_atlas.graph("world")

    assert [n["id"] for n in graph["nodes"]] == ["a", "b"]
    assert graph["links"] == [{"source": "b", "target": "a", "type": "semantic", "weight": 0.9}]
    assert {n["id"]: n["weight"] for n in graph["nodes"]} == {"a": 1, "b": 1}
    assert _Stub.seen[-1] == (f"{_BANK}/graph", {"type": ["world"], "limit": ["400"]})


def test_entity_graph_sizes_nodes_by_mentions(hindsight):
    home, url = hindsight
    _config(home, mode="local_external", api_url=url, bank_id="notes")

    graph = memory_atlas.graph("entities")

    assert {n["label"]: n["weight"] for n in graph["nodes"]} == {"Hermes": 7, "Vasi": 2}
    assert len(graph["links"]) == 1


def test_another_provider_is_unavailable_without_any_request(hindsight):
    home, url = hindsight
    (home / "config.yaml").write_text("memory:\n  provider: honcho\n", encoding="utf-8")
    _config(home, mode="local_external", api_url=url, bank_id="notes")

    with pytest.raises(memory_atlas.AtlasUnavailable) as caught:
        memory_atlas.overview()

    assert caught.value.reason == "provider"
    assert _Stub.seen == []


def test_embedded_daemon_that_is_down_reads_as_asleep(hindsight, tmp_path):
    home, _url = hindsight
    _config(home, mode="local_embedded", bank_id="notes", profile="p1")
    profiles = tmp_path / ".hindsight" / "profiles"
    profiles.mkdir(parents=True)
    # A port nothing listens on: the daemon exited on its idle timeout.
    (profiles / "p1.env").write_text("HINDSIGHT_API_PORT=9\n", encoding="utf-8")

    with pytest.raises(memory_atlas.AtlasUnavailable) as caught:
        memory_atlas.graph("entities")

    assert caught.value.reason == "asleep"
