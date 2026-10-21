"""The investment plan: kept beside the journal per variant, and always cleaned to what the page reads."""

import json
from pathlib import Path

import pytest

from plugins.portfolio.core import plan


@pytest.fixture
def plan_path(tmp_path: Path, monkeypatch) -> Path:
    journal = tmp_path / "investitii" / "jurnal"
    journal.mkdir(parents=True)
    monkeypatch.setattr("plugins.portfolio.core.dashboard.settings", lambda: (journal, 20_000.0))
    return tmp_path / "investitii" / "plan.json"


def test_a_variant_without_a_plan_has_the_default_rules_and_no_targets(plan_path):
    answer = plan.load("A")

    assert answer["saved"] is False
    assert answer["file"] == str(plan_path)
    assert answer["plan"]["targets"] == {} and answer["plan"]["goals"] == []
    assert answer["plan"]["rules"] == {"max_position_pct": 25.0, "rebalance_band_pp": 5.0, "min_cash_pct": 5.0,
                                       "review_loss_pct": 20.0}


def test_saving_one_variant_keeps_the_others_and_says_who_and_when(plan_path):
    plan_path.write_text(json.dumps({"variants": {"B": {"targets": {"Cripto": 40}}}}), encoding="utf-8")

    saved = plan.save("A", {"targets": {"Cripto": 15, "Acțiuni globale": 60, "Numerar": 25}})

    assert saved["saved"] is True and saved["plan"]["updated_by"] == "Cătă" and saved["plan"]["updated"]
    stored = json.loads(plan_path.read_text(encoding="utf-8"))["variants"]
    assert stored["B"]["targets"] == {"Cripto": 40}
    assert stored["A"]["targets"] == {"Cripto": 15.0, "Acțiuni globale": 60.0, "Numerar": 25.0}


def test_an_agents_file_is_cleaned_to_known_classes_ranges_and_goals(plan_path):
    plan_path.write_text(json.dumps({"variants": {"A": {
        "targets": {"Cripto": "30", "Meme coins": 50, "Aur și materii prime": 150, "Numerar": -5},
        "rules": {"max_position_pct": 0, "min_cash_pct": "nu știu"},
        "goals": [{"name": "Avans casă", "target_eur": 50000, "by": "2030-06-30"},
                  {"name": "", "target_eur": 10}, {"name": "Fără sumă"}, "text"],
        "thesis": "Creștere pe termen lung.",
        "extra": "ignorat",
    }}}), encoding="utf-8")

    cleaned = plan.load("A")["plan"]

    assert cleaned["targets"] == {"Cripto": 30.0, "Aur și materii prime": 100.0}
    assert cleaned["rules"]["max_position_pct"] == 1.0  # held to its lowest
    assert cleaned["rules"]["min_cash_pct"] == 5.0  # unreadable → the default
    assert [(g["name"], g["target_eur"], g["by"]) for g in cleaned["goals"]] == [("Avans casă", 50000.0, "2030-06-30")]
    assert "extra" not in cleaned


def test_a_broken_file_reads_as_no_plan(plan_path):
    plan_path.write_text("{ not json", encoding="utf-8")

    assert plan.load("A")["saved"] is False
