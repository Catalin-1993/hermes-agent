"""Small pieces of the worker context (``kanban_db.build_worker_context``): a run's metadata as
one capped line, and the newest-N cut of a long list with a note on what was left out."""

from __future__ import annotations

import json
from typing import Any, Optional


def _ctx_metadata_line(metadata: Any) -> Optional[str]:
    from hermes_cli.kanban_db import _ctx_cap

    if not metadata:
        return None
    try:
        return f"_metadata_: `{_ctx_cap(json.dumps(metadata, ensure_ascii=False, sort_keys=True))}`"
    except Exception:
        return None


def _ctx_tail(items: list, cap: int, noun: str) -> tuple[list, Optional[str]]:
    """Keep the newest ``cap`` items; describe the omitted head, if any."""
    omitted = max(0, len(items) - cap)
    if not omitted:
        return items, None
    return items[-cap:], (
        f"_({omitted} earlier {noun}{'s' if omitted != 1 else ''} "
        f"omitted; showing most recent {cap})_"
    )
