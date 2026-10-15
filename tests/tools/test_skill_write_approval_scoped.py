"""skills.write_approval as a list of skill names gates only those skills."""

import json

import pytest


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    return tmp_path


def _gate(value):
    import hermes_cli.config as cfg
    c = cfg.load_config()
    c.setdefault("skills", {})["write_approval"] = value
    cfg.save_config(c)


def _skill(name, body):
    return f"---\nname: {name}\ndescription: test skill\n---\n\n# {name}\n\n{body}\n"


def _create(name):
    from tools.skill_manager_tool import skill_manage
    return json.loads(skill_manage(action="create", name=name, content=_skill(name, "v1")))


def test_listed_skill_is_staged_and_the_others_write_freely(home):
    _gate(["inline-widgets"])
    staged = _create("inline-widgets")
    free = _create("my-notes")
    assert staged.get("staged") is True
    assert free.get("success") is True and not free.get("staged")
    assert not (home / "skills" / "inline-widgets").exists()
    assert (home / "skills" / "my-notes" / "SKILL.md").exists()


def test_the_staged_write_lands_only_after_approval(home):
    from tools import write_approval as wa
    from tools.skill_manager_tool import apply_skill_pending
    _gate(["inline-widgets"])
    pending_id = _create("inline-widgets")["pending_id"]
    record = wa.get_pending("skills", pending_id)
    assert json.loads(apply_skill_pending(record["payload"]))["success"] is True
    assert (home / "skills" / "inline-widgets" / "SKILL.md").exists()


def test_a_batch_touching_a_listed_skill_is_staged_whole(home):
    from tools.skill_manager_tool import skill_manage
    _gate(["inline-widgets"])
    ops = [{"action": "create", "name": "inline-widgets", "content": _skill("inline-widgets", "x")},
           {"action": "create", "name": "other", "content": _skill("other", "x")}]
    result = json.loads(skill_manage(action="batch", name="", operations=ops))
    assert result.get("staged") is True
    assert not (home / "skills" / "other").exists()


def test_enabled_reads_booleans_and_lists(home):
    from tools import write_approval as wa
    for value, any_gated, listed_gated in [(False, False, False), (True, True, True), ([], False, False),
                                           (["inline-widgets"], True, True)]:
        _gate(value)
        assert wa.write_approval_enabled("skills") is any_gated
        assert wa.write_approval_enabled("skills", ["inline-widgets"]) is listed_gated
    _gate(["inline-widgets"])
    assert wa.write_approval_enabled("skills", ["my-notes"]) is False
