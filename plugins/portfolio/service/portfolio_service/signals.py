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


def _ema(values: list[float], period: int) -> list[float | None]:
    """Exponential average, seeded with the simple average of the first `period` values."""
    out: list[float | None] = [None] * len(values)
    if len(values) < period:
        return out
    alpha, current = 2 / (period + 1), sum(values[:period]) / period
    out[period - 1] = current
    for i in range(period, len(values)):
        current = alpha * values[i] + (1 - alpha) * current
        out[i] = current
    return out


def ema_cross(rows: Rows, fast: int = 12, slow: int = 26) -> list[bool]:
    """In while the fast exponential average is above the slow one."""
    closes = [row[3] for row in rows]
    a, b = _ema(closes, fast), _ema(closes, slow)
    return [x is not None and y is not None and x > y for x, y in zip(a, b, strict=True)]


def macd(rows: Rows, fast: int = 12, slow: int = 26, signal: int = 9) -> list[bool]:
    """In while the MACD line (fast EMA − slow EMA) is above its signal line (an EMA of itself)."""
    closes = [row[3] for row in rows]
    a, b = _ema(closes, fast), _ema(closes, slow)
    line = [x - y for x, y in zip(a, b, strict=True) if x is not None and y is not None]
    offset = len(closes) - len(line)
    trigger = _ema(line, signal)
    wants = [False] * offset
    wants += [t is not None and value > t for value, t in zip(line, trigger, strict=True)]
    return wants


def bollinger(rows: Rows, period: int = 20, width: float = 2.0) -> list[bool]:
    """Mean reversion: buy a close below the lower band (average − `width` deviations), sell once the
    close is back above the average."""
    closes = [row[3] for row in rows]
    wants, holding = [], False
    for i, close in enumerate(closes):
        if i + 1 >= period:
            window = closes[i + 1 - period:i + 1]
            mean = sum(window) / period
            deviation = (sum((c - mean) ** 2 for c in window) / period) ** 0.5
            if not holding and close < mean - width * deviation:
                holding = True
            elif holding and close > mean:
                holding = False
        wants.append(holding)
    return wants


def atr(rows: Rows, period: int = 14) -> list[float | None]:
    """Wilder's average true range: how far the price typically moves in one bar, gaps included."""
    out: list[float | None] = [None] * len(rows)
    current = 0.0
    for i in range(1, len(rows)):
        _, high, low, _ = rows[i]
        prev_close = rows[i - 1][3]
        true_range = max(high - low, abs(high - prev_close), abs(low - prev_close))
        if i < period:
            current += true_range / period
        elif i == period:
            current += true_range / period
            out[i] = current
        else:
            current = (current * (period - 1) + true_range) / period
            out[i] = current
    return out


def adx(rows: Rows, period: int = 14) -> list[float | None]:
    """Wilder's ADX: how strong the trend is (not its direction), 0–100; above ~25 is a clear trend."""
    out: list[float | None] = [None] * len(rows)
    tr_sum = plus_sum = minus_sum = 0.0
    dxs: list[float] = []
    current = 0.0
    for i in range(1, len(rows)):
        _, high, low, _ = rows[i]
        _, prev_high, prev_low, prev_close = rows[i - 1]
        up, down = high - prev_high, prev_low - low
        plus = up if up > down and up > 0 else 0.0
        minus = down if down > up and down > 0 else 0.0
        true_range = max(high - low, abs(high - prev_close), abs(low - prev_close))
        if i <= period:
            tr_sum, plus_sum, minus_sum = tr_sum + true_range, plus_sum + plus, minus_sum + minus
        else:
            tr_sum = tr_sum - tr_sum / period + true_range
            plus_sum = plus_sum - plus_sum / period + plus
            minus_sum = minus_sum - minus_sum / period + minus
        if i < period or tr_sum == 0:
            continue
        plus_di, minus_di = 100 * plus_sum / tr_sum, 100 * minus_sum / tr_sum
        dx = 0.0 if plus_di + minus_di == 0 else 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
        if len(dxs) < period:
            dxs.append(dx)
            if len(dxs) == period:
                current = sum(dxs) / period
                out[i] = current
        else:
            current = (current * (period - 1) + dx) / period
            out[i] = current
    return out


def supertrend(rows: Rows, period: int = 10, factor: float = 3.0) -> list[bool]:
    """In while SuperTrend points up: a close above the upper band (the middle of the bar plus `factor`
    ATRs) turns it up, a close below the lower band turns it down; the bands only tighten meanwhile."""
    ranges = atr(rows, period)
    wants, up = [], False
    upper = lower = None
    for i, (_, high, low, close) in enumerate(rows):
        if ranges[i] is None:
            wants.append(False)
            continue
        middle, prev_close = (high + low) / 2, rows[i - 1][3]
        basic_upper, basic_lower = middle + factor * ranges[i], middle - factor * ranges[i]
        if upper is not None and close > upper:
            up = True
        elif lower is not None and close < lower:
            up = False
        upper = basic_upper if upper is None or basic_upper < upper or prev_close > upper else upper
        lower = basic_lower if lower is None or basic_lower > lower or prev_close < lower else lower
        wants.append(up)
    return wants


def adx_gate(rows: Rows, wants: list[bool], threshold: float, period: int = 14) -> list[bool]:
    """Enter only while the trend is strong (ADX at or above `threshold`); once in, the strategy's own
    exit decides. A weak trend never forces a sale."""
    if threshold <= 0:
        return wants
    strength = adx(rows, period)
    gated, holding = [], False
    for want, value in zip(wants, strength, strict=True):
        if not want:
            holding = False
        elif not holding and value is not None and value >= threshold:
            holding = True
        gated.append(holding)
    return gated


def trend_filter(rows: Rows, wants: list[bool], period: int) -> list[bool]:
    """Only while the close is above its `period`-day average: a strategy that would be in below it stays
    out (and leaves when the trend breaks)."""
    if period <= 0:
        return wants
    closes = [row[3] for row in rows]
    return [want and (avg := _sma(closes, period, i)) is not None and closes[i] > avg for i, want in enumerate(wants)]


# name → (rule, its parameters with (default, lowest, highest))
STRATEGIES: dict[str, tuple[Callable[..., list[bool]], dict[str, tuple[float, float, float]]]] = {
    "buy_hold": (buy_hold, {}),
    "sma_cross": (sma_cross, {"fast": (50, 2, 250), "slow": (200, 5, 400)}),
    "rsi_revert": (rsi_revert, {"period": (14, 2, 60), "low": (30, 1, 50), "high": (70, 50, 99)}),
    "breakout": (breakout, {"entry": (55, 5, 250), "exit": (20, 2, 250)}),
    "ema_cross": (ema_cross, {"fast": (12, 2, 200), "slow": (26, 5, 400)}),
    "macd": (macd, {"fast": (12, 2, 100), "slow": (26, 5, 200), "signal": (9, 2, 50)}),
    "bollinger": (bollinger, {"period": (20, 5, 200), "width": (2.0, 0.5, 4.0)}),
    "supertrend": (supertrend, {"period": (10, 2, 100), "factor": (3.0, 0.5, 10.0)}),
}

# Parameters that are amounts, not counts of days.
DECIMAL_PARAMS = {"low", "high", "width", "factor"}


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
        params[name] = value if name in DECIMAL_PARAMS else round(value)
    if strategy in ("sma_cross", "ema_cross", "macd") and params["fast"] >= params["slow"]:
        params["fast"] = max(2, params["slow"] // 4)
    return params


def wants_for(strategy: str, rows: Rows, params: dict) -> list[bool]:
    rule, _ = STRATEGIES[strategy]
    return rule(rows, **clean_params(strategy, params))
