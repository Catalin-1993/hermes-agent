"""Price alerts: kept per profile, checked by a no-model cron job that exists only while an alert
waits, and fired once with a plain message. Real cron store, against the test's own HERMES_HOME."""

import importlib.util
import json
from pathlib import Path

import pytest

from hermes_constants import get_hermes_home
from plugins.portfolio.core import alerts

SCRIPT = Path(alerts.__file__).resolve().parents[1] / "scripts" / "portfolio_alerts.py"


def _script():
    spec = importlib.util.spec_from_file_location("portfolio_alerts_under_test", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _jobs():
    from cron.jobs import list_jobs

    return [job for job in list_jobs(include_disabled=True) if job.get("name") == alerts.JOB_NAME]


def test_the_check_is_scheduled_while_an_alert_waits_and_removed_after():
    state = alerts.add({"symbol": "btc", "kind": "crypto", "op": "above", "price": 70000, "note": " ia profit "})

    alert, = state["alerts"]
    assert (alert["symbol"], alert["currency"], alert["note"], alert["active"]) == ("BTC", "USDT", "ia profit", True)
    assert state["scheduled"] is True
    job, = _jobs()
    assert (job["no_agent"], job["script"], job["deliver"]) == (True, alerts.SCRIPT_NAME, "origin")
    assert (get_hermes_home() / "scripts" / alerts.SCRIPT_NAME).read_bytes() == SCRIPT.read_bytes()

    alerts.add({"symbol": "AAPL", "kind": "stocks", "op": "below", "price": 150})
    assert len(_jobs()) == 1  # one check for every alert

    for waiting in alerts.load()["alerts"]:
        state = alerts.remove(waiting["id"])
    assert state["alerts"] == [] and state["scheduled"] is False
    assert _jobs() == []


@pytest.mark.parametrize("raw", [
    {"symbol": "BTC", "kind": "crypto", "op": "sideways", "price": 1},
    {"symbol": "BTC", "kind": "crypto", "op": "above", "price": -5},
    {"symbol": "BTC", "kind": "bonds", "op": "above", "price": 5},
    {"symbol": "not a symbol!", "kind": "crypto", "op": "above", "price": 5},
    {"symbol": "BTC", "kind": "crypto", "op": "above", "price": "x"},
])
def test_an_alert_the_page_cannot_mean_is_refused_and_nothing_is_scheduled(raw):
    assert alerts.add(raw)["error"] == "invalid"
    assert _jobs() == []


def _alerts_file(entries):
    path = get_hermes_home() / "portfolio" / "alerts.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"alerts": entries}), encoding="utf-8")
    return path


def _alert(alert_id, symbol, op, price, kind="crypto", **extra):
    return {"id": alert_id, "symbol": symbol, "kind": kind, "op": op, "price": price, "currency": "USDT",
            "active": True, **extra}


def test_a_check_fires_each_reached_alert_once_and_keeps_the_others(monkeypatch):
    script = _script()
    path = _alerts_file([
        _alert("up", "BTC", "above", 70000, note="ia profit"),
        _alert("down", "ETH", "below", 2000),
        _alert("later", "BTC", "above", 90000),
        _alert("gone", "SOL", "below", 100),
    ])
    monkeypatch.setitem(script.PRICERS, "crypto", {"BTC": 70215.4, "ETH": 2500.0}.get)

    lines = script.check(path)

    assert lines == ["🔔 Alertă de preț: BTC a urcat peste 70.000,00 USDT — acum 70.215,40 USDT. Notă: ia profit"]
    stored = {a["id"]: a for a in json.loads(path.read_text(encoding="utf-8"))["alerts"]}
    assert stored["up"]["active"] is False and stored["up"]["triggered_price"] == 70215.4
    assert all(stored[key]["active"] for key in ("down", "later", "gone"))
    assert json.loads(path.read_text(encoding="utf-8"))["unpriced"] == ["SOL"]
    assert script.check(path) == []  # fired once: the next round has nothing to say


def test_a_price_source_that_fails_is_skipped_quietly(monkeypatch):
    script = _script()
    path = _alerts_file([_alert("a", "BTC", "above", 1)])

    def broken(_symbol):
        raise OSError("network down")

    monkeypatch.setitem(script.PRICERS, "crypto", broken)

    assert script.check(path) == []
    assert json.loads(path.read_text(encoding="utf-8"))["alerts"][0]["active"] is True


def test_the_cron_job_runs_the_installed_check_and_a_quiet_round_sends_nothing():
    from cron.scheduler import SILENT_MARKER, _run_no_agent_job

    alerts.add({"symbol": "BTC", "kind": "crypto", "op": "above", "price": 70000})
    job, = _jobs()
    # Nothing waiting by the time the job fires (the owner deleted it in between): a quiet round.
    data = json.loads((get_hermes_home() / "portfolio" / "alerts.json").read_text(encoding="utf-8"))
    for alert in data["alerts"]:
        alert["active"] = False
    (get_hermes_home() / "portfolio" / "alerts.json").write_text(json.dumps(data), encoding="utf-8")

    ok, _doc, delivered, error = _run_no_agent_job(job, job["id"], job["name"], None)

    assert (ok, delivered, error) == (True, SILENT_MARKER, None)
    assert json.loads((get_hermes_home() / "portfolio" / "alerts.json").read_text(encoding="utf-8"))["checked_at"]


def test_prices_are_read_from_the_binance_and_yahoo_answers(monkeypatch):
    script = _script()
    answers = {
        "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT": {"symbol": "BTCUSDT", "price": "67012.50"},
        "https://query1.finance.yahoo.com/v8/finance/chart/VWCE.DE?interval=1m&range=1d":
            {"chart": {"result": [{"meta": {"currency": "EUR", "regularMarketPrice": 141.32}}], "error": None}},
        "https://api.binance.com/api/v3/ticker/price?symbol=NOPEUSDT": {"code": -1121, "msg": "Invalid symbol."},
    }
    monkeypatch.setattr(script, "_get_json", answers.__getitem__)

    assert script.crypto_price("BTC") == 67012.5
    assert script.stock_price("VWCE.DE") == 141.32
    assert script.crypto_price("NOPE") is None
