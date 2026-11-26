"""Workflow runs end to end, in-process, against the test's own HERMES_HOME: branches, joins, waiting
steps and their replies, cancel, partial runs, and the document the canvas may send."""

import pytest

from plugins.workflows.core import engine, model, rules, steps, store


@pytest.fixture
def fake_llm(monkeypatch):
    """An LLM step that answers with its prompt's first line, so a test decides what each step says."""
    def run(node, ctx):
        from plugins.workflows.core import templates

        text = templates.render(node["config"]["prompt"], ctx.values)
        return steps.Result("succeeded", output=text, data=steps._data(text))

    monkeypatch.setitem(steps.EXECUTORS, "llm", run)


def _workflow(nodes, edges):
    doc = model.normalize({"name": "Test", "nodes": [{"id": "t", "kind": "trigger"}, *nodes],
                           "edges": [{"source": s, "target": t, **({"branch": b} if b else {})} for s, t, b in edges]})
    return store.create_workflow(doc)


def _run(workflow, **kwargs):
    run_id = engine.start(workflow, **kwargs)
    return run_id, engine.execute(run_id)


def _status(run_id):
    return {s["node_id"]: s["status"] for s in store.get_run(run_id)["steps"]}


def test_a_condition_takes_one_branch_and_skips_the_other(fake_llm):
    wf = _workflow(
        [{"id": "ask", "kind": "llm", "config": {"prompt": '{"priority": "high", "count": 3}'}},
         {"id": "if", "kind": "condition", "config": {"rule": "priority = high and count > 2"}},
         {"id": "yes", "kind": "output", "config": {"message": "urgent {{input.count}}"}},
         {"id": "no", "kind": "output", "config": {"message": "later"}}],
        [("t", "ask", None), ("ask", "if", None), ("if", "yes", "yes"), ("if", "no", "no")],
    )
    run_id, outcome = _run(wf)

    assert outcome == "succeeded"
    assert _status(run_id) == {"t": "succeeded", "ask": "succeeded", "if": "succeeded", "yes": "succeeded",
                               "no": "skipped"}
    yes = next(s for s in store.get_run(run_id)["steps"] if s["node_id"] == "yes")
    assert yes["output"] == "urgent 3"
    assert [e["message"] for e in store.events_since(0) if e["type"] == "notification"] == ["urgent 3"]


def test_a_join_waits_for_every_live_branch_and_runs_once(fake_llm):
    wf = _workflow(
        [{"id": "a", "kind": "llm", "config": {"prompt": "A"}},
         {"id": "b", "kind": "llm", "config": {"prompt": "B"}},
         {"id": "join", "kind": "llm", "config": {"prompt": "{{steps.a.output}}+{{steps.b.output}}"}}],
        [("t", "a", None), ("t", "b", None), ("a", "join", None), ("b", "join", None)],
    )
    run_id, _ = _run(wf)

    join = next(s for s in store.get_run(run_id)["steps"] if s["node_id"] == "join")
    assert (join["status"], join["output"]) == ("succeeded", "A+B")


def test_an_approval_parks_the_run_until_the_owner_answers(fake_llm):
    wf = _workflow(
        [{"id": "ok", "kind": "approval", "config": {"message": "Trimit?"}},
         {"id": "send", "kind": "output", "config": {"message": "trimis"}}],
        [("t", "ok", None), ("ok", "send", None)],
    )
    run_id, outcome = _run(wf)
    assert outcome == "waiting"
    assert store.get_run(run_id)["waiting_node"] == "ok"

    assert engine.resume_with(run_id, "ok", approved=True) == "queued"
    assert engine.execute(run_id) == "succeeded"
    assert _status(run_id)["send"] == "succeeded"

    rejected, _ = _run(wf)
    assert engine.resume_with(rejected, "ok", approved=False, note="nu acum") == "rejected"
    run = store.get_run(rejected)
    assert run["status"] == "rejected"
    assert _status(rejected)["send"] == "skipped"


def test_an_answer_is_checked_against_its_fields_and_reaches_the_next_steps(fake_llm):
    wf = _workflow(
        [{"id": "form", "kind": "answer", "config": {"fields": [
            {"label": "Buget", "type": "number"},
            {"label": "Urgent", "type": "boolean"},
            {"label": "Canal", "type": "list", "options": ["email", "sms"]}]}},
         {"id": "next", "kind": "llm", "config": {"prompt": "{{steps.form.buget}} {{steps.form.canal}}"}}],
        [("t", "form", None), ("form", "next", None)],
    )
    run_id, _ = _run(wf)

    with pytest.raises(engine.RunRefused, match="Buget"):
        engine.resume_with(run_id, "form", values={"buget": "mult", "urgent": "da", "canal": "email"})
    with pytest.raises(engine.RunRefused, match="Canal"):
        engine.resume_with(run_id, "form", values={"buget": "12", "urgent": True, "canal": "fax"})

    engine.resume_with(run_id, "form", values={"buget": "12,5", "urgent": "da", "canal": "sms"})
    engine.execute(run_id)
    nxt = next(s for s in store.get_run(run_id)["steps"] if s["node_id"] == "next")
    assert nxt["output"] == "12.5 sms"


def test_a_failed_step_ends_the_run_and_skips_what_follows():
    wf = _workflow(
        [{"id": "if", "kind": "condition", "config": {"rule": "count >"}},
         {"id": "after", "kind": "output", "config": {"message": "x"}}],
        [("t", "if", None), ("if", "after", "yes")],
    )
    run_id, outcome = _run(wf)

    assert outcome == "failed"
    run = store.get_run(run_id)
    assert run["status"] == "failed" and "Condiție" in run["error"]
    assert _status(run_id)["after"] == "skipped"


def test_from_a_step_and_only_a_step_reuse_earlier_outputs(fake_llm):
    wf = _workflow(
        [{"id": "a", "kind": "llm", "config": {"prompt": "first"}},
         {"id": "b", "kind": "llm", "config": {"prompt": "[{{input}}]"}},
         {"id": "c", "kind": "llm", "config": {"prompt": "<{{input}}>"}}],
        [("t", "a", None), ("a", "b", None), ("b", "c", None)],
    )
    _run(wf)

    from_b, _ = _run(wf, mode="from", node_id="b")
    assert set(_status(from_b)) == {"b", "c"}
    only_c, _ = _run(wf, mode="step", node_id="c")
    assert set(_status(only_c)) == {"c"}
    c = store.get_run(only_c)["steps"][0]
    assert c["output"] == "<[first]>"


def test_a_waiting_run_can_be_cancelled():
    wf = _workflow([{"id": "ok", "kind": "approval"}], [("t", "ok", None)])
    run_id, _ = _run(wf)

    assert engine.cancel(run_id) is None
    assert store.get_run(run_id)["status"] == "cancelled"
    with pytest.raises(engine.RunRefused):
        engine.resume_with(run_id, "ok", approved=True)


def test_deleting_a_workflow_deletes_its_runs_and_versions(fake_llm):
    wf = _workflow([{"id": "a", "kind": "llm", "config": {"prompt": "x"}}], [("t", "a", None)])
    run_id, _ = _run(wf)
    store.save_workflow(wf["id"], model.normalize({**wf, "name": "Altul"}))
    assert len(store.list_versions(wf["id"])) == 2

    assert store.delete_workflow(wf["id"])
    assert store.get_run(run_id) is None
    assert store.list_versions(wf["id"]) == []


def test_the_document_never_stores_loops_or_links_to_visual_items():
    doc = model.normalize({"nodes": [
        {"id": "a", "kind": "agent"}, {"id": "b", "kind": "agent"}, {"id": "n", "kind": "note"},
        {"id": "x", "kind": "mystery"}],
        "edges": [{"source": "a", "target": "b"}, {"source": "b", "target": "a"}, {"source": "a", "target": "n"},
                  {"source": "a", "target": "b"}]})

    assert [n["kind"] for n in doc["nodes"]] == ["trigger", "agent", "agent", "note"]
    assert [(e["source"], e["target"]) for e in doc["edges"]] == [("a", "b")]


@pytest.mark.parametrize(("rule", "values", "expected"), [
    ("priority = high and count > 2", {"priority": "High", "count": "3"}, True),
    ("prioritate = ridicată și număr > 2", {"prioritate": "ridicată", "număr": 2}, False),
    ("status != done or not urgent", {"status": "done", "urgent": False}, True),
    ('title contains "factură"', {"title": "Factură nr. 12"}, True),
    ("steps.a.score >= 7.5", {"steps": {"a": {"score": 8}}}, True),
    ("(a = 1 or b = 1) and c", {"a": 0, "b": 1, "c": "da"}, True),
    ("tags contains vip", {"tags": ["new", "VIP"]}, True),
])
def test_condition_rules(rule, values, expected):
    assert rules.evaluate(rule, values) is expected


def test_a_rule_that_cannot_be_read_says_why():
    assert "valoare" in rules.check("count >")
    assert ")" in rules.check("(a = 1")
    assert rules.check("a = 1") == ""


def test_a_romanian_field_name_is_one_field_in_the_answer_the_rule_and_the_template(fake_llm):
    wf = _workflow(
        [{"id": "form", "kind": "answer", "config": {"fields": [{"label": "Număr", "type": "number"}]}},
         {"id": "if", "kind": "condition", "config": {"rule": "steps.form.număr > 2"}},
         {"id": "out", "kind": "llm", "config": {"prompt": "n={{steps.form.număr}}"}}],
        [("t", "form", None), ("form", "if", None), ("if", "out", "yes")],
    )
    field, = store.get_workflow(wf["id"])["nodes"][1]["config"]["fields"]
    assert field["key"] == "numar"

    run_id, _ = _run(wf)
    engine.resume_with(run_id, "form", values={"Număr": "3"})
    engine.execute(run_id)

    out = next(s for s in store.get_run(run_id)["steps"] if s["node_id"] == "out")
    assert (out["status"], out["output"]) == ("succeeded", "n=3")
