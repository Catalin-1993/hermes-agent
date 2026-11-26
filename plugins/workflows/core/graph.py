"""Which steps a run reaches and when each may start.

A run starts at one node (the trigger for a whole run, the chosen step for ``from`` and ``step``)
and covers what lies downstream of it (``step`` covers only that node). A covered step starts once
every covered step that leads into it has finished: it runs when at least one of those links is
live, and is skipped when none is (every way in was a Condition branch not taken, or a skipped step).
Links from steps the run does not cover count as live: their output comes from an earlier run.
"""

from __future__ import annotations

from dataclasses import dataclass

from plugins.workflows.core import model

DONE = ("succeeded", "skipped")


@dataclass(frozen=True)
class Plan:
    covered: frozenset
    incoming: dict  # node id -> list of edges into it
    outgoing: dict  # node id -> list of edges out of it
    order: tuple  # the covered steps, each after every covered step that leads into it


def _order(covered: set, incoming: dict, positions: dict) -> tuple:
    """Covered steps in run order; ties by position on the canvas (left to right, top to bottom)."""
    waiting = {n: sum(1 for e in incoming.get(n, []) if e["source"] in covered) for n in covered}
    placed: list[str] = []
    while waiting:
        free = sorted((n for n, count in waiting.items() if count == 0), key=lambda n: positions.get(n, (0, 0)))
        if not free:  # cannot happen for a normalised document (no loops); keep every step anyway
            free = sorted(waiting, key=lambda n: positions.get(n, (0, 0)))
        current = free[0]
        placed.append(current)
        del waiting[current]
        for target in waiting:
            waiting[target] -= sum(1 for e in incoming.get(target, []) if e["source"] == current)
    return tuple(placed)


def plan(doc: dict, *, mode: str, start: str) -> Plan:
    runnable = {n["id"] for n in doc["nodes"] if n["kind"] not in model.VISUAL_KINDS}
    incoming: dict[str, list[dict]] = {}
    outgoing: dict[str, list[dict]] = {}
    for edge in doc["edges"]:
        if edge["source"] in runnable and edge["target"] in runnable:
            incoming.setdefault(edge["target"], []).append(edge)
            outgoing.setdefault(edge["source"], []).append(edge)
    positions = {n["id"]: (n["x"], n["y"]) for n in doc["nodes"]}
    if mode == "step":
        return Plan(frozenset({start}), incoming, outgoing, (start,))
    covered, stack = set(), [start]
    while stack:
        current = stack.pop()
        if current not in covered:
            covered.add(current)
            stack.extend(edge["target"] for edge in outgoing.get(current, []))
    return Plan(frozenset(covered), incoming, outgoing, _order(covered, incoming, positions))


def _edge_live(edge: dict, states: dict[str, dict], covered: frozenset) -> bool | None:
    """True / False once the link's source has settled; None while it has not."""
    if edge["source"] not in covered:
        return True
    source = states.get(edge["source"])
    if source is None or source["status"] not in DONE:
        return None
    if source["status"] == "skipped":
        return False
    branch = (source.get("data") or {}).get("branch") if isinstance(source.get("data"), dict) else None
    return edge["branch"] is None or branch is None or edge["branch"] == branch


def next_steps(p: Plan, states: dict[str, dict], start: str) -> tuple[list[str], list[str]]:
    """``(ready, skipped)``: steps that may start now and steps that never will in this run."""
    ready, skipped = [], []
    for node_id in p.order:
        if node_id in states and states[node_id]["status"] != "pending":
            continue
        if node_id == start:
            ready.append(node_id)
            continue
        links = [_edge_live(edge, states, p.covered) for edge in p.incoming.get(node_id, [])]
        if not links or any(link is None for link in links):
            continue
        (ready if any(links) else skipped).append(node_id)
    return ready, skipped


def upstream_input(p: Plan, node_id: str, outputs: dict[str, dict]) -> str:
    """The text a step receives as ``{{input}}``: the output of the step(s) that led into it."""
    texts = []
    for edge in p.incoming.get(node_id, []):
        source = outputs.get(edge["source"])
        if source and source.get("output"):
            texts.append(source["output"])
    return "\n\n".join(texts)
