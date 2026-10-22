"""A backtest's numbers from its equity curve and its round trips — plain Python, tested on its own."""

from __future__ import annotations

import math
from itertools import pairwise


def curve_stats(values: list[float], days: float, periods_per_year: int) -> dict:
    """Total return, yearly growth, worst drawdown, volatility and Sharpe (no risk-free rate)."""
    if len(values) < 2 or values[0] <= 0:
        return {"total_return_pct": 0.0, "cagr_pct": 0.0, "max_drawdown_pct": 0.0, "volatility_pct": 0.0, "sharpe": 0.0}
    returns = [b / a - 1 for a, b in pairwise(values) if a > 0]
    mean = sum(returns) / len(returns)
    variance = sum((r - mean) ** 2 for r in returns) / (len(returns) - 1) if len(returns) > 1 else 0.0
    deviation = math.sqrt(variance)
    peak, worst = values[0], 0.0
    for value in values:
        peak = max(peak, value)
        worst = min(worst, value / peak - 1)
    years = days / 365.25
    growth = values[-1] / values[0]
    return {
        "total_return_pct": (growth - 1) * 100,
        "cagr_pct": (growth ** (1 / years) - 1) * 100 if years > 0 and growth > 0 else 0.0,
        "max_drawdown_pct": worst * 100,
        "volatility_pct": deviation * math.sqrt(periods_per_year) * 100,
        "sharpe": mean / deviation * math.sqrt(periods_per_year) if deviation else 0.0,
    }


def round_trips(fills: list[dict]) -> list[dict]:
    """Buy→sell pairs from the fills (oldest first); an unsold last buy is an open trade."""
    trips, entry = [], None
    for fill in fills:
        if fill["side"] == "BUY":
            entry = fill
        elif entry is not None:
            cost = entry["price"] * entry["quantity"] + entry["commission"]
            proceeds = fill["price"] * fill["quantity"] - fill["commission"]
            trips.append({"entry_ts": entry["ts"], "exit_ts": fill["ts"], "entry_price": entry["price"],
                          "exit_price": fill["price"], "quantity": entry["quantity"],
                          "exit_reason": fill.get("reason", "signal"),
                          "pnl": proceeds - cost, "pnl_pct": (proceeds / cost - 1) * 100 if cost else 0.0})
            entry = None
    if entry is not None:
        trips.append({"entry_ts": entry["ts"], "exit_ts": None, "entry_price": entry["price"], "exit_price": None,
                      "quantity": entry["quantity"], "exit_reason": None, "pnl": None, "pnl_pct": None})
    return trips


def trade_stats(trips: list[dict], start: int, end: int) -> dict:
    """Trade counts and outcomes, and the share of the period spent holding the asset."""
    closed = [t for t in trips if t["pnl"] is not None]
    wins = [t for t in closed if t["pnl"] > 0]
    return {
        "trades": len(closed),
        "win_rate_pct": len(wins) / len(closed) * 100 if closed else 0.0,
        "best_trade_pct": max((t["pnl_pct"] for t in closed), default=0.0),
        "worst_trade_pct": min((t["pnl_pct"] for t in closed), default=0.0),
        "exposure_pct": sum((t["exit_ts"] or end) - t["entry_ts"] for t in trips) / (end - start) * 100 if end > start else 0.0,
        "exits": {reason: sum(1 for t in closed if t.get("exit_reason") == reason)
                  for reason in ("signal", "stop_loss", "take_profit", "trailing")},
    }
