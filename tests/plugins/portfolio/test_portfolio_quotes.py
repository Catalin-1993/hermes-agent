"""Stock quotes and bars for the Watchlist, read from the market-data service."""

import io
import urllib.error

from plugins.portfolio.core import quotes, runtime


def test_a_quote_is_the_last_close_against_the_one_before_in_the_listing_currency(monkeypatch):
    monkeypatch.setattr(runtime, "service", lambda: {"port": 1, "token": "t"})
    monkeypatch.setattr(runtime, "fetch_history", lambda info, symbols, start: {
        "TLV.RO": {"bars": [["2026-10-17", 30, 31, 29, 30.0, 1000], ["2026-10-20", 30, 34, 29.5, 33.0, 2500]]},
        "NOPE": {"bars": [], "error": "not found"},
    })

    answer = quotes.quotes(["TLV.RO", "NOPE"])

    assert set(answer["quotes"]) == {"TLV.RO"}  # what the provider does not know is left out
    quote = answer["quotes"]["TLV.RO"]
    assert (quote["price"], quote["currency"], quote["date"], quote["volume"]) == (33.0, "RON", "2026-10-20", 2500)
    assert quote["change_pct"] == 10.0


def test_without_the_service_there_are_no_quotes_and_the_answer_says_why(monkeypatch):
    monkeypatch.setattr(runtime, "service", lambda: None)

    answer = quotes.quotes(["AAPL"])

    assert answer["quotes"] == {}
    assert set(answer["status"]) == {"env", "service", "error"}


def test_a_service_from_before_bars_existed_asks_for_a_restart(monkeypatch):
    def old_service(info, symbol, interval):
        raise urllib.error.HTTPError("http://x/bars", 404, "Not Found", {}, io.BytesIO())

    monkeypatch.setattr(runtime, "service", lambda: {"port": 1, "token": "t"})
    monkeypatch.setattr(runtime, "fetch_bars", old_service)

    assert quotes.bars("AAPL", "1h")["error"] == "restart"
