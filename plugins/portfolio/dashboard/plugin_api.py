"""Portfolio plugin — backend routes, mounted at /api/plugins/portfolio/.

Thin handlers over ``plugins.portfolio.core``: the dashboard of the simulated portfolio, the state of
the market-data environment, and the owner's request to install it. Market data and (later)
backtesting run in their own process (``core/runtime.py``), never in this one.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from plugins.portfolio.core import dashboard, runtime

router = APIRouter()


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
