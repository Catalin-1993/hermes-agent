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


def value_history(book: Book, closes: dict[str, list], fx_closes: dict[str, list]) -> list[dict]:
    """The portfolio's value each trading day since it started: the trades replayed up to that day,
    each holding at that day's close in euros, plus the cash. A holding with no close yet counts at cost."""
    from plugins.portfolio.core.journal import build_book

    if not book.started:
        return []
    dates = sorted({str(day)[:10] for series in closes.values() for day, _ in series if str(day)[:10] >= book.started})
    if not dates:
        return []
    prices = {symbol: _filled(series, dates) for symbol, series in closes.items()}
    rates = {pair: _filled(series, dates) for pair, series in fx_closes.items()}
    history = []
    for day in dates:
        held = build_book([t for t in book.trades if t.when[:10] <= day], book.variant, book.capital_eur)
        value = held.cash_eur
        for position in held.positions.values():
            close = prices.get(provider_symbol(position.symbol, position.market), {}).get(day)
            fx = {pair: series[day] for pair, series in rates.items() if day in series}
            in_eur = to_eur(close, quote_currency(position.symbol, position.market), fx) if close else None
            value += position.quantity * in_eur if in_eur is not None else position.cost_eur
        history.append({"date": day, "value": round(value, 2)})
    return history
