"""Memory Atlas JSON-RPC handlers (``hermes_cli/memory_atlas.py``): the Library home's read-only view
of the active external memory. Profile-scoped — the memory provider and its config are the profile's.
All run on the pool: they wait on the memory's HTTP API, and ``wake`` on a daemon start.

Bodies are rebound onto server.py's globals (method_ctx.bind_module) and reference them bare.
"""

from __future__ import annotations

from .method_ctx import HandlerRegistry, bind_module

_registry = HandlerRegistry()
method = _registry.method
_profile_scoped = _registry.profile_scoped


def _atlas_call(rid, produce) -> dict:
    """Run *produce* and fold "no memory to read" into the answer's ``state`` instead of an error."""
    from hermes_cli.memory_atlas import AtlasUnavailable
    try:
        return _ok(rid, {"state": "ready", "message": "", **produce()})
    except AtlasUnavailable as exc:
        return _ok(rid, {"state": exc.reason, "message": str(exc) if exc.reason == "error" else ""})
    except ValueError as exc:
        return _err(rid, 4002, str(exc))
    except Exception as exc:
        return _ok(rid, {"state": "error", "message": str(exc)})


@method("memory_atlas.overview")
@_profile_scoped
def _(rid, params: dict) -> dict:
    from hermes_cli import memory_atlas
    return _atlas_call(rid, lambda: {"overview": memory_atlas.overview()})


@method("memory_atlas.graph")
@_profile_scoped
def _(rid, params: dict) -> dict:
    from hermes_cli import memory_atlas
    mode = str(params.get("mode") or "entities")
    if mode not in memory_atlas.GRAPH_MODES:
        return _err(rid, 4002, f"mode must be one of {', '.join(memory_atlas.GRAPH_MODES)}")
    reply = _atlas_call(rid, lambda: memory_atlas.graph(mode))
    if "result" in reply:
        reply["result"].setdefault("mode", mode)
    return reply


@method("memory_atlas.detail")
@_profile_scoped
def _(rid, params: dict) -> dict:
    from hermes_cli import memory_atlas
    kind, item_id = str(params.get("kind") or ""), str(params.get("id") or "")
    return _atlas_call(rid, lambda: {"item": memory_atlas.detail(kind, item_id)})


@method("memory_atlas.wake")
@_profile_scoped
def _(rid, params: dict) -> dict:
    from hermes_cli import memory_atlas
    return _atlas_call(rid, lambda: memory_atlas.wake() or {})


def register(server) -> None:
    bind_module(globals(), server, skip=("_",))
    server._LONG_HANDLERS = server._LONG_HANDLERS | _registry.names()
