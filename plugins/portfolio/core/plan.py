"""The investment plan: per portfolio variant, the target allocation by asset class, the rules the
portfolio keeps, the owner's goals and the strategy in words.

It lives beside the journal, in ``plan.json`` (or ``portfolio.plan_file`` in config.yaml), so the
investment team reads the same plan the page shows and may propose one in the same shape. Whatever
writes it, it is cleaned on read and on save: unknown classes and fields are dropped, numbers are
held to their range, so a hand edit or an agent's file can never break the page.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import secrets
from pathlib import Path

from plugins.portfolio.core import dashboard

CLASSES = ["Cripto", "Acțiuni globale", "Acțiuni BVB", "Obligațiuni", "Aur și materii prime", "Numerar"]
RULES = {  # name → (default, lowest, highest)
    "max_position_pct": (25.0, 1.0, 100.0),
    "rebalance_band_pp": (5.0, 0.5, 50.0),
    "min_cash_pct": (5.0, 0.0, 100.0),
    "review_loss_pct": (20.0, 1.0, 100.0),
}
MAX_GOALS = 10
MAX_THESIS = 20_000
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def plan_file() -> Path:
    try:
        from hermes_cli.config import cfg_get, load_config
        raw = cfg_get(load_config(), "portfolio", "plan_file", default="") or ""
    except (ImportError, TypeError, ValueError):
        raw = ""
    journal_dir, _ = dashboard.settings()
    return Path(raw).expanduser() if raw else journal_dir.parent / "plan.json"


def _number(value, low: float, high: float):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return round(min(max(number, low), high), 2)


def _goal(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    name = " ".join(str(raw.get("name") or "").split())[:80]
    target = _number(raw.get("target_eur"), 1, 1e12)
    by = str(raw.get("by") or "")
    if not name or target is None:
        return None
    goal_id = str(raw.get("id") or "")
    return {"id": goal_id if re.match(r"^[a-z0-9-]{1,32}$", goal_id) else secrets.token_hex(4),
            "name": name, "target_eur": target, "by": by if _DATE.match(by) else ""}


def clean(raw) -> dict:
    """One variant's plan with only what the page understands, in range."""
    raw = raw if isinstance(raw, dict) else {}
    targets_in = raw.get("targets") if isinstance(raw.get("targets"), dict) else {}
    targets = {name: value for name in CLASSES
               if (value := _number(targets_in.get(name), 0, 100)) is not None and value > 0}
    rules_in = raw.get("rules") if isinstance(raw.get("rules"), dict) else {}
    rules = {}
    for name, (default, low, high) in RULES.items():
        value = _number(rules_in.get(name), low, high)
        rules[name] = default if value is None else value
    goals = [goal for goal in (_goal(g) for g in (raw.get("goals") or [])[:MAX_GOALS]) if goal]
    return {
        "targets": targets,
        "rules": rules,
        "goals": goals,
        "thesis": str(raw.get("thesis") or "")[:MAX_THESIS],
        "updated": str(raw.get("updated") or ""),
        "updated_by": " ".join(str(raw.get("updated_by") or "").split())[:60],
    }


def _read() -> dict:
    try:
        stored = json.loads(plan_file().read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return {}
    variants = stored.get("variants") if isinstance(stored, dict) else None
    return variants if isinstance(variants, dict) else {}


def load(variant: str) -> dict:
    stored = _read()
    return {"variant": variant, "plan": clean(stored.get(variant)), "saved": variant in stored,
            "file": str(plan_file()), "classes": CLASSES}


def save(variant: str, raw: dict, by: str = "Cătă") -> dict:
    """Replaces one variant's plan; the other variants in the file stay as they are."""
    stored = _read()
    plan = clean(raw)
    plan["updated"] = dt.datetime.now().isoformat(timespec="seconds")
    plan["updated_by"] = by
    stored[variant] = plan
    path = plan_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"variants": stored}, ensure_ascii=False, indent=2), encoding="utf-8")
    return load(variant)
