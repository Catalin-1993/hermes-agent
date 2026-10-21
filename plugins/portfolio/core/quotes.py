"""Stock and ETF prices for the Watchlist, through the market-data service (yfinance via OpenBB).

Unlike crypto these are not a live stream: the last daily close against the one before, refreshed
by the page every minute, and bars at 15m, 1h or 1d for the chart. Symbols are the provider's
(``AAPL``, ``VWCE.DE``, ``TLV.RO``), each quoted in its listing's own currency.
"""

from __future__ import annotations

import datetime as dt
import urllib.error

from plugins.portfolio.core import dashboard, market, runtime

_RECENT_DAYS = 10  # enough trading days to always hold the last two closes


def _quote(series: dict, symbol: str) -> dict | None:
    rows = [row for row in series.get("bars") or [] if len(row) >= 5]
    if not rows:
        return None
    last, prev = rows[-1], rows[-2] if len(rows) > 1 else rows[-1]
    price, before = float(last[4]), float(prev[4])
    return {
        "price": price,
        "change": price - before,
        "change_pct": (price - before) / before * 100 if before else 0.0,
        "high": float(last[2]),
        "low": float(last[3]),
        "volume": float(last[5]) if len(last) > 5 else 0.0,
        "date": str(last[0])[:10],
        "currency": market.quote_currency(symbol, ""),
    }


def quotes(symbols: list[str]) -> dict:
    """Each symbol's latest quote; a symbol the provider does not know is absent from ``quotes``."""
    info = runtime.service()
    if info is None or not symbols:
        return {"quotes": {}, "status": dashboard.status()}
    start = (dt.date.today() - dt.timedelta(days=_RECENT_DAYS)).isoformat()
    answer = runtime.fetch_history(info, symbols, start)
    found = {symbol: _quote(answer.get(symbol) or {}, symbol) for symbol in symbols}
    return {"quotes": {s: q for s, q in found.items() if q}, "status": dashboard.status()}


def bars(symbol: str, interval: str) -> dict:
    """One symbol's bars as ``[seconds, open, high, low, close, volume]`` rows, oldest first."""
    info = runtime.service()
    if info is None:
        return {"bars": [], "status": dashboard.status()}
    try:
        answer = runtime.fetch_bars(info, symbol, interval)
    except urllib.error.HTTPError as exc:  # a service started before /bars existed answers 404
        return {"bars": [], "error": "restart" if exc.code == 404 else str(exc), "status": dashboard.status()}
    return {"bars": answer.get("bars") or [], "error": answer.get("error", ""), "status": dashboard.status()}
