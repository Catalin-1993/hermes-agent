"""The Portfolio dashboard's numbers: positions rebuilt from the journal, priced in euros."""

from pathlib import Path

import pytest

from plugins.portfolio.core import journal, market

HEADER = ("data_ora,varianta,activ,simbol,piata,actiune,cantitate,pret,moneda,curs_eur,valoare_eur,"
          "comision_eur,sursa_pret,motiv,verdict_risc\n")


@pytest.fixture
def journal_dir(tmp_path: Path) -> Path:
    # Real shapes from the team's journal: an unquoted comma in the reason (2,5%), a BVB share in
    # RON, crypto, the skill's "Cash EUR" row, and a later sale.
    (tmp_path / "tranzactii.csv").write_text(HEADER + "\n".join([
        "2026-10-19 09:00,A,Vanguard FTSE All-World,VWCE.DE,XETRA,CUMPARA,50,170,EUR,1,8500,8.5,Yahoo,Alocare (45%),APROBAT",
        "2026-10-19 09:00,A,Banca Transilvania,TLV.RO,BVB,CUMPARA,100,6.8,EUR,1,680,0,Yahoo,Alocare (2,5% BVB),APROBAT",
        "2026-10-19 09:00,A,Bitcoin,BTC,CCC,CUMPARA,0.01,72000,EUR,1,720,0,Yahoo,Cripto,",
        "2026-10-19 09:00,A,Cash,Cash EUR,XETRA,CUMPARA,1000,1,EUR,1,1000,0,-,Numerar,APROBAT",
        "2026-10-21 10:00,A,Vanguard FTSE All-World,VWCE.DE,XETRA,VINDE,10,171,EUR,1,1710,1.7,Yahoo,Rebalansare,APROBAT",
    ]) + "\n", encoding="utf-8")
    return tmp_path


def test_positions_and_cash_are_rebuilt_from_the_trades(journal_dir):
    book = journal.build_book(journal.read_trades(journal_dir), "A", 20_000)

    assert set(book.positions) == {"VWCE.DE", "TLV.RO", "BTC"}
    assert book.positions["VWCE.DE"].quantity == pytest.approx(40)
    assert book.positions["VWCE.DE"].cost_eur == pytest.approx(8500 * 0.8)
    # 20 000 − 8 500 − 680 − 720 + 1 710 − fees (8.5 + 1.7); the cash row moves nothing.
    assert book.cash_eur == pytest.approx(20_000 - 8_500 - 680 - 720 + 1_710 - 10.2)
    assert book.unverified == 1  # the crypto row carries no risk verdict
    assert journal.read_trades(journal_dir)[1].reason == "Alocare (2,5% BVB)"


def test_prices_reach_euros_through_the_listing_currency(journal_dir):
    book = journal.build_book(journal.read_trades(journal_dir), "A", 20_000)
    quotes = {"VWCE.DE": {"last": 172.0, "prev": 171.0}, "TLV.RO": {"last": 36.6, "prev": 36.4},
              "BTC-EUR": {"last": 74_000.0, "prev": 73_000.0}}
    priced = {p.symbol: p for p in market.price_book(book, quotes, {"EURRON=X": 5.0})}

    assert priced["TLV.RO"].price_eur == pytest.approx(36.6 / 5.0)
    assert priced["BTC"].value_eur == pytest.approx(740.0)
    assert priced["VWCE.DE"].day_change_eur == pytest.approx(40.0)
    assert {p.source for p in priced.values()} == {"piață"}


def test_a_position_the_market_cannot_price_keeps_its_cost_and_says_so(journal_dir):
    book = journal.build_book(journal.read_trades(journal_dir), "A", 20_000)
    priced = {p.symbol: p for p in market.price_book(book, {}, {})}

    assert priced["TLV.RO"].source == "jurnal"
    assert priced["TLV.RO"].value_eur == pytest.approx(680.0)


def test_the_value_history_replays_the_sale_on_its_day(journal_dir):
    book = journal.build_book(journal.read_trades(journal_dir), "A", 20_000)
    closes = {"VWCE.DE": [["2026-10-19", 170.0], ["2026-10-20", 170.0], ["2026-10-21", 171.0]],
              "TLV.RO": [["2026-10-19", 34.0], ["2026-10-21", 34.0]], "BTC-EUR": [["2026-10-19", 72_000.0]]}
    history = market.value_history(book, closes, {"EURRON=X": [["2026-10-19", 5.0]]})

    assert [row["date"] for row in history] == ["2026-10-19", "2026-10-20", "2026-10-21"]
    cash_before = 20_000 - 8_500 - 680 - 720 - 8.5
    assert history[0]["value"] == pytest.approx(cash_before + 50 * 170 + 100 * 34 / 5 + 720, abs=0.01)
    assert history[2]["value"] == pytest.approx(cash_before + 1_710 - 1.7 + 40 * 171 + 100 * 34 / 5 + 720, abs=0.01)
