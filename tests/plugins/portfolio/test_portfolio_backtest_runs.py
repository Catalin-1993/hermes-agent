"""Backtest runs on the Hermes side: the request cleaned and sent to the service, the run kept per
profile, and only a run's own id ever reads or deletes a file."""

import pytest

from plugins.portfolio.core import backtest, runtime


@pytest.fixture
def service(monkeypatch):
    sent = []

    def fake_run(info, request):
        sent.append(request)
        return {"result": {"stats": {"total_return_pct": 12.5}, "curve": [], "trades": []},
                "benchmark": {"stats": {"total_return_pct": 20.0}, "curve": [], "trades": []}}

    monkeypatch.setattr(runtime, "service", lambda: {"port": 1, "token": "t"})
    monkeypatch.setattr(runtime, "run_backtest", fake_run)
    return sent


def test_a_run_is_sent_with_the_provider_symbol_and_kept(service):
    record = backtest.run({"symbol": "btc", "kind": "crypto", "strategy": "macd", "years": 5,
                           "params": {"fast": 20, "slow": "x"}, "capital": 5000,
                           "execution": {"stop_loss_pct": 8, "trailing_pct": "x", "timeframe": "1w", "evil": 1}})

    assert service[0]["provider_symbol"] == "BTC-EUR" and service[0]["currency"] == "EUR"
    assert service[0]["params"] == {"fast": 20}  # a non-number parameter is dropped
    assert service[0]["execution"] == {"stop_loss_pct": 8.0, "timeframe": "1w"}
    listed = backtest.runs()["runs"]
    assert [(r["id"], r["return_pct"], r["benchmark_pct"]) for r in listed] == [(record["id"], 12.5, 20.0)]
    assert backtest.get(record["id"])["request"]["years"] == 5


def test_an_unknown_strategy_or_period_never_reaches_the_service(service):
    assert backtest.run({"symbol": "AAPL", "strategy": "martingale"}) == {"error": "invalid"}
    assert backtest.run({"symbol": "AAPL", "strategy": "breakout", "years": 7})["request"]["years"] == 3
    assert len(service) == 1


def test_without_the_service_the_answer_says_so(monkeypatch):
    monkeypatch.setattr(runtime, "service", lambda: None)

    assert backtest.run({"symbol": "AAPL", "strategy": "breakout"})["error"] == "service"


def test_only_a_runs_own_id_reads_or_deletes_a_file(service):
    record = backtest.run({"symbol": "AAPL", "strategy": "breakout"})
    secret = backtest._folder().parent / "secret.json"
    secret.write_text("{}", encoding="utf-8")

    for bad in ("../secret", "..%2Fsecret", "secret", ""):
        assert backtest.get(bad) is None and backtest.delete(bad) is False
    assert secret.exists()
    assert backtest.delete(record["id"]) is True and backtest.runs()["runs"] == []


def test_only_the_newest_runs_are_kept(service, monkeypatch):
    monkeypatch.setattr(backtest, "KEEP", 2)
    folder = backtest._folder()
    folder.mkdir(parents=True, exist_ok=True)
    for stamp in ("20260101-000000", "20260102-000000", "20260103-000000"):
        (folder / f"{stamp}-AAPL-breakout.json").write_text('{"id": "x"}', encoding="utf-8")

    backtest.run({"symbol": "AAPL", "strategy": "breakout"})

    assert len(list(folder.glob("*.json"))) == 2
