"""The market-data service's answers, with the provider replaced by a fixed frame."""

import datetime as dt
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def hour(h: int) -> dt.datetime:
    return dt.datetime(2026, 10, 20, h, tzinfo=dt.UTC)


SERVICE_DIR = Path(__file__).resolve().parents[3] / "plugins" / "portfolio" / "service"


class _Frame:
    """The two things the service reads from a provider frame: its rows, and each row by column."""

    def __init__(self, rows):
        self.rows = rows

    def iterrows(self):
        return iter(self.rows)


class _Prices:
    def __init__(self, frame):
        self.frame, self.calls = frame, []

    def historical(self, symbol, **kwargs):
        self.calls.append((symbol, kwargs))
        return type("Result", (), {"to_df": lambda _self: self.frame})()


@pytest.fixture
def service(monkeypatch):
    monkeypatch.syspath_prepend(str(SERVICE_DIR))
    from portfolio_service import app as module

    frame = _Frame([
        (hour(9), {"open": 10.0, "high": 12.0, "low": 9.0, "close": 11.0, "volume": 100.0}),
        (hour(10), {"open": 11.0, "high": 13.0, "low": 10.5, "close": 12.5, "volume": float("nan")}),
        (hour(11), {"open": float("nan"), "high": 1.0, "low": 1.0, "close": 1.0, "volume": 5.0}),  # incomplete
    ])
    prices = _Prices(frame)
    monkeypatch.setattr(module, "_obb", type("Obb", (), {"equity": type("Equity", (), {"price": prices})()})())
    monkeypatch.setattr(module, "_warm", True)
    module._cache.clear()
    monkeypatch.setenv("PORTFOLIO_SERVICE_TOKEN", "secret")
    return TestClient(module.app), prices


def test_bars_come_at_the_asked_interval_in_epoch_seconds_without_incomplete_rows(service):
    client, prices = service

    answer = client.get("/bars", params={"symbol": "AAPL", "interval": "1h"}, headers={"X-Portfolio-Token": "secret"}).json()

    nine, ten = int(hour(9).timestamp()), int(hour(10).timestamp())
    assert answer["bars"] == [[nine, 10.0, 12.0, 9.0, 11.0, 100.0], [ten, 11.0, 13.0, 10.5, 12.5, 0.0]]
    assert prices.calls[0][1]["interval"] == "1h"


def test_an_interval_the_chart_does_not_offer_is_refused(service):
    client, _ = service

    response = client.get("/bars", params={"symbol": "AAPL", "interval": "2m"}, headers={"X-Portfolio-Token": "secret"})

    assert response.status_code == 400


def test_every_request_needs_the_launching_backends_token(service):
    client, _ = service

    assert client.get("/bars", params={"symbol": "AAPL"}).status_code == 401
