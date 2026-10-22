"""Backtests: the owner's request sent to the market-data service, where NautilusTrader runs it, and
every finished run kept per profile in ``<HERMES_HOME>/portfolio/backtests/`` (the newest 50) so the
page can list, reopen and compare them.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import urllib.error
from pathlib import Path
from typing import Optional

from hermes_constants import get_hermes_home

from plugins.portfolio.core import dashboard, market, research, runtime

STRATEGIES = ("sma_cross", "ema_cross", "macd", "rsi_revert", "bollinger", "breakout", "buy_hold")
EXECUTION_FIELDS = ("size_pct", "stop_loss_pct", "take_profit_pct", "trailing_pct", "trend_filter")
YEARS = (1, 2, 3, 5, 10)
KEEP = 50
_ID = re.compile(r"^[0-9]{8}-[0-9]{6}-[A-Z0-9.\-=^]{1,15}-[a-z_]{3,12}$")


def _folder() -> Path:
    return get_hermes_home() / "portfolio" / "backtests"


def _clean_request(raw: dict) -> Optional[dict]:
    from plugins.portfolio.core.watchlist import KINDS, clean_symbols

    kind = raw.get("kind") if raw.get("kind") in KINDS else "stocks"
    symbols = clean_symbols([raw.get("symbol")], kind)
    strategy = raw.get("strategy")
    if not symbols or strategy not in STRATEGIES:
        return None
    symbol = symbols[0]
    years = int(raw.get("years") or 3) if str(raw.get("years") or 3).isdigit() else 3
    params = raw.get("params") if isinstance(raw.get("params"), dict) else {}
    execution = raw.get("execution") if isinstance(raw.get("execution"), dict) else {}
    # Numbers only; the service holds each to its range (portfolio_service.backtest.clean_execution).
    how = {k: float(execution[k]) for k in EXECUTION_FIELDS if isinstance(execution.get(k), (int, float))}
    how["timeframe"] = "1w" if execution.get("timeframe") == "1w" else "1d"
    return {"symbol": symbol, "kind": kind, "strategy": strategy, "years": years if years in YEARS else 3,
            "params": {str(k): v for k, v in params.items() if isinstance(v, (int, float))}, "execution": how,
            "capital": float(raw.get("capital") or 10_000), "fee_pct": float(raw.get("fee_pct") or 0.1),
            "provider_symbol": research.provider_symbol(symbol, kind),
            "currency": market.quote_currency(symbol, "CCC" if kind == "crypto" else "")}


def _prune(folder: Path) -> None:
    runs = sorted(folder.glob("*.json"), key=lambda p: p.name, reverse=True)
    for old in runs[KEEP:]:
        old.unlink(missing_ok=True)


def run(raw: dict) -> dict:
    request = _clean_request(raw if isinstance(raw, dict) else {})
    if request is None:
        return {"error": "invalid"}
    info = runtime.service()
    if info is None:
        return {"error": "service", "status": dashboard.status()}
    try:
        answer = runtime.run_backtest(info, request)
    except urllib.error.HTTPError as exc:  # a service started before /backtest existed answers 404
        return {"error": "restart" if exc.code in (404, 405) else f"service {exc.code}"}
    except (OSError, ValueError) as exc:
        return {"error": "service", "detail": str(exc)[:200]}
    if answer.get("error"):
        return answer
    now = dt.datetime.now()
    run_id = f"{now:%Y%m%d-%H%M%S}-{request['symbol']}-{request['strategy']}"
    record = {"id": run_id, "created": now.isoformat(timespec="seconds"), "request": request, **answer}
    folder = _folder()
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{run_id}.json").write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")
    _prune(folder)
    return record


def _summary(path: Path) -> Optional[dict]:
    try:
        record = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return None
    result, benchmark = record.get("result") or {}, record.get("benchmark") or {}
    return {"id": record.get("id", path.stem), "created": record.get("created", ""), "request": record.get("request", {}),
            "return_pct": (result.get("stats") or {}).get("total_return_pct"),
            "benchmark_pct": (benchmark.get("stats") or {}).get("total_return_pct")}


def runs() -> dict:
    folder = _folder()
    files = sorted(folder.glob("*.json"), key=lambda p: p.name, reverse=True) if folder.is_dir() else []
    return {"runs": [summary for summary in (_summary(path) for path in files) if summary]}


def _path(run_id: str) -> Optional[Path]:
    return _folder() / f"{run_id}.json" if _ID.match(run_id or "") else None


def get(run_id: str) -> Optional[dict]:
    path = _path(run_id)
    if path is None or not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return None


def delete(run_id: str) -> bool:
    path = _path(run_id)
    if path is None or not path.is_file():
        return False
    path.unlink()
    return True
