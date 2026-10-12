"""The inline-widgets skill: its templates are ready to paste into a ```widget fence."""
import re
from pathlib import Path

import pytest

from agent.prompt_builder import PLATFORM_HINTS

SKILL = Path(__file__).resolve().parents[2] / "skills" / "creative" / "inline-widgets"
TEMPLATES = sorted((SKILL / "templates").glob("*.html"))
CDN_HOSTS = ("cdnjs.cloudflare.com", "cdn.jsdelivr.net", "unpkg.com", "esm.sh")
URL = re.compile(r"""(?:src|href)\s*=\s*["'](https?://[^"']+)["']""", re.I)


def _count(text: str, pattern: str) -> int:
    return len(re.findall(pattern, text, re.I))


def test_every_template_is_documented_and_every_documented_one_exists():
    doc = (SKILL / "SKILL.md").read_text(encoding="utf-8")
    listed = set(re.findall(r"templates/([\w-]+\.html)", doc))

    assert listed == {path.name for path in TEMPLATES}


@pytest.mark.parametrize("path", TEMPLATES, ids=lambda path: path.name)
def test_template_is_a_finished_fence_ready_fragment(path):
    text = path.read_text(encoding="utf-8").strip()

    assert text.endswith(">")
    assert not re.search(r"<(?:!doctype|html|head|body)\b", text, re.I)
    assert _count(text, r"<script\b") == _count(text, r"</script\s*>")
    assert _count(text, r"<style\b") == _count(text, r"</style\s*>")
    # A frame is sealed and offline: nothing here may need a store, a dialog or an API.
    assert not re.search(r"\b(?:localStorage|sessionStorage|alert\(|fetch\()", text)


@pytest.mark.parametrize("path", TEMPLATES, ids=lambda path: path.name)
def test_template_loads_code_only_from_the_shared_cdns_and_pins_a_version(path):
    for url in URL.findall(path.read_text(encoding="utf-8")):
        host = url.split("/")[2]

        assert host in CDN_HOSTS, f"{path.name}: {host} is not a shared CDN"
        assert re.search(r"@\d+\.\d+\.\d+", url), f"{path.name}: {url} is not version-pinned"


@pytest.mark.parametrize("path", TEMPLATES, ids=lambda path: path.name)
def test_template_takes_its_colours_from_the_theme(path):
    text = path.read_text(encoding="utf-8")

    assert "var(--" in text
    # No page background or font of its own: the frame provides both.
    assert not re.search(r"(?:^|[;{\s])(?:body|html)\s*\{", text)
    assert not re.search(r"font-family\s*:\s*[^;]*(?:Arial|Helvetica|Inter|Roboto)", text, re.I)


def test_the_skill_the_prompt_and_the_app_agree_on_the_cdns():
    hint = PLATFORM_HINTS["desktop"]
    doc = (SKILL / "SKILL.md").read_text(encoding="utf-8")

    for host in CDN_HOSTS:
        assert host in hint, f"{host} missing from the desktop platform hint"
        assert host in doc, f"{host} missing from SKILL.md"
