"""References inside a step's text, filled in when the step runs.

``{{input}}``                      what the previous step gave (its output text)
``{{input.<field>}}``              a field of it, when that output is JSON
``{{steps.<node id>.output}}``     the output of any step that ran before in this run
``{{steps.<node id>.<field>}}``    a field of a step's JSON output (an Answer's values, say)
``{{trigger.<field>}}``            what started the run (the webhook body, the message, ``type``)
``{{run.id}}`` ``{{date}}`` ``{{time}}``

A reference that names nothing becomes empty text, never an error: a template is the owner's prose.
"""

from __future__ import annotations

import datetime as dt
import json
import re
from typing import Any

from plugins.workflows.core.model import fold

_REF = re.compile(r"\{\{\s*([\w.\-]+)\s*\}\}")


def as_data(text: str) -> Any:
    """A step's output read as JSON when it is JSON (a fenced block counts), else None."""
    stripped = (text or "").strip()
    fenced = re.match(r"^```(?:json)?\s*(.*?)\s*```$", stripped, re.DOTALL)
    if fenced:
        stripped = fenced.group(1)
    if not stripped or stripped[0] not in "{[":
        return None
    try:
        return json.loads(stripped)
    except ValueError:
        return None


def _walk(current: Any, parts: list[str]) -> Any:
    for part in parts:
        if isinstance(current, dict):
            current = current[part] if part in current else _folded(current, part)
        elif isinstance(current, list) and part.isdigit() and int(part) < len(current):
            current = current[int(part)]
        else:
            return None
    return current


def _folded(mapping: dict, part: str) -> Any:
    wanted = fold(part)
    return next((value for key, value in mapping.items() if isinstance(key, str) and fold(key) == wanted), None)


def _show(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, indent=2)
    if isinstance(value, bool):
        return "da" if value else "nu"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def context(*, input_text: str, steps: dict[str, dict], trigger: dict, run_id: str) -> dict:
    """The values a step sees: for its templates and for a Condition's rule."""
    now = dt.datetime.now()
    data = as_data(input_text)
    step_values = {
        node_id: {"output": step.get("output", ""), **(step.get("data") if isinstance(step.get("data"), dict) else {})}
        for node_id, step in steps.items()
    }
    values = {
        "input": input_text,
        "output": input_text,
        "steps": step_values,
        "trigger": trigger,
        "run": {"id": run_id},
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M"),
    }
    if isinstance(data, dict):
        # A Condition reads the previous step's fields by name: ``priority = high``.
        values = {**data, **values, "input": data}
    return values


def render(template: str, values: dict) -> str:
    def replace(match: re.Match) -> str:
        path = match.group(1).split(".")
        head, rest = path[0], path[1:]
        if head == "input" and not rest:
            return _show(values.get("output"))
        return _show(_walk(values, [head, *rest]))

    return _REF.sub(replace, template or "")
