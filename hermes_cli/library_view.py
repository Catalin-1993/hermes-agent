"""What the owner has on screen in the Library right now — the item, the slide, the selection — so the
agent can look at the same thing they do instead of guessing what "this slide" means. The desktop writes
it as the owner moves; the ``library`` tool reads it fresh when asked. A file in the profile's home, so it
reaches the agent in whichever process it runs, and it goes stale after a while rather than lying."""

from __future__ import annotations

import json
import os
import tempfile
import time
from pathlib import Path
from typing import Any, Optional

from hermes_constants import get_hermes_home

_STALE_SECONDS = 15 * 60
_SELECTION_MAX = 4000


def _file() -> Path:
    return get_hermes_home() / "library" / "view.json"


def set_view(item_id: Optional[str], slide: Optional[int] = None, selection: Optional[str] = None) -> None:
    path = _file()
    if not item_id:
        path.unlink(missing_ok=True)
        return
    view: dict[str, Any] = {"item_id": item_id, "at": time.time()}
    if slide is not None:
        view["slide"] = int(slide)
    if selection:
        view["selection"] = selection[:_SELECTION_MAX]
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".view-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(view, handle)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def get_view() -> Optional[dict[str, Any]]:
    try:
        view = json.loads(_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(view, dict) or time.time() - float(view.get("at") or 0) > _STALE_SECONDS:
        return None
    return view
