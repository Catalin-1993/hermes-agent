"""A presentation in the Library: an ordinary page whose Markdown starts with ``<!-- hermes:deck theme=… -->``
and holds its slides between ``---`` lines. Mirrors ``apps/desktop/src/app/library/deck.ts`` (the editor
reads and writes the same text), so an edit made here and one made on the canvas never disagree about
what a slide is. ``apply_ops`` is what the ``library`` tool's ``edit`` action runs."""

from __future__ import annotations

import re
from typing import Any

THEMES = ("paper", "ink", "sand", "ocean")

_MARKER = re.compile(r"^\s*<!--\s*hermes:deck\b([^>]*)-->[ \t]*(?:\r?\n|$)")
_THEME = re.compile(r"\btheme=(\w+)")
_RULE = re.compile(r"^\s*---\s*$")
_FENCE = re.compile(r"^\s*(```|~~~)")

OPS = ("set_slide", "insert_slide", "remove_slide", "move_slide", "set_theme")


def is_deck(markdown: str | None) -> bool:
    return bool(_MARKER.match(markdown or ""))


def parse(markdown: str) -> tuple[str, list[str]]:
    """``(theme, slides)``; an empty deck is one empty slide."""
    marker = _MARKER.match(markdown)
    body = markdown[marker.end():] if marker else markdown
    named = _THEME.search(marker.group(1)) if marker else None
    theme = named.group(1) if named and named.group(1) in THEMES else "paper"
    slides: list[str] = []
    current: list[str] = []
    fenced = False
    for line in re.split(r"\r?\n", body):
        if _FENCE.match(line):
            fenced = not fenced
        if not fenced and _RULE.match(line):
            slides.append("\n".join(current).strip())
            current = []
        else:
            current.append(line)
    slides.append("\n".join(current).strip())
    if len(slides) > 1 and slides[-1] == "":
        slides = slides[:-1]
    return theme, slides


def serialize(theme: str, slides: list[str]) -> str:
    return f"<!-- hermes:deck theme={theme} -->\n\n" + "\n\n---\n\n".join(s.strip() for s in slides) + "\n"


def _index(op: dict, slides: list[str], key: str = "index", extra: int = 0) -> int:
    try:
        value = int(op.get(key))
    except (TypeError, ValueError):
        raise ValueError(f"'{key}' must be a slide number") from None
    # Slide numbers are what the owner sees: the first slide is 1.
    at = value - 1
    if not 0 <= at < len(slides) + extra:
        raise ValueError(f"slide {value} does not exist (the deck has {len(slides)})")
    return at


def apply_ops(markdown: str, ops: list[dict[str, Any]]) -> tuple[str, list[int]]:
    """The deck after ``ops``, applied in order, and the numbers (1-based, in the result) of the slides they
    touched. Any bad op raises ``ValueError`` and nothing is applied."""
    theme, slides = parse(markdown)
    touched: set[int] = set()
    if not isinstance(ops, list) or not ops:
        raise ValueError("edits must be a non-empty list")
    for op in ops:
        kind = (op or {}).get("op")
        text = str(op.get("markdown") or "")
        if kind == "set_slide":
            at = _index(op, slides)
            slides[at] = text.strip()
            touched.add(at)
        elif kind == "insert_slide":
            # ``index`` is where the new slide ends up; one past the end appends.
            at = _index(op, slides, extra=1)
            slides.insert(at, text.strip())
            touched = {i + 1 if i >= at else i for i in touched}
            touched.add(at)
        elif kind == "remove_slide":
            at = _index(op, slides)
            if len(slides) == 1:
                slides[0] = ""
            else:
                del slides[at]
                touched = {i - 1 if i > at else i for i in touched if i != at}
        elif kind == "move_slide":
            source = _index(op, slides)
            to = _index(op, slides, key="to")
            moved = slides.pop(source)
            slides.insert(to, moved)

            def shift(i: int) -> int:
                if i == source:
                    return to
                after_pop = i - 1 if i > source else i
                return after_pop + 1 if after_pop >= to else after_pop

            touched = {shift(i) for i in touched}
            touched.add(to)
        elif kind == "set_theme":
            named = str(op.get("theme") or "")
            if named not in THEMES:
                raise ValueError(f"theme must be one of: {', '.join(THEMES)}")
            theme = named
        else:
            raise ValueError(f"op must be one of: {', '.join(OPS)}")
    return serialize(theme, slides), sorted(i + 1 for i in touched)
