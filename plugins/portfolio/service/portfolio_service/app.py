"""Market data for the Portfolio page, from OpenBB's Open Data Platform (yfinance provider).

One endpoint for now: daily bars (open, high, low, close) and closes for a list of symbols since a date.
Prices, the day's change and the value history and candles are all derived from them by the Hermes side. Answers are cached for a few
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
_cache: dict[tuple[str, str], tuple[float, dict]] = {}
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


def _closes(symbol: str, start: str) -> dict:
    key = (symbol, start)
    with _cache_lock:
        cached = _cache.get(key)
        if cached and time.monotonic() - cached[0] < _CACHE_S:
            return cached[1]
    try:
        frame = _obb.equity.price.historical(symbol, start_date=start, provider="yfinance").to_df()
        bars = [[str(index)[:10], *(float(row[field]) for field in _BAR_FIELDS)] for index, row in frame.iterrows()
                if not any(row[field] is None or math.isnan(float(row[field])) for field in _BAR_FIELDS)]
        answer = {"closes": [[day, close] for day, *_, close in bars], "bars": bars, "source": "yfinance via OpenBB"}
    except Exception as exc:  # health: allow BLE001 -- a provider failure for one symbol must not fail the batch
        return {"closes": [], "error": str(exc)[:200]}  # not cached: the next refresh tries again
    with _cache_lock:
        _cache[key] = (time.monotonic(), answer)
    return answer


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
