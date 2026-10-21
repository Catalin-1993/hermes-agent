"""Portfolio plugin — backend routes, mounted at /api/plugins/portfolio/.

Thin handlers over ``plugins.portfolio.core``: the dashboard of the simulated portfolio, the owner's watchlists and their stock quotes and bars, the research sheet and the team's reports, the investment plan, backtests, the state of
the market-data environment, and the owner's request to install it. Market data and (later)
backtesting run in their own process (``core/runtime.py``), never in this one.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from plugins.portfolio.core import backtest, dashboard, plan, quotes, research, runtime, watchlist

router = APIRouter()


class BacktestBody(BaseModel):
    request: dict


class PlanBody(BaseModel):
    plan: dict


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


@router.get("/research/sheet")
def get_research_sheet(symbol: str = Query(...), kind: str = Query("crypto")) -> dict:
    kind = kind if kind in watchlist.KINDS else "crypto"
    cleaned = watchlist.clean_symbols([symbol], kind)
    if not cleaned:
        raise HTTPException(status_code=400, detail="invalid symbol")
    return research.sheet(cleaned[0], kind)


@router.get("/research/reports")
def get_research_reports() -> dict:
    return research.reports()


@router.get("/research/report")
def get_research_report(name: str = Query(...)) -> dict:
    found = research.report(name)
    if found is None:
        raise HTTPException(status_code=404, detail="no such report")
    return found


@router.get("/plan")
def get_plan(variant: str = Query("", description="Portfolio variant; empty for the plan of an unstarted portfolio")) -> dict:
    return plan.load(variant.strip()[:40])


@router.put("/plan")
def put_plan(body: PlanBody, variant: str = Query("")) -> dict:
    return plan.save(variant.strip()[:40], body.plan)


@router.post("/backtest")
def post_backtest(body: BacktestBody) -> dict:
    return backtest.run(body.request)


@router.get("/backtest/runs")
def get_backtest_runs() -> dict:
    return backtest.runs()


@router.get("/backtest/run")
def get_backtest_run(id: str = Query(...)) -> dict:
    found = backtest.get(id)
    if found is None:
        raise HTTPException(status_code=404, detail="no such run")
    return found


@router.delete("/backtest/run")
def delete_backtest_run(id: str = Query(...)) -> dict:
    if not backtest.delete(id):
        raise HTTPException(status_code=404, detail="no such run")
    return {"deleted": id}
