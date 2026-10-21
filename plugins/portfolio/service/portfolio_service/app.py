"""Market data for the Portfolio page, from OpenBB's Open Data Platform (yfinance provider).

Two endpoints: ``/history`` — daily bars (open, high, low, close, volume) and closes for a list of
symbols since a date, from which the Hermes side derives prices, the day's change and the value history
and candles; and ``/bars`` — one symbol's bars at an interval (15m, 1h, 1d), for the Watchlist chart.
Answers are cached for a few
minutes so a dashboard refresh never hammers the provider. Every request must carry the token the
launching backend put in ``PORTFOLIO_SERVICE_TOKEN``.
"""

from __future__ import annotations

import datetime as dt
import hmac
import math
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Query

_CACHE_S = 300
_cache: dict[tuple[str, str, str], tuple[float, dict]] = {}
_cache_lock = threading.Lock()
_first_call = threading.Lock()
_warm = False
_obb = None


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    global _obb
    from openbb import obb  # slow (seconds): loaded once, before the service reports healthy

    _ = obb.equity.price  # OpenBB imports each namespace on first touch; do it here, on one thread
    _obb = obb
    yield


app = FastAPI(lifespan=_lifespan)


def _authorized(x_portfolio_token: str = Header("")) -> None:
    token = os.environ.get("PORTFOLIO_SERVICE_TOKEN", "")  # set by the launching backend, per start
    if not token or not hmac.compare_digest(x_portfolio_token.encode(), token.encode()):
        raise HTTPException(status_code=401, detail="bad token")


_BAR_FIELDS = ("open", "high", "low", "close")
INTERVALS = {"15m", "1h", "1d"}


def _number(value) -> float:
    return float(value) if value is not None and not math.isnan(float(value)) else math.nan


def _frame_rows(frame) -> list[tuple]:
    """(timestamp, open, high, low, close, volume) for every complete row; a missing volume is 0."""
    rows = []
    for index, row in frame.iterrows():
        values = [_number(row[field]) for field in _BAR_FIELDS]
        if any(math.isnan(v) for v in values):
            continue
        volume = _number(row["volume"]) if "volume" in row else 0.0
        rows.append((index, *values, 0.0 if math.isnan(volume) else volume))
    return rows


def _epoch(index) -> int:
    """Seconds since the epoch; a bare date (daily bars) is that day's midnight in UTC."""
    if isinstance(index, dt.datetime):
        return int(index.timestamp())
    day = index if isinstance(index, dt.date) else dt.date.fromisoformat(str(index)[:10])
    return int(dt.datetime(day.year, day.month, day.day, tzinfo=dt.UTC).timestamp())


def _cached(key: tuple[str, str, str], load) -> dict:
    with _cache_lock:
        cached = _cache.get(key)
        if cached and time.monotonic() - cached[0] < _CACHE_S:
            return cached[1]
    try:
        answer = load()
    except Exception as exc:  # health: allow BLE001 -- a provider failure for one symbol must not fail the batch
        return {"closes": [], "bars": [], "error": str(exc)[:200]}  # not cached: the next refresh tries again
    with _cache_lock:
        _cache[key] = (time.monotonic(), answer)
    return answer


def _closes(symbol: str, start: str) -> dict:
    def load() -> dict:
        frame = _obb.equity.price.historical(symbol, start_date=start, provider="yfinance").to_df()
        bars = [[str(index)[:10], *values] for index, *values in _frame_rows(frame)]
        return {"closes": [[row[0], row[4]] for row in bars], "bars": bars, "source": "yfinance via OpenBB"}

    return _cached((symbol, start, "1d"), load)


def _interval_bars(symbol: str, interval: str, start: str) -> dict:
    def load() -> dict:
        frame = _obb.equity.price.historical(symbol, start_date=start, interval=interval, provider="yfinance").to_df()
        return {"bars": [[_epoch(index), *values] for index, *values in _frame_rows(frame)],
                "source": "yfinance via OpenBB"}

    return _cached((symbol, start, interval), load)


def _warm_up(symbol: str, start: str) -> None:
    """The provider's own modules load on its first fetch, and loading them from several threads at
    once fails with half-initialised imports — so the first fetch of the process runs alone."""
    global _warm
    with _first_call:
        if not _warm:
            _closes(symbol, start)
            _warm = True


@app.get("/health", dependencies=[Depends(_authorized)])
def health() -> dict:
    return {"ok": _obb is not None}


@app.get("/history", dependencies=[Depends(_authorized)])
def history(symbols: str = Query(...), start: str = Query("")) -> dict:
    wanted = [s.strip() for s in symbols.split(",") if s.strip()][:60]
    since = start or (dt.date.today() - dt.timedelta(days=30)).isoformat()
    if wanted:
        _warm_up(wanted[0], since)
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = pool.map(lambda s: (s, _closes(s, since)), wanted)
    return dict(results)


# How far back each interval reaches: what the provider keeps for intraday bars, a few years for daily.
_LOOKBACK_DAYS = {"15m": 30, "1h": 180, "1d": 3 * 365}


@app.get("/bars", dependencies=[Depends(_authorized)])
def bars(symbol: str = Query(...), interval: str = Query("1d")) -> dict:
    if interval not in INTERVALS:
        raise HTTPException(status_code=400, detail=f"interval must be one of {sorted(INTERVALS)}")
    start = (dt.date.today() - dt.timedelta(days=_LOOKBACK_DAYS[interval])).isoformat()
    _warm_up(symbol, start)
    return _interval_bars(symbol.strip(), interval, start)
