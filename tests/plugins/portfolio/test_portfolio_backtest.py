"""Backtesting: when each strategy holds, the numbers a run reports, and — where NautilusTrader is
installed (the service's own environment) — a whole run on the engine."""

import datetime as dt
import math
from pathlib import Path

import pytest

SERVICE_DIR = Path(__file__).resolve().parents[3] / "plugins" / "portfolio" / "service"


@pytest.fixture
def service_modules(monkeypatch):
    monkeypatch.syspath_prepend(str(SERVICE_DIR))
    from portfolio_service import signals, stats

    return signals, stats


def _rows(closes):
    return [(c, c * 1.01, c * 0.99, c) for c in closes]


def test_sma_cross_holds_while_the_fast_average_is_above_the_slow(service_modules):
    signals, _ = service_modules
    rising_then_falling = [float(i) for i in range(1, 31)] + [float(30 - i) for i in range(1, 31)]

    wants = signals.sma_cross(_rows(rising_then_falling), fast=3, slow=10)

    assert wants[:9] == [False] * 9  # not enough days for the slow average
    assert all(wants[9:30])  # the climb
    assert not any(wants[-20:])  # the fall


def test_rsi_buys_a_slump_and_sells_a_surge(service_modules):
    signals, _ = service_modules
    calm = [100.0 + (i % 2) for i in range(20)]  # up and down alike: RSI near 50
    closes = calm + [100.0 - 3 * i for i in range(1, 11)] + [70.0 + 4 * i for i in range(1, 16)]

    wants = signals.rsi_revert(_rows(closes), period=14, low=30, high=70)

    first_in = wants.index(True)
    assert 20 < first_in < 30  # during the slump, not in the calm
    assert wants[-1] is False  # sold into the surge


def test_breakout_enters_on_a_new_high_and_leaves_on_a_new_low(service_modules):
    signals, _ = service_modules
    closes = [100.0] * 10 + [120.0, 125.0, 130.0] + [100.0] * 5

    wants = signals.breakout([(c, c, c, c) for c in closes], entry=5, exit=3)

    assert wants[9] is False and wants[10] is True
    assert wants[13] is False  # 100 is below the lowest low of the 3 days before


def test_parameters_are_held_to_their_ranges_and_fast_stays_below_slow(service_modules):
    signals, _ = service_modules

    assert signals.clean_params("sma_cross", {"fast": 300, "slow": 100}) == {"fast": 25, "slow": 100}
    assert signals.clean_params("rsi_revert", {"period": "x", "low": -5}) == {"period": 14, "low": 1, "high": 70}


def test_curve_numbers(service_modules):
    _, stats = service_modules
    numbers = stats.curve_stats([100.0, 120.0, 90.0, 110.0], days=365.25, periods_per_year=252)

    assert numbers["total_return_pct"] == pytest.approx(10.0)
    assert numbers["cagr_pct"] == pytest.approx(10.0)
    assert numbers["max_drawdown_pct"] == pytest.approx(-25.0)
    assert numbers["volatility_pct"] > 0 and math.isfinite(numbers["sharpe"])


def test_round_trips_count_fees_and_keep_an_unsold_buy_open(service_modules):
    _, stats = service_modules
    fills = [{"side": "BUY", "price": 10.0, "quantity": 100, "commission": 1.0, "ts": 1},
             {"side": "SELL", "price": 12.0, "quantity": 100, "commission": 1.2, "ts": 2},
             {"side": "BUY", "price": 11.0, "quantity": 50, "commission": 0.5, "ts": 3}]

    trips = stats.round_trips(fills)

    assert trips[0]["pnl"] == pytest.approx(1200 - 1.2 - 1000 - 1.0)
    assert trips[1]["exit_ts"] is None and trips[1]["pnl"] is None
    summary = stats.trade_stats(trips, 0, 4)
    # Held from 1 to 2, then from 3 to the end (4): half the period.
    assert (summary["trades"], summary["win_rate_pct"], summary["exposure_pct"]) == (1, 100.0, 50.0)
    assert summary["exits"]["signal"] == 1


def _daily(closes):
    start = dt.date(2024, 1, 1)
    return [[(start + dt.timedelta(days=i)).isoformat(), c, c * 1.01, c * 0.99, c, 1000.0] for i, c in enumerate(closes)]


@pytest.mark.parametrize("kind", ["crypto", "stocks"])
def test_a_whole_run_on_nautilus_trades_the_signals_and_matches_buy_and_hold(service_modules, kind):
    pytest.importorskip("nautilus_trader")
    from portfolio_service import backtest

    closes = [100.0 * (1.01 ** i) for i in range(120)]  # a steady climb
    answer = backtest.run(_daily(closes), kind=kind, symbol="TEST", currency="EUR", strategy="buy_hold", params={},
                          capital=10_000, fee_pct=0.1)

    result, benchmark = answer["result"], answer["benchmark"]
    assert len(result["curve"]) == 120
    assert result["trades"][0]["exit_ts"] is None  # bought once, still held
    expected = (closes[-1] / closes[0] - 1) * 100
    # Less the fee and the cash a whole-share (or 1e-8 coin) order leaves over: within 2% of the climb.
    assert result["stats"]["total_return_pct"] == pytest.approx(expected, rel=0.02)
    assert result["stats"] == benchmark["stats"]


def test_ema_cross_and_macd_get_in_on_a_rally_and_out_when_it_turns(service_modules):
    signals, _ = service_modules
    # Flat, then +3% a day for 20 days, then −3% a day for 20 days. MACD answers to acceleration, so it is
    # read early in each leg; the averages' cross is read at the legs' ends.
    closes = [100.0] * 40 + [100.0 * 1.03 ** i for i in range(1, 21)]
    closes += [closes[-1] * 0.97 ** i for i in range(1, 21)]
    rows = _rows(closes)

    macd = signals.macd(rows, fast=5, slow=20, signal=5)
    assert not any(macd[:40]) and macd[45] is True and macd[65] is False
    ema = signals.ema_cross(rows, fast=5, slow=20)
    assert ema[59] is True and ema[-1] is False


def test_bollinger_buys_a_drop_below_the_band_and_sells_back_at_the_average(service_modules):
    signals, _ = service_modules
    calm = [100.0 + (i % 2) for i in range(20)]
    wants = signals.bollinger(_rows(calm + [90.0, 92.0, 101.0, 101.0]), period=20, width=2)

    assert wants[19] is False and wants[20] is True and wants[21] is True
    assert wants[22] is False  # back above the average


def test_the_trend_filter_keeps_a_strategy_out_below_its_average(service_modules):
    signals, _ = service_modules
    rows = _rows([100.0] * 10 + [90.0] * 5 + [120.0] * 5)

    assert signals.trend_filter(rows, [True] * 20, 0) == [True] * 20
    filtered = signals.trend_filter(rows, [True] * 20, 10)
    assert filtered[:9] == [False] * 9 and not any(filtered[10:15]) and all(filtered[15:])


def test_execution_settings_are_held_to_their_ranges(monkeypatch):
    monkeypatch.syspath_prepend(str(SERVICE_DIR))
    from portfolio_service import backtest

    how = backtest.clean_execution({"size_pct": 300, "stop_loss_pct": -4, "trailing_pct": "x", "trend_filter": 3,
                                    "timeframe": "1M"})

    assert (how.size_pct, how.stop_loss_pct, how.trailing_pct, how.trend_filter, how.timeframe) == (100, 0, 0, 0, "1d")
    assert backtest.clean_execution({}).protected is False
    assert backtest.clean_execution({"take_profit_pct": 10}).protected is True


def test_daily_bars_become_iso_weeks(monkeypatch):
    monkeypatch.syspath_prepend(str(SERVICE_DIR))
    from portfolio_service import backtest

    monday = int(dt.datetime(2026, 10, 19, tzinfo=dt.UTC).timestamp())
    days = [[monday + i * 86_400, 10.0 + i, 20.0 + i, 5.0 - i, 11.0 + i, 1.0] for i in range(9)]  # Mon … next Tue

    weeks = backtest.weekly(days)

    assert len(weeks) == 2
    assert weeks[0] == [monday, 10.0, 26.0, -1.0, 17.0, 7.0]


def test_protective_exits_are_named_and_the_strategy_waits_for_its_signal_to_reset(service_modules):
    pytest.importorskip("nautilus_trader")
    from portfolio_service import backtest

    # Up 30% in 30 days, then down: a 10% take-profit fires early; the signal stays true, so no re-entry.
    closes = [100.0 * (1.01 ** i) for i in range(30)] + [134.0 * (0.99 ** i) for i in range(30)]
    answer = backtest.run(_daily(closes), kind="crypto", symbol="TEST", currency="EUR", strategy="buy_hold",
                          params={}, capital=10_000, fee_pct=0.1, execution={"take_profit_pct": 10})

    trades = answer["result"]["trades"]
    assert [t["exit_reason"] for t in trades] == ["take_profit"]
    assert trades[0]["exit_price"] / trades[0]["entry_price"] == pytest.approx(1.10, abs=0.001)
    assert answer["result"]["stats"]["exits"]["take_profit"] == 1


def test_a_rule_longer_than_the_history_says_so(service_modules):
    pytest.importorskip("nautilus_trader")
    from portfolio_service import backtest

    answer = backtest.run(_daily([100.0 + i for i in range(60)]), kind="stocks", symbol="TEST", currency="EUR",
                          strategy="sma_cross", params={"fast": 20, "slow": 200}, capital=10_000, fee_pct=0.1)

    assert answer["notes"] == ["periods_too_long"]
