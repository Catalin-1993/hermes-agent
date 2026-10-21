"""Backtests on NautilusTrader: a strategy's signals (``signals.py``) executed by Nautilus's simulated
exchange — market orders on a cash account (decided and filled on a bar's close), the fee on every fill, the account and positions kept by
the engine — over the asset's daily bars, beside buy-and-hold run the same way.

Crypto trades in fractions (a currency pair in euros); stocks and ETFs in whole shares, in their
listing's currency. Every run is a fresh engine, disposed at the end; nothing is kept here.
"""

from __future__ import annotations

import datetime as dt
import warnings
from decimal import Decimal

from portfolio_service import signals, stats

_VENUE = "SIM"


class StoppedEarly(RuntimeError):
    """The engine ended the run before the last bar; a partial result is never reported as a whole one."""


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
    from nautilus_trader.model.enums import OrderSide, TimeInForce
    from nautilus_trader.model.identifiers import InstrumentId
    from nautilus_trader.model.objects import Quantity
    from nautilus_trader.trading.strategy import Strategy

    class FollowConfig(StrategyConfig, frozen=True):
        instrument_id: InstrumentId
        bar_type: BarType
        wants: tuple
        fee: float

    class Follow(Strategy):
        """Holds the asset exactly when the signals say so: all in on a True, all out on a False."""

        def __init__(self, config: FollowConfig) -> None:
            super().__init__(config)
            self.index, self.curve, self.fills = 0, [], []

        def on_start(self) -> None:
            self.instrument = self.cache.instrument(self.config.instrument_id)
            self.subscribe_bars(self.config.bar_type)

        def on_bar(self, bar) -> None:
            want = self.config.wants[self.index]
            self.index += 1
            close = float(bar.close)
            open_positions = self.cache.positions_open(instrument_id=self.config.instrument_id)
            held = float(open_positions[0].quantity) if open_positions else 0.0
            account = self.portfolio.account(self.instrument.id.venue)
            cash = account.balance_total(self.instrument.quote_currency).as_double()
            self.curve.append((bar.ts_event // 1_000_000_000, cash + held * close))
            if want and not open_positions:
                # A notional order ("buy this much money's worth"). The engine rounds it to whole units (a share,
                # or 1e-8 of a coin) and may round up, so one unit's worth is left aside.
                unit = close * 10 ** -self.instrument.size_precision
                notional = Quantity(max(cash / (1 + self.config.fee) * 0.999 - unit, 0.0),
                                    precision=self.instrument.size_precision)
                if float(notional) > 0:
                    self.submit_order(self.order_factory.market(
                        self.config.instrument_id, OrderSide.BUY, notional, time_in_force=TimeInForce.GTC,
                        quote_quantity=True))
            elif not want and open_positions:
                self.close_all_positions(self.config.instrument_id)

        def on_order_filled(self, event) -> None:
            self.fills.append({"side": "BUY" if event.order_side == OrderSide.BUY else "SELL",
                               "price": float(event.last_px), "quantity": float(event.last_qty),
                               "commission": event.commission.as_double(), "ts": event.ts_event // 1_000_000_000})

    return FollowConfig, Follow


def _simulate(bars: list[list], kind: str, symbol: str, currency: str, wants: list[bool], capital: float,
              fee_pct: float) -> tuple[list, list]:
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
        bar_type = BarType.from_str(f"{instrument.id}-1-DAY-LAST-EXTERNAL")
        engine.add_data([Bar(bar_type, instrument.make_price(o), instrument.make_price(h), instrument.make_price(low),
                             instrument.make_price(c), instrument.make_qty(volume), ts * 1_000_000_000, ts * 1_000_000_000)
                         for ts, o, h, low, c, volume in bars])
        config_class, strategy_class = _follow_class()
        strategy = strategy_class(config_class(instrument_id=instrument.id, bar_type=bar_type, wants=tuple(wants),
                                               fee=float(fee)))
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
        capital: float, fee_pct: float) -> dict:
    bars = _epoch_bars(daily)
    if len(bars) < 30:
        return {"error": "too_little_history"}
    ohlc = [(b[1], b[2], b[3], b[4]) for b in bars]
    wants = signals.wants_for(strategy, ohlc, params)
    periods = 365 if kind == "crypto" else 252
    days = (bars[-1][0] - bars[0][0]) / 86_400
    answer = {"strategy": strategy, "params": signals.clean_params(strategy, params), "bars": len(bars),
              "start": bars[0][0], "end": bars[-1][0], "prices": [[b[0], b[4]] for b in bars]}
    for name, signal in (("result", wants), ("benchmark", signals.buy_hold(ohlc))):
        try:
            curve, fills = _simulate(bars, kind, symbol, currency, signal, capital, fee_pct)
        except StoppedEarly as exc:
            return {"error": "stopped_early", "detail": str(exc)}
        trips = stats.round_trips(fills)
        answer[name] = {"curve": [[ts, round(value, 2)] for ts, value in curve], "trades": trips,
                        "stats": {**stats.curve_stats([v for _, v in curve], days, periods),
                                  **stats.trade_stats(trips, signal)}}
    return answer
