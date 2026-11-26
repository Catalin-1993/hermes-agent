"""Image and Video steps: Brain's own ``image_generate`` / ``video_generate`` tools, called once.

The backend and model are the ones the owner chose for the agent (Settings ▸ Tools ▸ Image / Video
Generation, ``image_gen`` / ``video_gen`` in config.yaml): a step never picks a model of its own, so
a key or a price the owner set up is the only one used. The result is a URL or a file in the profile's
cache; the step's output is that location, so a later step can pass it on (``{{steps.<id>.image}}``)
and the run view shows it the way chat shows media.
"""

from __future__ import annotations

import importlib
import json
from typing import Any

_TOOLS = {
    "image": ("image_generate", "tools.image_generation_tool", "image_gen"),
    "video": ("video_generate", "tools.video_generation_tool", "video_gen"),
}

NOT_READY = {
    "image": "Generarea de imagini nu e configurată. Alege un furnizor în Setări ▸ Unelte ▸ Image Generation.",
    "video": "Generarea video nu e configurată. Alege un furnizor în Setări ▸ Unelte ▸ Video Generation.",
}


def _entry(kind: str) -> Any:
    from hermes_cli.plugins import discover_plugins
    from tools.registry import registry

    tool, module, _section = _TOOLS[kind]
    discover_plugins()  # provider plugins register their backends here
    importlib.import_module(module)
    return registry.get_entry(tool)


def ready(kind: str) -> bool:
    entry = _entry(kind)
    return entry is not None and (entry.check_fn is None or bool(entry.check_fn()))


def status() -> dict:
    """What each kind runs on, for the inspector: ready or not, and the configured provider and model."""
    from hermes_cli.config import cfg_get, load_config

    config = load_config()
    found = {}
    for kind, (_tool, _module, section) in _TOOLS.items():
        found[kind] = {"ready": ready(kind), "provider": str(cfg_get(config, section, "provider") or ""),
                       "model": str(cfg_get(config, section, "model") or "")}
    return found


def generate(kind: str, args: dict, run_id: str) -> tuple[str, str]:
    """``(location, error)``: the generated file or URL, or why there is none."""
    from tools.registry import registry

    if not ready(kind):
        return "", NOT_READY[kind]
    raw = registry.dispatch(_TOOLS[kind][0], args, task_id=f"workflow-{run_id}")
    try:
        result = json.loads(raw) if isinstance(raw, str) else raw
    except ValueError:
        return "", str(raw)[:2_000]
    if not isinstance(result, dict):
        return "", "Răspuns neașteptat de la generator."
    location = result.get(kind) or ""
    if result.get("success") is False or result.get("error") or not location:
        return "", str(result.get("error") or "Generatorul nu a întors nimic.")[:2_000]
    return str(location), ""
