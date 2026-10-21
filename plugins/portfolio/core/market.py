"""Market prices for the journal's positions, and the valuation the dashboard shows.

Symbols are the journal's (``VWCE.DE``, ``TLV.RO``, ``BTC``); the data service answers in each
listing's own currency, so this module maps a symbol to what the provider knows (``BTC`` →
``BTC-EUR``), knows the currency a listing quotes in, and turns every price into euros with that
day's rate. A position the service cannot price keeps its journal cost and says so — the dashboard
never shows a number without its source.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from plugins.portfolio.core.journal import Book

CRYPTO_MARKETS = {"CCC", "CRYPTO", "CRIPTO"}

# Listing suffix → the currency its prices are quoted in. No suffix is a US listing.
_SUFFIX_CURRENCY = {".RO": "RON", ".L": "GBp", ".SW": "CHF", ".US": "USD"}
# Euro per unit of a currency comes from the provider's EUR<CCY> pair.
_FX_PAIR = {"RON": "EURRON=X", "USD": "EURUSD=X", "GBp": "EURGBP=X", "CHF": "EURCHF=X"}


def provider_symbol(symbol: str, market: str) -> str:
    """What the data provider calls this position."""
    if market.upper() in CRYPTO_MARKETS and "-" not in symbol:
        return f"{symbol.upper()}-EUR"
    return symbol


def quote_currency(symbol: str, market: str) -> str:
    if market.upper() in CRYPTO_MARKETS or symbol.upper().endswith("-EUR"):
        return "EUR"
    for suffix, currency in _SUFFIX_CURRENCY.items():
        if symbol.upper().endswith(suffix):
            return currency
    return "USD" if "." not in symbol else "EUR"


def fx_symbols(book: Book) -> list[str]:
    needed = {quote_currency(p.symbol, p.market) for p in book.positions.values()}
    return sorted(_FX_PAIR[c] for c in needed if c in _FX_PAIR)


def to_eur(price: float, currency: str, fx: dict[str, float]) -> Optional[float]:
    """A price in euros, or None when the rate it needs is missing."""
    if currency == "EUR":
        return price
    rate = fx.get(_FX_PAIR.get(currency, ""))
    if not rate:
        return None
    return (price / 100 if currency == "GBp" else price) / rate


@dataclass
class PricedPosition:
    name: str
    symbol: str
    asset_class: str
    quantity: float
    average_eur: float
    price_eur: float
    value_eur: float
    cost_eur: float
    day_change_eur: float
    source: str  # "piață" (market) or "jurnal" (the journal's cost)


def asset_class(name: str, symbol: str, market: str) -> str:
    """The plan's asset class for a position, from what the journal records about it."""
    lowered = name.lower()
    if market.upper() in CRYPTO_MARKETS:
        return "Cripto"
    if symbol.upper().endswith(".RO") or market.upper() == "BVB":
        return "Acțiuni BVB"
    if any(word in lowered for word in ("bond", "govt", "corp", "obliga")):
        return "Obligațiuni"
    if any(word in lowered for word in ("gold", "aur", "silver", "commod")):
        return "Aur și materii prime"
    if any(word in lowered for word in ("overnight", "money market", "monetar", "cash")):
        return "Numerar"
    return "Acțiuni globale"


def price_book(book: Book, quotes: dict[str, dict], fx: dict[str, float]) -> list[PricedPosition]:
    """Every open position at its market price in euros; the journal's cost where the market has none."""
    priced = []
    for position in book.positions.values():
        quote = quotes.get(provider_symbol(position.symbol, position.market)) or {}
        currency = quote_currency(position.symbol, position.market)
        last = to_eur(quote["last"], currency, fx) if quote.get("last") else None
        previous = to_eur(quote["prev"], currency, fx) if quote.get("prev") else None
        price = last if last is not None else position.average_eur
        priced.append(PricedPosition(
            name=position.name, symbol=position.symbol,
            asset_class=asset_class(position.name, position.symbol, position.market),
            quantity=position.quantity, average_eur=position.average_eur, price_eur=price,
            value_eur=position.quantity * price, cost_eur=position.cost_eur,
            day_change_eur=position.quantity * (price - previous) if last is not None and previous else 0.0,
            source="piață" if last is not None else "jurnal"))
    return sorted(priced, key=lambda p: p.value_eur, reverse=True)


def _filled(series: list, dates: list[str]) -> dict[str, float]:
    """A close for every date, carried forward over days the listing did not trade."""
    by_date = {str(day)[:10]: float(close) for day, close in series if close is not None}
    filled, last = {}, None
    for day in dates:
        last = by_date.get(day, last)
        if last is not None:
            filled[day] = last
    return filled


_FIELDS = ("open", "high", "low", "close")


def _filled_bars(bars: list, dates: list[str]) -> dict[str, dict[str, float]]:
    """Open, high, low and close for every date. A day the listing did not trade is flat at the last close."""
    by_date = {str(row[0])[:10]: [float(v) for v in row[1:5]] for row in bars if len(row) >= 5 and None not in row[1:5]}
    filled: dict[str, dict[str, float]] = {field: {} for field in _FIELDS}
    last = None
    for day in dates:
        values = by_date.get(day) or ([last] * 4 if last is not None else None)
        if values is not None:
            for field, value in zip(_FIELDS, values):
                filled[field][day] = value
            last = values[3]
    return filled


def _holdings_by_day(book: Book, dates: list[str]) -> list[tuple[str, Book]]:
    """The book as it stood at the end of each day: the trades replayed up to it."""
    from plugins.portfolio.core.journal import build_book

    return [(day, build_book([t for t in book.trades if t.when[:10] <= day], book.variant, book.capital_eur))
            for day in dates]


def _value_on(held: Book, day: str, prices: dict[str, dict[str, float]], rates: dict[str, dict[str, float]]) -> float:
    """The cash plus each holding at that day's price in euros; a holding with no price yet counts at cost."""
    value = held.cash_eur
    fx = {pair: series[day] for pair, series in rates.items() if day in series}
    for position in held.positions.values():
        price = prices.get(provider_symbol(position.symbol, position.market), {}).get(day)
        in_eur = to_eur(price, quote_currency(position.symbol, position.market), fx) if price else None
        value += position.quantity * in_eur if in_eur is not None else position.cost_eur
    return value


def _history_dates(book: Book, series_lists: list[list]) -> list[str]:
    if not book.started:
        return []
    return sorted({str(row[0])[:10] for series in series_lists for row in series if str(row[0])[:10] >= book.started})


def value_history(book: Book, closes: dict[str, list], fx_closes: dict[str, list]) -> list[dict]:
    """The portfolio's value each trading day since it started: the trades replayed up to that day,
    each holding at that day's close in euros, plus the cash. A holding with no close yet counts at cost."""
    dates = _history_dates(book, list(closes.values()))
    prices = {symbol: _filled(series, dates) for symbol, series in closes.items()}
    rates = {pair: _filled(series, dates) for pair, series in fx_closes.items()}
    return [{"date": day, "value": round(_value_on(held, day, prices, rates), 2)}
            for day, held in _holdings_by_day(book, dates)]


def value_candles(book: Book, bars: dict[str, list], fx_closes: dict[str, list]) -> list[dict]:
    """The portfolio's value as daily candles. Each field adds up the holdings' own field for the day, so
    a candle's high and low are the envelope of what the holdings reached, not a moment the whole
    portfolio stood at — the open and close are exact."""
    dates = _history_dates(book, list(bars.values()))
    tables = {symbol: _filled_bars(series, dates) for symbol, series in bars.items()}
    rates = {pair: _filled(series, dates) for pair, series in fx_closes.items()}
    candles = []
    for day, held in _holdings_by_day(book, dates):
        row = {field: round(_value_on(held, day, {s: t[field] for s, t in tables.items()}, rates), 2)
               for field in _FIELDS}
        candles.append({"date": day, **row})
    return candles
