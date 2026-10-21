"""The Portfolio dashboard: one variant of the simulated portfolio, valued at market prices.

Read from the journal (``core/journal.py``), priced by the market-data service when it runs
(``core/runtime.py``), at the journal's cost when it does not — and the answer says which.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Optional

from plugins.portfolio.core import journal, market, runtime

DEFAULT_CAPITAL = 20_000.0


def _default_journal() -> Path:
    """Where the investment team's skill writes it: ``~/BrainTeam/investitii/jurnal``."""
    return Path.home() / "BrainTeam" / "investitii" / "jurnal"


def settings() -> tuple[Path, float]:
    """Where the journal lives and the starting capital: ``portfolio.journal_dir`` / ``starting_capital``."""
    try:
        from hermes_cli.config import cfg_get, load_config
        config = load_config()
        raw_dir = cfg_get(config, "portfolio", "journal_dir", default="") or ""
        capital = float(cfg_get(config, "portfolio", "starting_capital", default=DEFAULT_CAPITAL) or DEFAULT_CAPITAL)
    except (ImportError, TypeError, ValueError):
        raw_dir, capital = "", DEFAULT_CAPITAL
    return (Path(raw_dir).expanduser() if raw_dir else _default_journal()), capital


def _last_two(series: list) -> dict:
    closes = [float(close) for _, close in series if close is not None]
    return {"last": closes[-1], "prev": closes[-2] if len(closes) > 1 else None} if closes else {}


def _market_data(book: journal.Book) -> tuple[dict, dict, Optional[str]]:
    """(closes by provider symbol, FX closes, as-of date) — empty when the service is not running."""
    info = runtime.service()
    if info is None or not book.positions:
        return {}, {}, None
    start = (dt.date.fromisoformat(book.started) - dt.timedelta(days=7)).isoformat() if book.started else ""
    symbols = sorted({market.provider_symbol(p.symbol, p.market) for p in book.positions.values()})
    answer = runtime.fetch_history(info, symbols + market.fx_symbols(book), start)
    series = {symbol: (answer.get(symbol) or {}).get("closes") or [] for symbol in answer}
    fx_pairs = set(market.fx_symbols(book))
    closes = {s: v for s, v in series.items() if s not in fx_pairs}
    fx = {s: v for s, v in series.items() if s in fx_pairs}
    dates = [str(day)[:10] for values in closes.values() for day, _ in values]
    return closes, fx, max(dates) if dates else None


def _status() -> dict:
    return {"env": runtime.env_phase(), "service": runtime.service_phase(), "error": runtime.last_error()}


def build(variant: Optional[str] = None) -> dict:
    journal_dir, capital = settings()
    trades = journal.read_trades(journal_dir)
    names = journal.variants(trades)
    chosen = variant if variant in names else (names[0] if names else "")
    book = journal.build_book(trades, chosen, capital)
    closes, fx_closes, as_of = _market_data(book)
    fx_last = {pair: (_last_two(series).get("last") or 0.0) for pair, series in fx_closes.items()}
    quotes = {symbol: _last_two(series) for symbol, series in closes.items()}
    positions = market.price_book(book, quotes, fx_last)
    invested = sum(p.value_eur for p in positions)
    total = invested + book.cash_eur
    day_change = sum(p.day_change_eur for p in positions)
    allocation: dict[str, float] = {}
    for p in positions:
        allocation[p.asset_class] = allocation.get(p.asset_class, 0.0) + p.value_eur
    if book.cash_eur > 0.005:
        allocation["Numerar"] = allocation.get("Numerar", 0.0) + book.cash_eur
    sourced = {p.source for p in positions}
    return {
        "variant": chosen,
        "variants": names,
        "journal_dir": str(journal_dir),
        "has_journal": bool(trades),
        "started": book.started,
        "as_of": as_of,
        "capital": capital,
        "total": round(total, 2),
        "cash": round(book.cash_eur, 2),
        "invested": round(invested, 2),
        "fees": round(book.fees_eur, 2),
        "pnl": round(total - capital, 2),
        "pnl_pct": round((total - capital) / capital * 100, 2) if capital else 0.0,
        "day_change": round(day_change, 2),
        "day_change_pct": round(day_change / (total - day_change) * 100, 2) if total - day_change else 0.0,
        "prices": "piață" if sourced == {"piață"} else ("mixt" if "piață" in sourced else "jurnal"),
        "unverified_trades": book.unverified,
        "allocation": [{"name": name, "value": round(value, 2)} for name, value in
                       sorted(allocation.items(), key=lambda item: item[1], reverse=True)],
        "positions": [{
            "name": p.name, "symbol": p.symbol, "class": p.asset_class, "quantity": p.quantity,
            "average": round(p.average_eur, 6), "price": round(p.price_eur, 6), "value": round(p.value_eur, 2),
            "weight": round(p.value_eur / total * 100, 2) if total else 0.0,
            "pnl": round(p.value_eur - p.cost_eur, 2),
            "pnl_pct": round((p.value_eur - p.cost_eur) / p.cost_eur * 100, 2) if p.cost_eur else 0.0,
            "source": p.source} for p in positions],
        "history": market.value_history(book, closes, fx_closes) if closes else [],
        "status": _status(),
    }


def status() -> dict:
    return _status()
