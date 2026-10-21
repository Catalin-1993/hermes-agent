"""The Watchlist's saved coins: kept per profile, cleaned, and never empty."""

from pathlib import Path

import pytest

from plugins.portfolio.core import watchlist
from tests.plugins.portfolio.test_portfolio_valuation import HEADER


@pytest.fixture
def journal_dir(tmp_path: Path, monkeypatch) -> Path:
    directory = tmp_path / "jurnal"
    directory.mkdir()
    (directory / "tranzactii.csv").write_text(HEADER + "\n".join([
        "2026-10-19 09:00,A,Bitcoin,BTC,CCC,CUMPARA,0.01,72000,EUR,1,720,0,Yahoo,Cripto,APROBAT",
        "2026-10-19 09:00,A,Chainlink,link,CCC,CUMPARA,10,20,EUR,1,200,0,Yahoo,Cripto,APROBAT",
        "2026-10-19 09:00,A,Vanguard,VWCE.DE,XETRA,CUMPARA,5,170,EUR,1,850,0,Yahoo,Alocare,APROBAT",
    ]) + "\n", encoding="utf-8")
    monkeypatch.setattr("plugins.portfolio.core.dashboard.settings", lambda: (directory, 20_000.0))
    return directory


def test_before_anything_is_saved_the_list_is_the_crypto_the_journal_holds(journal_dir):
    assert watchlist.load() == {"symbols": ["BTC", "LINK"], "saved": False}


def test_an_empty_journal_falls_back_to_the_starter_coins(tmp_path, monkeypatch):
    monkeypatch.setattr("plugins.portfolio.core.dashboard.settings", lambda: (tmp_path / "none", 20_000.0))

    assert watchlist.load()["symbols"] == ["BTC", "ETH", "SOL"]


def test_a_saved_list_is_cleaned_and_survives_a_reload(journal_dir):
    saved = watchlist.save([" eth ", "SOL", "eth", "bad symbol!", "", "x"])

    assert saved == {"symbols": ["ETH", "SOL"], "saved": True}
    assert watchlist.load() == saved


def test_emptying_the_list_returns_to_the_journal_default(journal_dir):
    watchlist.save(["ETH"])

    assert watchlist.save([]) == {"symbols": ["BTC", "LINK"], "saved": False}
