"""The Watchlist: the coins the owner follows, kept per profile in ``<HERMES_HOME>/portfolio/watchlist.json``.

Until the owner saves a list, it is the crypto the investment team's journal holds (or Bitcoin,
Ethereum and Solana when it holds none) — so the page is never empty and never asks for setup.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from hermes_constants import get_hermes_home

from plugins.portfolio.core import dashboard, journal, market

STARTER = ["BTC", "ETH", "SOL"]
MAX_SYMBOLS = 40
_SYMBOL = re.compile(r"^[A-Z0-9]{2,12}$")


def _file() -> Path:
    return get_hermes_home() / "portfolio" / "watchlist.json"


def clean(symbols: list) -> list[str]:
    """Upper-cased, valid and without repeats, in the order given; anything else is dropped."""
    seen: list[str] = []
    for raw in symbols:
        symbol = str(raw).strip().upper()
        if _SYMBOL.match(symbol) and symbol not in seen:
            seen.append(symbol)
    return seen[:MAX_SYMBOLS]


def from_journal() -> list[str]:
    journal_dir, _ = dashboard.settings()
    held = [t.symbol for t in journal.read_trades(journal_dir)
            if t.market.upper() in market.CRYPTO_MARKETS and not journal.is_cash(t.symbol)]
    return clean(held) or list(STARTER)


def load() -> dict:
    try:
        saved = clean(json.loads(_file().read_text(encoding="utf-8-sig")).get("symbols", []))
    except (OSError, ValueError, AttributeError):
        saved = []
    return {"symbols": saved or from_journal(), "saved": bool(saved)}


def save(symbols: list) -> dict:
    cleaned = clean(symbols)
    path = _file()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"symbols": cleaned}), encoding="utf-8")
    return {"symbols": cleaned or from_journal(), "saved": bool(cleaned)}
