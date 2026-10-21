"""The Watchlist: the owner's named lists of what they follow, kept per profile in
``<HERMES_HOME>/portfolio/watchlist.json``.

A list is crypto (priced live by Binance on the page) or stocks and ETFs (priced by the market-data
service). Until the owner saves anything there are two lists drawn from the investment team's
journal — its crypto, and its stocks and ETFs — or a few well-known names when it holds none, so the
page is never empty and never asks for setup. A file from before lists existed (``{"symbols": […]}``)
reads as one crypto list.
"""

from __future__ import annotations

import json
import re
import secrets
from pathlib import Path

from hermes_constants import get_hermes_home

from plugins.portfolio.core import dashboard, journal, market

KINDS = ("crypto", "stocks")
STARTER = {"crypto": ["BTC", "ETH", "SOL"], "stocks": ["VWCE.DE", "AAPL", "NVDA"]}
DEFAULT_NAMES = {"crypto": "Cripto", "stocks": "Acțiuni și ETF-uri"}
MAX_LISTS = 20
MAX_SYMBOLS = 40
MAX_NAME = 40
_SYMBOL = {"crypto": re.compile(r"^[A-Z0-9]{2,12}$"), "stocks": re.compile(r"^[A-Z0-9^][A-Z0-9.\-=^]{0,14}$")}
_ID = re.compile(r"^[a-z0-9-]{1,32}$")


def _file() -> Path:
    return get_hermes_home() / "portfolio" / "watchlist.json"


def clean_symbols(symbols: list, kind: str = "crypto") -> list[str]:
    """Upper-cased, valid for the list's kind and without repeats, in the order given."""
    seen: list[str] = []
    for raw in symbols:
        symbol = str(raw).strip().upper()
        if _SYMBOL[kind].match(symbol) and symbol not in seen:
            seen.append(symbol)
    return seen[:MAX_SYMBOLS]


def _clean_list(raw: dict, taken: set[str]) -> dict | None:
    if not isinstance(raw, dict):
        return None
    kind = raw.get("kind") if raw.get("kind") in KINDS else "crypto"
    name = " ".join(str(raw.get("name") or "").split())[:MAX_NAME] or DEFAULT_NAMES[kind]
    list_id = str(raw.get("id") or "")
    if not _ID.match(list_id) or list_id in taken:
        list_id = secrets.token_hex(4)
    return {"id": list_id, "name": name, "kind": kind, "symbols": clean_symbols(raw.get("symbols") or [], kind)}


def clean_lists(raw_lists: list) -> list[dict]:
    lists: list[dict] = []
    for raw in raw_lists[:MAX_LISTS]:
        cleaned = _clean_list(raw, {entry["id"] for entry in lists})
        if cleaned:
            lists.append(cleaned)
    return lists


def from_journal() -> list[dict]:
    """The two starting lists: what the journal holds, split into crypto and the rest."""
    journal_dir, _ = dashboard.settings()
    trades = [t for t in journal.read_trades(journal_dir) if not journal.is_cash(t.symbol)]
    crypto = [t.symbol for t in trades if t.market.upper() in market.CRYPTO_MARKETS]
    stocks = [market.provider_symbol(t.symbol, t.market) for t in trades if t.market.upper() not in market.CRYPTO_MARKETS]
    return [{"id": kind, "name": DEFAULT_NAMES[kind], "kind": kind,
             "symbols": clean_symbols(found, kind) or list(STARTER[kind])}
            for kind, found in (("crypto", crypto), ("stocks", stocks))]


def _read() -> list[dict]:
    try:
        stored = json.loads(_file().read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return []
    if isinstance(stored, dict) and isinstance(stored.get("lists"), list):
        return clean_lists(stored["lists"])
    if isinstance(stored, dict) and isinstance(stored.get("symbols"), list):  # the one-list file of stage 2
        return clean_lists([{"id": "crypto", "name": DEFAULT_NAMES["crypto"], "kind": "crypto",
                             "symbols": stored["symbols"]}])
    return []


def load() -> dict:
    saved = _read()
    return {"lists": saved or from_journal(), "saved": bool(saved)}


def save(raw_lists: list) -> dict:
    """Replaces every list. Saving none returns to the journal's starting lists."""
    lists = clean_lists(raw_lists)
    path = _file()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"lists": lists}, ensure_ascii=False), encoding="utf-8")
    return {"lists": lists or from_journal(), "saved": bool(lists)}
