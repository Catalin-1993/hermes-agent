"""When each backtest strategy wants to hold the asset: one True/False per daily bar, decided on that
bar's close. Plain Python with no engine in it, so every rule is tested on its own; the engine
(``backtest.py``) only executes what these say.

Long-only and all-in: a strategy is either fully in the asset or fully in cash.
"""

from __future__ import annotations

from collections.abc import Callable

Rows = list[tuple[float, float, float, float]]  # open, high, low, close


def _sma(values: list[float], period: int, end: int) -> float | None:
    """The average of the `period` values ending at index `end` (inclusive)."""
    return sum(values[end - period + 1:end + 1]) / period if end + 1 >= period else None


def buy_hold(rows: Rows) -> list[bool]:
    return [True] * len(rows)


def sma_cross(rows: Rows, fast: int = 50, slow: int = 200) -> list[bool]:
    """In while the fast average of closes is above the slow one."""
    closes = [row[3] for row in rows]
    wants = []
    for i in range(len(closes)):
        a, b = _sma(closes, fast, i), _sma(closes, slow, i)
        wants.append(a is not None and b is not None and a > b)
    return wants


def rsi_revert(rows: Rows, period: int = 14, low: float = 30, high: float = 70) -> list[bool]:
    """Buy when Wilder's RSI falls below `low`, sell when it rises above `high`, hold in between."""
    closes = [row[3] for row in rows]
    wants, holding, gain, loss = [], False, 0.0, 0.0
    for i in range(len(closes)):
        if i > 0:
            change = closes[i] - closes[i - 1]
            up, down = max(change, 0.0), max(-change, 0.0)
            if i <= period:
                gain, loss = gain + up / period, loss + down / period
            else:
                gain, loss = (gain * (period - 1) + up) / period, (loss * (period - 1) + down) / period
        if i >= period:
            rsi = 100.0 if loss == 0 else 100 - 100 / (1 + gain / loss)
            holding = True if rsi < low else False if rsi > high else holding
        wants.append(holding)
    return wants


def breakout(rows: Rows, entry: int = 55, exit: int = 20) -> list[bool]:
    """Donchian channels: buy on a close above the highest high of the previous `entry` days, sell on a
    close below the lowest low of the previous `exit` days."""
    wants, holding = [], False
    for i, (_, _, _, close) in enumerate(rows):
        if i >= entry and not holding and close > max(row[1] for row in rows[i - entry:i]):
            holding = True
        elif i >= exit and holding and close < min(row[2] for row in rows[i - exit:i]):
            holding = False
        wants.append(holding)
    return wants


# name → (rule, its parameters with (default, lowest, highest))
STRATEGIES: dict[str, tuple[Callable[..., list[bool]], dict[str, tuple[float, float, float]]]] = {
    "buy_hold": (buy_hold, {}),
    "sma_cross": (sma_cross, {"fast": (50, 2, 250), "slow": (200, 5, 400)}),
    "rsi_revert": (rsi_revert, {"period": (14, 2, 60), "low": (30, 1, 50), "high": (70, 50, 99)}),
    "breakout": (breakout, {"entry": (55, 5, 250), "exit": (20, 2, 250)}),
}


def clean_params(strategy: str, raw: dict) -> dict:
    """The strategy's parameters, each held to its range; integers where the rule counts days."""
    _, spec = STRATEGIES[strategy]
    params = {}
    for name, (default, low, high) in spec.items():
        try:
            value = float(raw.get(name, default))
        except (TypeError, ValueError):
            value = default
        value = min(max(value, low), high)
        params[name] = round(value) if name not in ("low", "high") else value
    if strategy == "sma_cross" and params["fast"] >= params["slow"]:
        params["fast"] = max(2, params["slow"] // 4)
    return params


def wants_for(strategy: str, rows: Rows, params: dict) -> list[bool]:
    rule, _ = STRATEGIES[strategy]
    return rule(rows, **clean_params(strategy, params))
