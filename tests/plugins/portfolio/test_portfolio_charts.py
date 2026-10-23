"""The owner's charts: indicators, drawings and notes kept per symbol and profile, everything checked on
the way in; and the bars a backtest's chart is drawn from, which are the backtest's own history."""

from plugins.portfolio.core import backtest, charts, runtime


def test_a_chart_starts_with_volume_and_keeps_what_the_owner_adds():
    first = charts.load("crypto", "btc")
    assert (first["symbol"], first["saved"], [i["type"] for i in first["indicators"]]) == ("BTC", False, ["volume"])

    saved = charts.save("crypto", "BTC", {
        "indicators": [{"id": "a1", "type": "ema", "params": {"period": 21, "source": "x"}, "color": "#60a5fa"},
                       {"type": "martingale"}],
        "drawings": [{"type": "fib", "points": [{"time": 1, "price": 90000}, {"time": 2, "price": 60000}]},
                     {"type": "trend", "points": [{"time": 1, "price": 1}]},
                     {"type": "hline", "points": [{"time": 1, "price": -3}]}],
        "notes": [{"text": "  Suport puternic la 60k  ", "at": {"time": 2, "price": 60000}}, {"text": "   "}],
    })

    assert saved["saved"] is True
    assert saved["indicators"] == [{"id": "a1", "type": "ema", "params": {"period": 21.0}, "color": "#60a5fa",
                                    "hidden": False}]
    assert [d["type"] for d in saved["drawings"]] == ["fib"]  # a one-point trend and a negative level are dropped
    assert [n["text"] for n in saved["notes"]] == ["Suport puternic la 60k"]
    assert charts.load("crypto", "BTC") == saved
    assert "Suport puternic la 60k" in charts.notes_text("crypto", "BTC")


def test_charts_are_per_symbol_and_kind_and_refuse_a_non_symbol():
    charts.save("stocks", "AAPL", {"notes": [{"text": "Raport pe 30 oct"}]})

    assert charts.load("crypto", "BTC")["notes"] == []
    assert charts.load("stocks", "../etc") is None
    assert charts.save("bonds", "AAPL", {}) is None


def test_a_backtest_chart_is_drawn_from_the_backtest_history(monkeypatch):
    asked = []

    def fake_history(info, symbols, start):
        asked.append((symbols, start))
        return {symbols[0]: {"bars": [["2026-10-20", 1, 2, 0.5, 1.5, 10], ["2026-10-21", 1.5, 3, 1, 2.5]]}}

    monkeypatch.setattr(runtime, "service", lambda: {"port": 1, "token": "t"})
    monkeypatch.setattr(runtime, "fetch_history", fake_history)

    answer = backtest.prices("btc", "crypto", 5)

    assert asked[0][0] == ["BTC-EUR"]
    assert answer["bars"] == [[1792454400, 1.0, 2.0, 0.5, 1.5, 10.0], [1792540800, 1.5, 3.0, 1.0, 2.5, 0.0]]  # UTC midnights
    monkeypatch.setattr(runtime, "service", lambda: None)
    assert backtest.prices("btc", "crypto", 5)["error"] == "service"
    assert backtest.prices("../x", "crypto", 5)["error"] == "invalid"
