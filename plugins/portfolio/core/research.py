"""Research: an asset's sheet, and the investment team's reports.

The sheet is what the page can know without an agent — the price path read from the market-data service
(returns, the 52-week range, moving averages, RSI, volatility, drawdown), and for stocks and ETFs
the provider's profile and headline numbers. The reports are the team's own work: Markdown files the
agents write into the research folder (by default ``research`` beside the journal), which the page
lists and reads but never writes.
"""

from __future__ import annotations

import datetime as dt
import itertools
import math
import re
import urllib.error
from pathlib import Path
from typing import Optional

from plugins.portfolio.core import dashboard, market, runtime

HISTORY_DAYS = 400
_REPORT_NAME = re.compile(r"^[\w.\- ]{1,120}\.md$")


def provider_symbol(symbol: str, kind: str) -> str:
    return market.provider_symbol(symbol, "CCC" if kind == "crypto" else "")


def _sma(closes: list[float], days: int) -> Optional[float]:
    return sum(closes[-days:]) / days if len(closes) >= days else None


def _rsi(closes: list[float], days: int = 14) -> Optional[float]:
    """Wilder's RSI over the last `days` changes; 100 when nothing fell."""
    if len(closes) <= days:
        return None
    changes = [b - a for a, b in itertools.pairwise(closes)]
    gain = sum(max(c, 0) for c in changes[:days]) / days
    loss = sum(max(-c, 0) for c in changes[:days]) / days
    for change in changes[days:]:
        gain = (gain * (days - 1) + max(change, 0)) / days
        loss = (loss * (days - 1) + max(-change, 0)) / days
    return 100.0 if loss == 0 else 100 - 100 / (1 + gain / loss)


def _change(rows: list[tuple[dt.date, float]], days: int) -> Optional[float]:
    """Percent change from the last close on or before `days` ago to the latest close."""
    latest_day, latest = rows[-1]
    cutoff = latest_day - dt.timedelta(days=days)
    before = [close for day, close in rows if day <= cutoff]
    return (latest / before[-1] - 1) * 100 if before and before[-1] else None


def _max_drawdown(closes: list[float]) -> float:
    peak, worst = closes[0], 0.0
    for close in closes:
        peak = max(peak, close)
        worst = min(worst, close / peak - 1)
    return worst * 100


def technicals(series: list, kind: str) -> dict:
    """The price-path numbers from daily closes (``[[date, close], …]``, oldest first)."""
    rows = [(dt.date.fromisoformat(str(day)[:10]), float(close)) for day, close in series if close]
    if len(rows) < 2:
        return {}
    closes = [close for _, close in rows]
    year = [close for day, close in rows if day > rows[-1][0] - dt.timedelta(days=365)]
    returns = [b / a - 1 for a, b in itertools.pairwise(year) if a]
    mean = sum(returns) / len(returns) if returns else 0.0
    variance = sum((r - mean) ** 2 for r in returns) / (len(returns) - 1) if len(returns) > 1 else 0.0
    trading_days = 365 if kind == "crypto" else 252
    return {
        "price": closes[-1],
        "date": rows[-1][0].isoformat(),
        "change": {"1w": _change(rows, 7), "1m": _change(rows, 30), "3m": _change(rows, 91), "1y": _change(rows, 365)},
        "high_52w": max(year),
        "low_52w": min(year),
        "from_high_pct": (closes[-1] / max(year) - 1) * 100,
        "sma50": _sma(closes, 50),
        "sma200": _sma(closes, 200),
        "rsi14": _rsi(closes),
        "volatility_pct": math.sqrt(variance * trading_days) * 100,
        "max_drawdown_pct": _max_drawdown(year),
    }


def _profile(info: dict, symbol: str) -> dict:
    try:
        return runtime.fetch_profile(info, symbol)
    except urllib.error.HTTPError as exc:  # a service started before /profile existed answers 404
        return {"error": "restart" if exc.code == 404 else str(exc)}
    except (OSError, ValueError) as exc:
        return {"error": str(exc)}


def sheet(symbol: str, kind: str) -> dict:
    status = dashboard.status()
    info = runtime.service()
    if info is None:
        return {"symbol": symbol, "kind": kind, "status": status}
    provider = provider_symbol(symbol, kind)
    start = (dt.date.today() - dt.timedelta(days=HISTORY_DAYS)).isoformat()
    history = (runtime.fetch_history(info, [provider], start).get(provider) or {})
    answer = {
        "symbol": symbol,
        "kind": kind,
        "provider_symbol": provider,
        "currency": market.quote_currency(symbol, "CCC" if kind == "crypto" else ""),
        "technicals": technicals(history.get("closes") or [], kind),
        "error": history.get("error", ""),
        "status": status,
    }
    if kind == "stocks":
        answer["profile"] = _profile(info, provider)
    return answer


# ---- the team's reports -------------------------------------------------------------------------

def research_dir() -> Path:
    """``portfolio.research_dir`` in config.yaml, else ``research`` beside the journal folder."""
    try:
        from hermes_cli.config import cfg_get, load_config
        raw = cfg_get(load_config(), "portfolio", "research_dir", default="") or ""
    except (ImportError, TypeError, ValueError):
        raw = ""
    journal_dir, _ = dashboard.settings()
    return Path(raw).expanduser() if raw else journal_dir.parent / "research"


def _front_matter(text: str) -> tuple[dict, str]:
    """``key: value`` lines between leading ``---`` fences, and the body after them."""
    if not text.startswith("---"):
        return {}, text
    head, _, body = text[3:].partition("\n---")
    fields = {}
    for line in head.splitlines():
        key, sep, value = line.partition(":")
        if sep and key.strip():
            fields[key.strip().lower()] = value.strip().strip("\"'")
    return fields, body.lstrip("\n")


def _summary(path: Path) -> dict:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    fields, body = _front_matter(text)
    heading = next((line[2:].strip() for line in body.splitlines() if line.startswith("# ")), "")
    stamp = re.match(r"^(\d{4}-\d{2}-\d{2})", path.name)
    modified = dt.datetime.fromtimestamp(path.stat().st_mtime)
    return {
        "name": path.name,
        "title": fields.get("titlu") or fields.get("title") or heading or path.stem,
        "symbol": (fields.get("simbol") or fields.get("symbol") or "").upper(),
        "verdict": fields.get("verdict", ""),
        "author": fields.get("autor") or fields.get("author") or "",
        # "comitet" (the investment committee's report) or "siguranta" (a safety drill); empty otherwise.
        "kind": (fields.get("tip") or "").lower(),
        "date": fields.get("data") or fields.get("date") or (stamp.group(1) if stamp else modified.date().isoformat()),
        "modified": modified.isoformat(timespec="seconds"),
    }


def reports() -> dict:
    folder = research_dir()
    files = sorted(folder.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True) if folder.is_dir() else []
    return {"dir": str(folder), "reports": [_summary(path) for path in files[:200]]}


def report(name: str) -> Optional[dict]:
    """One report by its file name — only a plain ``.md`` name directly inside the research folder."""
    folder = research_dir()
    if not _REPORT_NAME.match(name) or "/" in name or "\\" in name or name.startswith("."):
        return None
    path = folder / name
    if path.resolve().parent != folder.resolve() or not path.is_file():
        return None
    _, body = _front_matter(path.read_text(encoding="utf-8-sig", errors="replace"))
    return {**_summary(path), "body": body}
