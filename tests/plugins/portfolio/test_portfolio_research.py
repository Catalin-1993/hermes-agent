"""Research: the asset sheet's price-path numbers, and the team's reports read from their folder."""

import datetime as dt
import os
from pathlib import Path

import pytest

from plugins.portfolio.core import research, runtime


def _daily(closes: list[float], end: dt.date = dt.date(2026, 10, 20)) -> list[list]:
    start = end - dt.timedelta(days=len(closes) - 1)
    return [[(start + dt.timedelta(days=i)).isoformat(), close] for i, close in enumerate(closes)]


def test_returns_range_and_averages_come_from_the_closes():
    closes = [100.0 + i for i in range(400)]  # a steady climb: 100 → 499
    numbers = research.technicals(_daily(closes), "crypto")

    assert numbers["price"] == 499.0
    assert numbers["change"]["1w"] == pytest.approx((499 / 492 - 1) * 100)
    assert numbers["high_52w"] == 499.0 and numbers["low_52w"] == 135.0  # the last 365 days only
    assert numbers["from_high_pct"] == 0.0
    assert numbers["sma50"] == pytest.approx(sum(closes[-50:]) / 50)
    assert numbers["rsi14"] == 100.0  # nothing fell
    assert numbers["max_drawdown_pct"] == 0.0


def test_rsi_and_drawdown_read_a_fall():
    closes = [100.0] * 30 + [100.0 - 2 * i for i in range(1, 21)]  # flat, then down 40%
    numbers = research.technicals(_daily(closes), "stocks")

    assert numbers["rsi14"] == pytest.approx(0.0)
    assert numbers["max_drawdown_pct"] == pytest.approx(-40.0)
    assert numbers["sma200"] is None  # not enough history yet
    assert numbers["change"]["1y"] is None


def test_without_the_service_the_sheet_says_why_and_holds_no_numbers(monkeypatch):
    monkeypatch.setattr(runtime, "service", lambda: None)

    sheet = research.sheet("AAPL", "stocks")

    assert "technicals" not in sheet
    assert set(sheet["status"]) == {"env", "service", "error"}


def test_crypto_is_read_in_euros_and_stocks_get_their_profile(monkeypatch):
    asked = []
    monkeypatch.setattr(runtime, "service", lambda: {"port": 1, "token": "t"})
    monkeypatch.setattr(runtime, "fetch_history",
                        lambda info, symbols, start: asked.extend(symbols) or {symbols[0]: {"closes": _daily([1.0, 2.0])}})
    monkeypatch.setattr(runtime, "fetch_profile", lambda info, symbol: {"profile": {"name": "Apple"}, "metrics": {}})

    assert research.sheet("BTC", "crypto")["currency"] == "EUR"
    assert research.sheet("AAPL", "stocks")["profile"]["profile"]["name"] == "Apple"
    assert asked == ["BTC-EUR", "AAPL"]


@pytest.fixture
def research_dir(tmp_path: Path, monkeypatch) -> Path:
    journal = tmp_path / "investitii" / "jurnal"
    journal.mkdir(parents=True)
    monkeypatch.setattr("plugins.portfolio.core.dashboard.settings", lambda: (journal, 20_000.0))
    folder = tmp_path / "investitii" / "research"
    folder.mkdir()
    return folder


def test_reports_are_listed_newest_first_with_their_front_matter(research_dir):
    (research_dir / "2026-10-18-ETH-rapid.md").write_text("# ETH pe scurt\n\nText.", encoding="utf-8")
    (research_dir / "2026-10-20-BTC-complet.md").write_text(
        "---\ntitlu: Bitcoin, analiză completă\nsimbol: btc\nverdict: Păstrează\nautor: Analist cripto\n---\n# Ignorat\n",
        encoding="utf-8")
    (research_dir / "notite.txt").write_text("not a report", encoding="utf-8")
    os.utime(research_dir / "2026-10-18-ETH-rapid.md", (1_700_000_000, 1_700_000_000))

    listed = research.reports()["reports"]

    assert [r["name"] for r in listed] == ["2026-10-20-BTC-complet.md", "2026-10-18-ETH-rapid.md"]
    assert (listed[0]["title"], listed[0]["symbol"], listed[0]["verdict"]) == ("Bitcoin, analiză completă", "BTC", "Păstrează")
    assert (listed[1]["title"], listed[1]["date"]) == ("ETH pe scurt", "2026-10-18")
    assert research.report("2026-10-20-BTC-complet.md")["body"].startswith("# Ignorat")


def test_a_report_outside_the_folder_is_never_read(research_dir):
    (research_dir.parent / "secret.md").write_text("no", encoding="utf-8")

    for name in ("../secret.md", "..\\secret.md", "/etc/passwd.md", ".hidden.md", "secret.txt"):
        assert research.report(name) is None


def test_a_missing_folder_is_an_empty_list(tmp_path, monkeypatch):
    monkeypatch.setattr("plugins.portfolio.core.dashboard.settings", lambda: (tmp_path / "none" / "jurnal", 20_000.0))

    assert research.reports()["reports"] == []
