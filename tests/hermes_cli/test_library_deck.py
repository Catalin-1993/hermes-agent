"""The deck text format the desktop editor and the library tool share."""

import pytest

from hermes_cli import library_deck as deck


def test_a_deck_survives_a_round_trip_and_keeps_fenced_rules():
    text = deck.serialize("ink", ["# A", "```\n---\n```", "- x"])

    assert deck.is_deck(text)
    assert deck.parse(text) == ("ink", ["# A", "```\n---\n```", "- x"])


def test_ops_report_the_slides_they_touched_where_those_end_up():
    text = deck.serialize("paper", ["a", "b", "c"])
    out, touched = deck.apply_ops(text, [{"op": "insert_slide", "index": 1, "markdown": "new"},
                                         {"op": "move_slide", "index": 4, "to": 2}])

    assert deck.parse(out)[1] == ["new", "c", "a", "b"] and touched == [1, 2]


def test_removing_the_last_slide_leaves_an_empty_one_and_a_bad_op_raises():
    text = deck.serialize("paper", ["only"])

    assert deck.parse(deck.apply_ops(text, [{"op": "remove_slide", "index": 1}])[0])[1] == [""]
    for bad in ([], [{"op": "nope"}], [{"op": "set_slide", "index": 5, "markdown": "x"}],
                [{"op": "set_theme", "theme": "neon"}]):
        with pytest.raises(ValueError):
            deck.apply_ops(text, bad)
