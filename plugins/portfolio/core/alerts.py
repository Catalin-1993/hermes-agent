"""Price alerts: "tell me when BTC reaches 70,000". Kept per profile in
``<HERMES_HOME>/portfolio/alerts.json``, checked by a Hermes cron job that needs no model.

While any alert is waiting, one cron job ("Portofoliu: alerte de preț") runs
``<HERMES_HOME>/scripts/portfolio_alerts.py`` every few minutes (``no_agent``: a script, no tokens). The
script prices the symbols, marks the alerts reached and prints a line for each; cron delivers those lines
to the owner's main channel (``deliver=origin`` falls back to the home channel, e.g. Telegram, and stays
local when there is none). It runs wherever Hermes's scheduler runs: the gateway, or the app's backend
while the app is open. With no alert left waiting, the job is removed, so nothing runs for nothing.

An alert fires once: reached, it stays in the list as reached until the owner deletes it.
"""

from __future__ import annotations

import datetime as dt
import json
import secrets
import shutil
from pathlib import Path
from typing import Optional

from hermes_constants import get_hermes_home

from plugins.portfolio.core import market
from plugins.portfolio.core.watchlist import KINDS, clean_symbols

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "portfolio_alerts.py"
SCRIPT_NAME = "portfolio_alerts.py"
JOB_NAME = "Portofoliu: alerte de preț"
SCHEDULE = "every 5m"
EVERY_MINUTES = 5
MAX_ALERTS = 50
MAX_NOTE = 120
OPS = ("above", "below")


def _file() -> Path:
    return get_hermes_home() / "portfolio" / "alerts.json"


def _read() -> dict:
    try:
        stored = json.loads(_file().read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return {"alerts": []}
    if not isinstance(stored, dict) or not isinstance(stored.get("alerts"), list):
        return {"alerts": []}
    stored["alerts"] = [a for a in stored["alerts"] if isinstance(a, dict) and a.get("id")]
    return stored


def _write(data: dict) -> None:
    path = _file()
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".json.tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    temp.replace(path)


def clean_alert(raw: dict) -> Optional[dict]:
    """A new alert from the page, or None when it names no valid symbol, direction or price."""
    if not isinstance(raw, dict):
        return None
    kind = raw.get("kind") if raw.get("kind") in KINDS else None
    symbols = clean_symbols([raw.get("symbol")], kind) if kind else []
    try:
        price = float(raw.get("price"))
    except (TypeError, ValueError):
        return None
    if not symbols or raw.get("op") not in OPS or not 0 < price < 1e12:
        return None
    symbol = symbols[0]
    return {
        "id": secrets.token_hex(4),
        "symbol": symbol,
        "kind": kind,
        "op": raw["op"],
        "price": price,
        "currency": "USDT" if kind == "crypto" else market.quote_currency(symbol, ""),
        "note": " ".join(str(raw.get("note") or "").split())[:MAX_NOTE],
        "created": dt.datetime.now().isoformat(timespec="seconds"),
        "active": True,
        "triggered_at": None,
        "triggered_price": None,
    }


def _job() -> Optional[dict]:
    from cron.jobs import get_job, list_jobs

    job_id = _read().get("job_id")
    job = get_job(job_id) if job_id else None
    # A job id lost with an older alerts file: find the job by its name rather than make a second one.
    return job or next((j for j in list_jobs(include_disabled=True) if j.get("name") == JOB_NAME), None)


def _install_script() -> None:
    target = get_hermes_home() / "scripts" / SCRIPT_NAME
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.is_file() or target.read_bytes() != SCRIPT.read_bytes():
        shutil.copyfile(SCRIPT, target)


def sync_job(data: dict) -> dict:
    """Schedule the check while any alert waits, and remove it when none does. Returns ``data`` with
    the job's id (or none), for the caller to save."""
    from cron.jobs import create_job, remove_job

    waiting = any(alert.get("active") for alert in data["alerts"])
    job = _job()
    if waiting:
        _install_script()  # every time: an update of Hermes may bring a newer check
        if job is None:
            job = create_job(prompt=None, schedule=SCHEDULE, name=JOB_NAME, script=SCRIPT_NAME, no_agent=True,
                             deliver="origin")
        data["job_id"] = job["id"]
    else:
        if job is not None:
            remove_job(job["id"])
        data["job_id"] = None
    return data


def load() -> dict:
    data = _read()
    job = _job() if data.get("job_id") else None
    return {
        "alerts": data["alerts"],
        "checked_at": data.get("checked_at"),
        "unpriced": data.get("unpriced") or [],
        "scheduled": job is not None and bool(job.get("enabled", True)),
        "every_minutes": EVERY_MINUTES,
    }


def add(raw: dict) -> dict:
    alert = clean_alert(raw)
    if alert is None:
        return {**load(), "error": "invalid"}
    data = _read()
    if len(data["alerts"]) >= MAX_ALERTS:
        return {**load(), "error": "too_many"}
    data["alerts"].append(alert)
    _write(sync_job(data))
    return load()


def remove(alert_id: str) -> dict:
    data = _read()
    data["alerts"] = [a for a in data["alerts"] if a.get("id") != alert_id]
    _write(sync_job(data))
    return load()
