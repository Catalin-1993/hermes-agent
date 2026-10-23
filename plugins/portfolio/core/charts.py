"""The owner's chart of each coin or stock: the indicators they keep on it, what they drew (horizontal
levels, trend lines, Fibonacci retracements) and their notes, kept per profile in
``<HERMES_HOME>/portfolio/charts/<kind>-<symbol>.json``.

The same chart opens in the Watchlist and in Backtesting, and the notes are plain data the investment
team can read when it researches the symbol (:func:`notes_text`). Everything is checked on the way in:
known indicator types with numeric settings, drawings with numeric points, notes of bounded length.
"""

from __future__ import annotations

import json
import re
import secrets
import time
from pathlib import Path
from typing import Optional

from hermes_constants import get_hermes_home

from plugins.portfolio.core.watchlist import KINDS, clean_symbols

INDICATORS = ("sma", "ema", "bollinger", "supertrend", "donchian", "vwap", "levels", "volume", "rsi", "macd",
              "stochastic", "atr")
DRAWINGS = ("hline", "trend", "fib")
MAX_INDICATORS, MAX_DRAWINGS, MAX_NOTES, MAX_NOTE = 12, 60, 200, 2000
_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
_ID = re.compile(r"^[a-z0-9]{1,16}$")


def _file(kind: str, symbol: str) -> Path:
    return get_hermes_home() / "portfolio" / "charts" / f"{kind}-{symbol}.json"


def _key(kind: str, symbol: str) -> Optional[tuple[str, str]]:
    kind = kind if kind in KINDS else ""
    symbols = clean_symbols([symbol], kind) if kind else []
    return (kind, symbols[0]) if symbols else None


def _id(raw) -> str:
    value = str(raw or "")
    return value if _ID.match(value) else secrets.token_hex(4)


def _numbers(raw, limit: int = 8) -> dict:
    return {str(k)[:20]: float(v) for k, v in list((raw or {}).items())[:limit]
            if isinstance(v, (int, float)) and not isinstance(v, bool)} if isinstance(raw, dict) else {}


def _indicator(raw: dict) -> Optional[dict]:
    if not isinstance(raw, dict) or raw.get("type") not in INDICATORS:
        return None
    color = str(raw.get("color") or "")
    return {"id": _id(raw.get("id")), "type": raw["type"], "params": _numbers(raw.get("params")),
            "color": color if _COLOR.match(color) else None, "hidden": bool(raw.get("hidden"))}


def _point(raw) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    time_, price = raw.get("time"), raw.get("price")
    if not isinstance(time_, (int, float)) or not isinstance(price, (int, float)) or price <= 0:
        return None
    return {"time": int(time_), "price": float(price)}


def _drawing(raw: dict) -> Optional[dict]:
    if not isinstance(raw, dict) or raw.get("type") not in DRAWINGS:
        return None
    points = [p for p in (_point(p) for p in (raw.get("points") or [])[:2]) if p]
    if len(points) != (1 if raw["type"] == "hline" else 2):
        return None
    return {"id": _id(raw.get("id")), "type": raw["type"], "points": points,
            "label": str(raw.get("label") or "").strip()[:60]}


def _note(raw: dict) -> Optional[dict]:
    text = str(raw.get("text") or "").strip()[:MAX_NOTE] if isinstance(raw, dict) else ""
    if not text:
        return None
    at = _point(raw.get("at")) if isinstance(raw.get("at"), dict) else None
    created = raw.get("created")
    return {"id": _id(raw.get("id")), "text": text, "at": at,
            "created": int(created) if isinstance(created, (int, float)) else int(time.time())}


def clean(raw: dict) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    pick = lambda name, fn, cap: [x for x in (fn(r) for r in (raw.get(name) or [])[:cap]) if x]
    return {"indicators": pick("indicators", _indicator, MAX_INDICATORS),
            "drawings": pick("drawings", _drawing, MAX_DRAWINGS), "notes": pick("notes", _note, MAX_NOTES)}


def load(kind: str, symbol: str) -> Optional[dict]:
    """The chart, or ``None`` for a symbol that is not one; a chart never saved has the starting set
    (volume only, as TradingView opens)."""
    key = _key(kind, symbol)
    if key is None:
        return None
    path = _file(*key)
    try:
        saved = json.loads(path.read_text(encoding="utf-8-sig")) if path.is_file() else None
    except (OSError, ValueError):
        saved = None
    chart = clean(saved) if isinstance(saved, dict) else {"indicators": [{"id": "vol", "type": "volume", "params": {},
                                                                       "color": None, "hidden": False}],
                                                          "drawings": [], "notes": []}
    return {"kind": key[0], "symbol": key[1], **chart, "saved": saved is not None}


def save(kind: str, symbol: str, raw: dict) -> Optional[dict]:
    key = _key(kind, symbol)
    if key is None:
        return None
    path = _file(*key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(clean(raw), ensure_ascii=False), encoding="utf-8")
    return load(*key)


def notes_text(kind: str, symbol: str) -> str:
    """The owner's notes on a symbol, oldest first, one per line (empty when there are none)."""
    chart = load(kind, symbol)
    if not chart:
        return ""
    lines = []
    for note in sorted(chart["notes"], key=lambda n: n["created"]):
        when = time.strftime("%Y-%m-%d", time.localtime(note["created"]))
        where = f" (at {note['at']['price']:g})" if note["at"] else ""
        lines.append(f"- {when}{where}: {note['text']}")
    return "\n".join(lines)
