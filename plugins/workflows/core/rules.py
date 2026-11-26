"""The rule of a Condition step: ``priority = high and count > 2``.

Grammar (keywords in English or Romanian, case-insensitive)::

    rule    := or
    or      := and (("or" | "sau" | "||") and)*
    and     := not (("and" | "și" | "si" | "&&") not)*
    not     := ("not" | "nu" | "!") not | compare
    compare := value (op value)?
    op      := = | == | != | <> | > | >= | < | <= | contains | conține | contine
    value   := number | "text" | 'text' | true | false | path | word | "(" rule ")"

A path (``count``, ``output``, ``steps.n_ab12.data.score``) is looked up in the values the step sees;
a word that names no value stands for itself, so ``priority = high`` compares with the text "high".
A value alone is true when it is truthy. Numbers compare as numbers when both sides read as numbers,
text compares without regard to case. A rule that cannot be read raises ``RuleError`` with the reason.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Callable

from plugins.workflows.core.model import fold

_TOKEN = re.compile(
    r"""\s*(?:
        (?P<num>-?\d+(?:\.\d+)?)(?![\w.])
      | "(?P<dq>(?:[^"\\]|\\.)*)"
      | '(?P<sq>(?:[^'\\]|\\.)*)'
      | (?P<op>==|!=|<>|>=|<=|&&|\|\||[=<>!()])
      | (?P<word>[^\s=<>!()"']+)
    )""",
    re.VERBOSE,
)

_OR = {"or", "sau", "||"}
_AND = {"and", "și", "si", "&&"}
_NOT = {"not", "nu", "!"}
_CONTAINS = {"contains", "conține", "contine"}
_COMPARE = {"=", "==", "!=", "<>", ">", ">=", "<", "<="} | _CONTAINS
_MISSING = object()


class RuleError(ValueError):
    """A rule that cannot be read; the message says where."""


@dataclass(frozen=True)
class _Tok:
    kind: str  # num | str | op | word
    text: str


def _tokens(rule: str) -> list[_Tok]:
    tokens: list[_Tok] = []
    pos = 0
    rule = rule.strip()
    while pos < len(rule):
        match = _TOKEN.match(rule, pos)
        if not match or match.end() == pos:
            raise RuleError(f"Nu pot citi regula de la „{rule[pos:pos + 12]}”.")
        pos = match.end()
        for kind in ("num", "dq", "sq", "op", "word"):
            value = match.group(kind)
            if value is not None:
                if kind in ("dq", "sq"):
                    tokens.append(_Tok("str", re.sub(r"\\(.)", r"\1", value)))
                else:
                    tokens.append(_Tok(kind, value))
                break
    return tokens


def _lookup(values: dict, path: str) -> Any:
    current: Any = values
    for part in path.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, dict) and _folded(current, part) is not _MISSING:
            current = _folded(current, part)
        elif isinstance(current, list) and part.isdigit() and int(part) < len(current):
            current = current[int(part)]
        else:
            return _MISSING
    return current


def _folded(mapping: dict, part: str) -> Any:
    """A key matched without regard to case or diacritics (``Număr`` finds ``numar``)."""
    wanted = fold(part)
    return next((value for key, value in mapping.items() if isinstance(key, str) and fold(key) == wanted), _MISSING)


def _as_number(value: Any) -> Any:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        try:
            return float(value.strip().replace(",", "."))
        except ValueError:
            return None
    return None


def _as_text(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return "" if value is None else str(value)


def _truthy(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() not in ("", "false", "0", "no", "nu", "null", "none")
    return bool(value)


def _equal(left: Any, right: Any) -> bool:
    a, b = _as_number(left), _as_number(right)
    if a is not None and b is not None:
        return a == b
    if isinstance(left, bool) or isinstance(right, bool):
        return _truthy(left) == _truthy(right)
    return _as_text(left).strip().lower() == _as_text(right).strip().lower()


def _order(op: str) -> Callable[[Any, Any], bool]:
    def compare(left: Any, right: Any) -> bool:
        a, b = _as_number(left), _as_number(right)
        if a is None or b is None:
            a, b = _as_text(left).lower(), _as_text(right).lower()
        return {">": a > b, ">=": a >= b, "<": a < b, "<=": a <= b}[op]
    return compare


def _contains(left: Any, right: Any) -> bool:
    if isinstance(left, list):
        return any(_equal(item, right) for item in left)
    if isinstance(left, dict):
        return _as_text(right) in left
    return _as_text(right).lower() in _as_text(left).lower()


_OPS: dict[str, Callable[[Any, Any], bool]] = {
    "=": _equal, "==": _equal,
    "!=": lambda a, b: not _equal(a, b), "<>": lambda a, b: not _equal(a, b),
    ">": _order(">"), ">=": _order(">="), "<": _order("<"), "<=": _order("<="),
    **{word: _contains for word in _CONTAINS},
}


class _Parser:
    def __init__(self, tokens: list[_Tok], values: dict):
        self.tokens, self.pos, self.values = tokens, 0, values

    def peek(self) -> _Tok | None:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def keyword(self, words: set[str]) -> bool:
        tok = self.peek()
        if tok and tok.kind in ("word", "op") and tok.text.lower() in words:
            self.pos += 1
            return True
        return False

    def parse(self) -> bool:
        if not self.tokens:
            raise RuleError("Regula e goală.")
        result = self.or_()
        if self.peek() is not None:
            raise RuleError(f"Nu înțeleg „{self.peek().text}” din regulă.")
        return result

    def or_(self) -> bool:
        result = self.and_()
        while self.keyword(_OR):
            right = self.and_()
            result = result or right
        return result

    def and_(self) -> bool:
        result = self.not_()
        while self.keyword(_AND):
            right = self.not_()
            result = result and right
        return result

    def not_(self) -> bool:
        if self.keyword(_NOT):
            return not self.not_()
        return self.compare()

    def compare(self) -> bool:
        tok = self.peek()
        if tok and tok.kind == "op" and tok.text == "(":
            self.pos += 1
            result = self.or_()
            if not self.keyword({")"}):
                raise RuleError("Lipsește „)” din regulă.")
            return result
        left = self.value(as_path=True)
        tok = self.peek()
        if tok and tok.text.lower() in _COMPARE:
            self.pos += 1
            right = self.value(as_path=False)
            return _OPS[tok.text.lower()](left, right)
        return _truthy(left)

    def value(self, *, as_path: bool) -> Any:
        tok = self.peek()
        if tok is None or (tok.kind == "op" and tok.text not in ("(",)):
            raise RuleError("Regula se termină înainte de o valoare.")
        self.pos += 1
        if tok.kind == "num":
            return float(tok.text)
        if tok.kind == "str":
            return tok.text
        lowered = tok.text.lower()
        if lowered in ("true", "adevărat", "da"):
            return True
        if lowered in ("false", "fals"):
            return False
        found = _lookup(self.values, tok.text)
        if found is not _MISSING:
            return found
        # A path on the left that names nothing is empty; a word on the right is literal text.
        return None if as_path and "." in tok.text else tok.text


def evaluate(rule: str, values: dict) -> bool:
    return _Parser(_tokens(rule), values).parse()


def check(rule: str) -> str:
    """An empty string when ``rule`` reads, else the reason it does not."""
    try:
        _Parser(_tokens(rule), {}).parse()
    except RuleError as exc:
        return str(exc)
    return ""
