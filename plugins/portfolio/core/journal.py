"""The simulated portfolio's journal, read into positions.

The investment team keeps the portfolio as plain files (skill ``portofoliu-simulat``); the
transactions CSV is the record everything else is derived from, so positions, cost and cash are
rebuilt from it rather than trusted from the agents' summary tables. Models write that CSV by hand,
so a free-text field holding an unquoted comma (``motiv``) is tolerated: the fixed columns are read
by position from the left, the risk verdict is the last field, and whatever sits between is the
reason.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

TRANSACTIONS_FILE = "tranzactii.csv"

# Columns 0–12, in the order the skill defines them; the reason and the risk verdict follow.
_FIXED = ("data_ora", "varianta", "activ", "simbol", "piata", "actiune", "cantitate", "pret", "moneda",
          "curs_eur", "valoare_eur", "comision_eur", "sursa_pret")
_SELL = {"VINDE", "VANZARE", "SELL"}
_CASH_SYMBOLS = {"CASH", "CASH EUR", "EUR", "NUMERAR"}


@dataclass
class Trade:
    when: str
    variant: str
    name: str
    symbol: str
    market: str
    sell: bool
    quantity: float
    value_eur: float
    fee_eur: float
    reason: str
    risk_verdict: str


@dataclass
class Position:
    name: str
    symbol: str
    market: str
    quantity: float = 0.0
    cost_eur: float = 0.0

    @property
    def average_eur(self) -> float:
        return self.cost_eur / self.quantity if self.quantity else 0.0


@dataclass
class Book:
    """One variant of the portfolio: its open positions, cash, and the trades behind them."""

    variant: str
    capital_eur: float
    positions: dict[str, Position] = field(default_factory=dict)
    cash_eur: float = 0.0
    fees_eur: float = 0.0
    started: str = ""
    trades: list[Trade] = field(default_factory=list)
    unverified: int = 0


def _number(raw: str) -> float:
    text = (raw or "").strip().replace(" ", "")
    if "," in text and "." not in text:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def is_cash(symbol: str) -> bool:
    return symbol.strip().upper() in _CASH_SYMBOLS


def read_trades(journal_dir: Path) -> list[Trade]:
    """Every row of the transactions file; an absent file is an empty journal."""
    path = journal_dir / TRANSACTIONS_FILE
    if not path.is_file():
        return []
    trades = []
    with path.open(encoding="utf-8", newline="") as handle:
        rows = csv.reader(handle)
        next(rows, None)  # header
        for fields in rows:
            if len(fields) < len(_FIXED) + 1 or not fields[0].strip():
                continue
            row = dict(zip(_FIXED, fields))
            trades.append(Trade(
                when=row["data_ora"].strip(), variant=row["varianta"].strip().upper(),
                name=row["activ"].strip(), symbol=row["simbol"].strip(), market=row["piata"].strip(),
                sell=row["actiune"].strip().upper() in _SELL,
                quantity=abs(_number(row["cantitate"])), value_eur=abs(_number(row["valoare_eur"])),
                fee_eur=abs(_number(row["comision_eur"])),
                reason=",".join(fields[len(_FIXED):-1]).strip(),
                risk_verdict=fields[-1].strip() if len(fields) > len(_FIXED) + 1 else ""))
    return trades


def build_book(trades: list[Trade], variant: str, capital_eur: float) -> Book:
    """The variant's positions and cash: capital, less what was bought and its fees, plus what was sold.
    A cash row (the skill's ``Cash EUR``) only says the money stayed cash, so it moves nothing."""
    book = Book(variant=variant, capital_eur=capital_eur, cash_eur=capital_eur)
    for trade in (t for t in trades if t.variant == variant):
        book.trades.append(trade)
        book.started = book.started or trade.when[:10]
        if not trade.risk_verdict.upper().startswith("APROBAT"):
            book.unverified += 1
        book.fees_eur += trade.fee_eur
        book.cash_eur -= trade.fee_eur
        if is_cash(trade.symbol):
            continue
        position = book.positions.setdefault(trade.symbol, Position(trade.name, trade.symbol, trade.market))
        if trade.sell:
            share = min(1.0, trade.quantity / position.quantity) if position.quantity else 0.0
            position.cost_eur -= position.cost_eur * share
            position.quantity = max(0.0, position.quantity - trade.quantity)
            book.cash_eur += trade.value_eur
        else:
            position.quantity += trade.quantity
            position.cost_eur += trade.value_eur
            book.cash_eur -= trade.value_eur
    book.positions = {symbol: p for symbol, p in book.positions.items() if p.quantity > 1e-12}
    return book


def variants(trades: list[Trade]) -> list[str]:
    return sorted({t.variant for t in trades if t.variant})
