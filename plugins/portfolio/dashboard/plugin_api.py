"""Portfolio plugin — backend routes, mounted at /api/plugins/portfolio/.

Thin handlers over ``plugins.portfolio.core``: the dashboard of the simulated portfolio, the owner's watchlists and their stock quotes and bars, the state of
the market-data environment, and the owner's request to install it. Market data and (later)
backtesting run in their own process (``core/runtime.py``), never in this one.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from plugins.portfolio.core import dashboard, quotes, runtime, watchlist

router = APIRouter()


class WatchlistBody(BaseModel):
    lists: list[dict]


@router.get("/dashboard")
def get_dashboard(variant: Optional[str] = Query(None, description="Portfolio variant (A, B, …)")) -> dict:
    return dashboard.build(variant)


@router.get("/status")
def get_status() -> dict:
    return dashboard.status()


@router.post("/prepare")
def prepare() -> dict:
    """The owner asked for live market data: build the environment, or start the service when it is built."""
    if runtime.env_phase() in ("missing", "outdated", "error"):
        runtime.install_env()
    else:
        runtime.service()
    return dashboard.status()


@router.get("/watchlist")
def get_watchlist() -> dict:
    return watchlist.load()


@router.put("/watchlist")
def put_watchlist(body: WatchlistBody) -> dict:
    return watchlist.save(body.lists)


@router.get("/quotes")
def get_quotes(symbols: str = Query("", description="Comma-separated provider symbols (AAPL,VWCE.DE)")) -> dict:
    return quotes.quotes(watchlist.clean_symbols(symbols.split(","), "stocks"))


@router.get("/bars")
def get_bars(symbol: str = Query(...), interval: str = Query("1d")) -> dict:
    cleaned = watchlist.clean_symbols([symbol], "stocks")
    if not cleaned or interval not in ("15m", "1h", "1d"):
        return {"bars": [], "error": "invalid", "status": dashboard.status()}
    return quotes.bars(cleaned[0], interval)
