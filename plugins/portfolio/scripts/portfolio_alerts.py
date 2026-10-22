"""Price alerts check — a Hermes cron script (``no_agent``: no model, no tokens).

The Portfolio plugin copies this file to ``<HERMES_HOME>/scripts/portfolio_alerts.py`` and schedules it
while any alert is waiting. Each run reads ``<HERMES_HOME>/portfolio/alerts.json``, prices the symbols
that have an alert (crypto from Binance in USDT, stocks and ETFs from Yahoo Finance in their listing's
currency), marks every alert whose level was reached, and prints one line per alert reached. Cron
delivers what is printed; nothing printed means nothing to say, so a quiet run sends nothing.

Standard library only, so it runs on Hermes's own Python whether or not the market-data service is
installed or running. A price that cannot be read is skipped and retried on the next run, so a network
hiccup never turns into an error message.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

_TIMEOUT_S = 10
_HEADERS = {"User-Agent": "Mozilla/5.0 (Hermes portfolio alerts)"}


def _alerts_file() -> Path:
    # <HERMES_HOME>/scripts/portfolio_alerts.py → <HERMES_HOME>/portfolio/alerts.json
    return Path(__file__).resolve().parents[1] / "portfolio" / "alerts.json"


def _read(path: Path) -> dict:
    try:
        stored = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return {}
    return stored if isinstance(stored, dict) else {}


def _write(path: Path, data: dict) -> None:
    handle, temp = tempfile.mkstemp(dir=path.parent, prefix=".alerts-", suffix=".json")
    with os.fdopen(handle, "w", encoding="utf-8") as out:
        json.dump(data, out, ensure_ascii=False, indent=1)
    os.replace(temp, path)


def _get_json(url: str):
    request = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(request, timeout=_TIMEOUT_S) as answer:
        return json.loads(answer.read().decode("utf-8"))


def crypto_price(symbol: str) -> float | None:
    answer = _get_json(f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}USDT")
    return float(answer["price"]) if isinstance(answer, dict) and "price" in answer else None


def stock_price(symbol: str) -> float | None:
    quoted = urllib.parse.quote(symbol)
    answer = _get_json(f"https://query1.finance.yahoo.com/v8/finance/chart/{quoted}?interval=1m&range=1d")
    meta = ((answer.get("chart") or {}).get("result") or [{}])[0].get("meta") or {}
    price = meta.get("regularMarketPrice")
    return float(price) if isinstance(price, (int, float)) else None


PRICERS = {"crypto": crypto_price, "stocks": stock_price}


def prices(alerts: list[dict]) -> dict[tuple[str, str], float]:
    """The current price of every symbol that has a waiting alert; a price that cannot be read is absent."""
    found: dict[tuple[str, str], float] = {}
    for key in {(a["kind"], a["symbol"]) for a in alerts}:
        try:
            price = PRICERS[key[0]](key[1])
        # A network hiccup or an answer of an unexpected shape skips this symbol until the next run.
        except (OSError, ValueError, KeyError, IndexError, TypeError, AttributeError):
            continue
        if price is not None and price > 0:
            found[key] = price
    return found


def reached(alert: dict, price: float) -> bool:
    return price >= alert["price"] if alert["op"] == "above" else price <= alert["price"]


def money(value: float) -> str:
    """Romanian style: 70.215,40 — more decimals for prices under 1."""
    digits = 2 if value >= 1 else 6
    text = f"{value:,.{digits}f}".replace(",", " ").replace(".", ",").replace(" ", ".")
    return text.rstrip("0").rstrip(",") if value < 1 else text


def message(alert: dict, price: float) -> str:
    currency = alert.get("currency") or ""
    unit = f" {currency}" if currency else ""
    verb = "a urcat peste" if alert["op"] == "above" else "a coborât sub"
    line = f"🔔 Alertă de preț: {alert['symbol']} {verb} {money(alert['price'])}{unit} — acum {money(price)}{unit}."
    return f"{line} Notă: {alert['note']}" if alert.get("note") else line


def check(path: Path) -> list[str]:
    """One round: price the waiting alerts, mark those reached, and return their messages."""
    waiting = [a for a in _read(path).get("alerts") or [] if isinstance(a, dict) and a.get("active")]
    found = prices(waiting)
    now = dt.datetime.now().isoformat(timespec="seconds")
    hits = {a["id"]: found[(a["kind"], a["symbol"])] for a in waiting
            if (a["kind"], a["symbol"]) in found and reached(a, found[(a["kind"], a["symbol"])])}
    # Read again just before writing: the owner may have added or removed an alert while prices loaded.
    data = _read(path)
    lines = []
    for alert in data.get("alerts") or []:
        if isinstance(alert, dict) and alert.get("active") and alert.get("id") in hits:
            price = hits[alert["id"]]
            alert.update(active=False, triggered_at=now, triggered_price=price)
            lines.append(message(alert, price))
    data["checked_at"] = now
    data["unpriced"] = sorted({a["symbol"] for a in waiting} - {symbol for _, symbol in found})
    if path.parent.is_dir():
        _write(path, data)
    return lines


def main() -> int:
    try:
        lines = check(_alerts_file())
    except OSError as exc:  # the alerts file could not be written: say so in the job log, retry next run
        print(f"portfolio alerts: check skipped ({exc})", file=sys.stderr)
        return 0
    if lines:
        print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
