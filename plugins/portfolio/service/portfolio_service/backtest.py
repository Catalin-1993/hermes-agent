"""Backtests on NautilusTrader: a strategy's signals (``signals.py``) executed by Nautilus's simulated
exchange over the asset's daily (or weekly) bars, beside buy-and-hold run the same way.

Orders are decided and filled on a bar's close, on a cash account, with the fee on every fill; the
engine keeps the account and positions. An entry takes a share of the cash (``size_pct``) and, when a
stop-loss, take-profit or trailing stop is set, goes in as a Nautilus bracket: the entry with its
protective orders, one cancelling the other (OUO). After such an exit the strategy waits for its signal
to reset before it buys again. Every fill says why it happened (signal, stop-loss, take-profit,
trailing).

Crypto trades in fractions (a currency pair in euros); stocks and ETFs in whole shares, in their
listing's currency. Every run is a fresh engine, disposed at the end; nothing is kept here.
"""

from __future__ import annotations

import datetime as dt
import math
import warnings
from dataclasses import dataclass
from decimal import Decimal

from portfolio_service import signals, stats

_VENUE = "SIM"


class StoppedEarly(RuntimeError):
    """The engine ended the run before the last bar; a partial result is never reported as a whole one."""


@dataclass(frozen=True)
class Execution:
    """How a strategy trades: position size, protective orders (0 = off), trend filter and bar length."""

    size_pct: float = 100.0
    stop_loss_pct: float = 0.0
    take_profit_pct: float = 0.0
    trailing_pct: float = 0.0
    trend_filter: int = 0
    timeframe: str = "1d"

    @property
    def protected(self) -> bool:
        return bool(self.stop_loss_pct or self.take_profit_pct or self.trailing_pct)


def _number(raw: dict, name: str, low: float, high: float) -> float:
    try:
        value = float(raw.get(name) or 0)
    except (TypeError, ValueError):
        value = 0.0
    return min(max(value, low), high)


def clean_execution(raw: dict | None) -> Execution:
    raw = raw if isinstance(raw, dict) else {}
    trend = round(_number(raw, "trend_filter", 0, 400))
    return Execution(
        size_pct=_number(raw, "size_pct", 10, 100) if raw.get("size_pct") else 100.0,
        stop_loss_pct=_number(raw, "stop_loss_pct", 0, 50),
        take_profit_pct=_number(raw, "take_profit_pct", 0, 500),
        trailing_pct=_number(raw, "trailing_pct", 0, 50),
        trend_filter=trend if trend >= 5 else 0,
        timeframe="1w" if raw.get("timeframe") == "1w" else "1d",
    )


def weekly(bars: list[list]) -> list[list]:
    """Daily ``[seconds, o, h, l, c, v]`` bars as weekly ones (ISO weeks), stamped with each week's first day."""
    weeks: dict[tuple[int, int], list] = {}
    for ts, o, h, low, c, volume in bars:
        key = dt.datetime.fromtimestamp(ts, dt.UTC).isocalendar()[:2]
        if key not in weeks:
            weeks[key] = [ts, o, h, low, c, volume]
        else:
            week = weeks[key]
            week[2], week[3], week[4], week[5] = max(week[2], h), min(week[3], low), c, week[5] + volume
    return list(weeks.values())


_REASONS = {"MARKET": "signal", "STOP_MARKET": "stop_loss", "LIMIT": "take_profit", "TRAILING_STOP_MARKET": "trailing"}


def _precision(price: float) -> int:
    return 2 if price >= 100 else 4 if price >= 1 else 8


def _instrument(symbol: str, kind: str, currency: str, price: float, fee: Decimal):
    from nautilus_trader.model.currencies import EUR
    from nautilus_trader.model.enums import CurrencyType
    from nautilus_trader.model.identifiers import InstrumentId, Symbol, Venue
    from nautilus_trader.model.instruments import CurrencyPair, Equity
    from nautilus_trader.model.objects import Currency, Price, Quantity

    digits = _precision(price)
    increment = Price.from_str(f"{10 ** -digits:.{digits}f}")
    if kind == "crypto":
        # A code of its own, so a coin never overwrites one of Nautilus's built-in currencies.
        base = Currency(f"X{symbol[:10]}", 8, 0, symbol, CurrencyType.CRYPTO)
        Currency.register(base, overwrite=True)
        pair = Symbol(f"{symbol}/EUR")
        instrument = CurrencyPair(
            instrument_id=InstrumentId(pair, Venue(_VENUE)), raw_symbol=pair, base_currency=base, quote_currency=EUR,
            price_precision=digits, size_precision=8, price_increment=increment,
            size_increment=Quantity.from_str("0.00000001"), lot_size=None, max_quantity=None, min_quantity=None,
            max_notional=None, min_notional=None, max_price=None, min_price=None, margin_init=Decimal(0),
            margin_maint=Decimal(0), maker_fee=fee, taker_fee=fee, ts_event=0, ts_init=0)
        return instrument, base, EUR
    try:
        quote = Currency.from_str({"GBp": "GBP"}.get(currency, currency))
    except ValueError:
        quote = EUR
    name = Symbol(symbol.replace("^", ""))
    instrument = Equity(
        instrument_id=InstrumentId(name, Venue(_VENUE)), raw_symbol=name, currency=quote, price_precision=digits,
        price_increment=increment, lot_size=Quantity.from_int(1), maker_fee=fee, taker_fee=fee, ts_event=0, ts_init=0)
    return instrument, None, quote


def _follow_class():
    """The executing strategy, built on first use so this module imports without Nautilus."""
    from nautilus_trader.config import StrategyConfig
    from nautilus_trader.model.data import BarType
    from nautilus_trader.model.enums import OrderSide, OrderType, TimeInForce, TrailingOffsetType
    from nautilus_trader.model.identifiers import InstrumentId
    from nautilus_trader.model.objects import Quantity
    from nautilus_trader.trading.strategy import Strategy

    class FollowConfig(StrategyConfig, frozen=True):
        instrument_id: InstrumentId
        bar_type: BarType
        wants: tuple
        fee: float
        size: float = 1.0
        stop_loss: float = 0.0
        take_profit: float = 0.0
        trailing: float = 0.0

    class Follow(Strategy):
        """In when the signals say so (with protective orders when set), out when they turn false."""

        def __init__(self, config: FollowConfig) -> None:
            super().__init__(config)
            self.index, self.curve, self.fills = 0, [], []
            self.waiting_for_reset = False  # after a protective exit, until the signal turns false

        def on_start(self) -> None:
            self.instrument = self.cache.instrument(self.config.instrument_id)
            self.subscribe_bars(self.config.bar_type)

        def _quantity(self, cash: float, close: float):
            # Floored to whole units (a share, or 1e-8 of a coin), so a fill at the close never overdraws.
            precision = self.instrument.size_precision
            units = math.floor(cash * self.config.size / (close * (1 + self.config.fee)) * 0.999 * 10 ** precision)
            return Quantity(units / 10 ** precision, precision=precision) if units > 0 else None

        def _enter(self, quantity, close: float) -> None:
            cfg, make = self.config, self.instrument.make_price
            if not (cfg.stop_loss or cfg.take_profit or cfg.trailing):
                self.submit_order(self.order_factory.market(cfg.instrument_id, OrderSide.BUY, quantity,
                                                            time_in_force=TimeInForce.GTC))
                return
            protect = {}
            if cfg.take_profit:
                protect["tp_price"] = make(close * (1 + cfg.take_profit))
            if cfg.trailing:
                protect.update(sl_order_type=OrderType.TRAILING_STOP_MARKET,
                               sl_trailing_offset=Decimal(str(round(cfg.trailing * 10_000, 2))),
                               sl_trailing_offset_type=TrailingOffsetType.BASIS_POINTS,
                               sl_trigger_price=make(close * (1 - (cfg.stop_loss or cfg.trailing))))
            elif cfg.stop_loss:
                protect["sl_trigger_price"] = make(close * (1 - cfg.stop_loss))
            else:  # take-profit alone: a bracket still needs a stop, so it sits where it can never trigger
                protect["sl_trigger_price"] = make(close * 0.01)
            if "tp_price" not in protect:  # stop alone: the take-profit sits where it can never fill
                protect["tp_price"] = make(close * 100)
            self.submit_order_list(self.order_factory.bracket(cfg.instrument_id, OrderSide.BUY, quantity, **protect))

        def on_bar(self, bar) -> None:
            want = self.config.wants[self.index]
            self.index += 1
            close = float(bar.close)
            instrument_id = self.config.instrument_id
            open_positions = self.cache.positions_open(instrument_id=instrument_id)
            held = float(open_positions[0].quantity) if open_positions else 0.0
            cash = self.portfolio.account(self.instrument.id.venue).balance_total(self.instrument.quote_currency).as_double()
            self.curve.append((bar.ts_event // 1_000_000_000, cash + held * close))
            if not want:
                self.waiting_for_reset = False
            if want and not open_positions and not self.waiting_for_reset and not self.cache.orders_open(instrument_id=instrument_id):
                quantity = self._quantity(cash, close)
                if quantity is not None:
                    self._enter(quantity, close)
            elif not want and open_positions:
                self.cancel_all_orders(instrument_id)
                self.close_all_positions(instrument_id)

        def on_order_filled(self, event) -> None:
            buy = event.order_side == OrderSide.BUY
            reason = "entry" if buy else _REASONS.get(event.order_type.name, "signal")
            if not buy and reason != "signal":
                self.waiting_for_reset = True
            self.fills.append({"side": "BUY" if buy else "SELL", "price": float(event.last_px),
                               "quantity": float(event.last_qty), "commission": event.commission.as_double(),
                               "ts": event.ts_event // 1_000_000_000, "reason": reason})

    return FollowConfig, Follow


def _simulate(bars: list[list], kind: str, symbol: str, currency: str, wants: list[bool], capital: float,
              fee_pct: float, execution: Execution) -> tuple[list, list]:
    from nautilus_trader.backtest.config import BacktestEngineConfig
    from nautilus_trader.backtest.engine import BacktestEngine
    from nautilus_trader.config import LoggingConfig
    from nautilus_trader.model.data import Bar, BarType
    from nautilus_trader.model.enums import AccountType, OmsType
    from nautilus_trader.model.identifiers import Venue
    from nautilus_trader.model.objects import Money

    fee = Decimal(str(round(fee_pct / 100, 6)))
    instrument, base, quote = _instrument(symbol, kind, currency, float(bars[-1][4]), fee)
    engine = BacktestEngine(BacktestEngineConfig(logging=LoggingConfig(bypass_logging=True)))
    try:
        balances = [Money(capital, quote)] + ([Money(0, base)] if base is not None else [])
        engine.add_venue(venue=Venue(_VENUE), oms_type=OmsType.NETTING, account_type=AccountType.CASH,
                         starting_balances=balances, base_currency=None)
        engine.add_instrument(instrument)
        bar_type = BarType.from_str(f"{instrument.id}-1-{'WEEK' if execution.timeframe == '1w' else 'DAY'}-LAST-EXTERNAL")
        engine.add_data([Bar(bar_type, instrument.make_price(o), instrument.make_price(h), instrument.make_price(low),
                             instrument.make_price(c), instrument.make_qty(volume), ts * 1_000_000_000, ts * 1_000_000_000)
                         for ts, o, h, low, c, volume in bars])
        config_class, strategy_class = _follow_class()
        strategy = strategy_class(config_class(
            instrument_id=instrument.id, bar_type=bar_type, wants=tuple(wants), fee=float(fee),
            size=execution.size_pct / 100, stop_loss=execution.stop_loss_pct / 100,
            take_profit=execution.take_profit_pct / 100, trailing=execution.trailing_pct / 100))
        engine.add_strategy(strategy)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")  # Nautilus's own pandas deprecation notices, not the owner's concern
            engine.run()
        if strategy.index < len(bars):  # the engine stops a run on its own (an overdrawn account, …)
            raise StoppedEarly(f"the engine stopped after {strategy.index} of {len(bars)} bars")
        return strategy.curve, strategy.fills
    finally:
        engine.dispose()


def _epoch_bars(rows: list[list]) -> list[list]:
    """``[date, o, h, l, c, v]`` rows (the service's daily bars) as ``[seconds, o, h, l, c, v]``."""
    out = []
    for row in rows:
        day = dt.date.fromisoformat(str(row[0])[:10])
        seconds = int(dt.datetime(day.year, day.month, day.day, tzinfo=dt.UTC).timestamp())
        out.append([seconds, *[float(v) for v in row[1:5]], float(row[5]) if len(row) > 5 else 0.0])
    return out


def run(daily: list[list], *, kind: str, symbol: str, currency: str, strategy: str, params: dict,
        capital: float, fee_pct: float, execution: dict | None = None) -> dict:
    how = clean_execution(execution)
    bars = _epoch_bars(daily)
    if how.timeframe == "1w":
        bars = weekly(bars)
    if len(bars) < 30:
        return {"error": "too_little_history"}
    ohlc = [(b[1], b[2], b[3], b[4]) for b in bars]
    wants = signals.trend_filter(ohlc, signals.wants_for(strategy, ohlc, params), how.trend_filter)
    periods = 52 if how.timeframe == "1w" else 365 if kind == "crypto" else 252
    days = (bars[-1][0] - bars[0][0]) / 86_400
    cleaned = signals.clean_params(strategy, params)
    # A rule that needs more bars than the period holds can never trade; say so rather than show a flat zero.
    longest = max([v for k, v in cleaned.items() if k not in signals.DECIMAL_PARAMS] + [how.trend_filter, 0])
    answer = {"strategy": strategy, "params": cleaned, "bars": len(bars), "execution": how.__dict__,
              "notes": ["periods_too_long"] if longest >= len(bars) else [],
              "start": bars[0][0], "end": bars[-1][0], "prices": [[b[0], b[4]] for b in bars]}
    legs = (("result", wants, how), ("benchmark", signals.buy_hold(ohlc), Execution(timeframe=how.timeframe)))
    for name, signal, leg in legs:
        try:
            curve, fills = _simulate(bars, kind, symbol, currency, signal, capital, fee_pct, leg)
        except StoppedEarly as exc:
            return {"error": "stopped_early", "detail": str(exc)}
        trips = stats.round_trips(fills)
        answer[name] = {"curve": [[ts, round(value, 2)] for ts, value in curve], "trades": trips,
                        "stats": {**stats.curve_stats([v for _, v in curve], days, periods),
                                  **stats.trade_stats(trips, bars[0][0], bars[-1][0])}}
    return answer
