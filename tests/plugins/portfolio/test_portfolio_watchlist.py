"""The Watchlist's named lists: kept per profile, cleaned by kind, and never empty."""

import json
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
        "2026-10-19 09:00,A,Cash,Cash EUR,XETRA,CUMPARA,1000,1,EUR,1,1000,0,-,Numerar,APROBAT",
    ]) + "\n", encoding="utf-8")
    monkeypatch.setattr("plugins.portfolio.core.dashboard.settings", lambda: (directory, 20_000.0))
    return directory


def _symbols(state: dict) -> dict[str, list[str]]:
    return {entry["name"]: entry["symbols"] for entry in state["lists"]}


def test_before_anything_is_saved_the_journal_gives_a_crypto_and_a_stocks_list(journal_dir):
    state = watchlist.load()

    assert state["saved"] is False
    assert [(e["kind"], e["symbols"]) for e in state["lists"]] == [("crypto", ["BTC", "LINK"]), ("stocks", ["VWCE.DE"])]


def test_an_empty_journal_falls_back_to_well_known_names(tmp_path, monkeypatch):
    monkeypatch.setattr("plugins.portfolio.core.dashboard.settings", lambda: (tmp_path / "none", 20_000.0))

    assert [e["symbols"] for e in watchlist.load()["lists"]] == [["BTC", "ETH", "SOL"], ["VWCE.DE", "AAPL", "NVDA"]]


def test_owner_named_lists_are_cleaned_by_kind_and_survive_a_reload(journal_dir):
    saved = watchlist.save([
        {"id": "mine", "name": "  Tech   US ", "kind": "stocks", "symbols": ["aapl", "BRK-B", "^GSPC", "AAPL", "no spaces"]},
        {"id": "mine", "name": "", "kind": "crypto", "symbols": [" eth ", "BRK-B", "x"]},
        {"name": "Bad kind", "kind": "bonds", "symbols": ["SOL"]},
    ])

    assert _symbols(saved) == {"Tech US": ["AAPL", "BRK-B", "^GSPC"], "Cripto": ["ETH"], "Bad kind": ["SOL"]}
    assert [e["kind"] for e in saved["lists"]] == ["stocks", "crypto", "crypto"]
    assert len({e["id"] for e in saved["lists"]}) == 3  # a repeated or missing id is replaced
    assert watchlist.load() == saved


def test_the_one_list_file_of_stage_two_reads_as_a_crypto_list(journal_dir):
    path = watchlist._file()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"symbols": ["ETH", "SOL"]}), encoding="utf-8")

    assert watchlist.load() == {"lists": [{"id": "crypto", "name": "Cripto", "kind": "crypto", "symbols": ["ETH", "SOL"]}],
                                "saved": True}


def test_deleting_every_list_returns_to_the_journal_lists(journal_dir):
    watchlist.save([{"name": "Doar ETH", "kind": "crypto", "symbols": ["ETH"]}])

    assert watchlist.save([]) == {"lists": watchlist.from_journal(), "saved": False}
