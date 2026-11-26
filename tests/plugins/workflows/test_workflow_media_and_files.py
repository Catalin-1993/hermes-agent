"""Image and Video steps, exporting and importing a workflow, and what each version changed — against the
test's own HERMES_HOME. The generator itself is Brain's tool; here it is replaced at the tool registry, the
seam the step calls through."""

import json

import pytest

from plugins.workflows.core import engine, media, model, store
from plugins.workflows.dashboard import plugin_api


@pytest.fixture
def generator(monkeypatch):
    """Brain's generation tools, answering with a file per call and recording what they were asked."""
    from tools.registry import registry

    calls: list[tuple[str, dict]] = []

    def dispatch(name, args, **kwargs):
        calls.append((name, args))
        kind = "image" if name == "image_generate" else "video"
        return json.dumps({"success": True, kind: f"/cache/{kind}_{len(calls)}.png"})

    monkeypatch.setattr(media, "ready", lambda kind: True)
    monkeypatch.setattr(registry, "dispatch", dispatch)
    return calls


def _workflow(nodes, edges):
    doc = model.normalize({"name": "Media", "nodes": [{"id": "t", "kind": "trigger"}, *nodes],
                           "edges": [{"source": s, "target": t} for s, t in edges]})
    return store.create_workflow(doc)


def test_an_image_feeds_the_video_that_animates_it(generator):
    wf = _workflow(
        [{"id": "img", "kind": "image", "config": {"prompt": "un far pe stâncă", "aspect_ratio": "portrait"}},
         {"id": "vid", "kind": "video", "config": {"prompt": "valuri", "source": "{{steps.img.image}}",
                                                   "duration": 5, "resolution": "1080p", "aspect_ratio": "9:16"}}],
        [("t", "img"), ("img", "vid")],
    )
    run_id = engine.start(wf)

    assert engine.execute(run_id) == "succeeded"
    assert generator == [
        ("image_generate", {"prompt": "un far pe stâncă", "aspect_ratio": "portrait"}),
        ("video_generate", {"prompt": "valuri", "aspect_ratio": "9:16", "image_url": "/cache/image_1.png",
                            "resolution": "1080p", "duration": 5}),
    ]
    vid = next(s for s in store.get_run(run_id)["steps"] if s["node_id"] == "vid")
    assert (vid["output"], vid["data"]["video"]) == ("/cache/video_2.png", "/cache/video_2.png")


def test_a_generator_that_is_not_set_up_fails_the_step_with_where_to_set_it(monkeypatch):
    monkeypatch.setattr(media, "ready", lambda kind: False)
    wf = _workflow([{"id": "img", "kind": "image", "config": {"prompt": "x"}}], [("t", "img")])
    run_id = engine.start(wf)

    assert engine.execute(run_id) == "failed"
    assert "Image Generation" in store.get_run(run_id)["error"]


def test_a_generator_error_is_the_steps_error(monkeypatch):
    from tools.registry import registry

    monkeypatch.setattr(media, "ready", lambda kind: True)
    monkeypatch.setattr(registry, "dispatch", lambda *a, **k: json.dumps({"success": False, "error": "quota"}))
    wf = _workflow([{"id": "vid", "kind": "video", "config": {"prompt": "x"}}], [("t", "vid")])
    run_id = engine.start(wf)

    engine.execute(run_id)
    assert store.get_run(run_id)["steps"][1]["error"] == "quota"


def test_an_exported_workflow_imports_as_a_new_one_with_its_own_secret():
    source = plugin_api.create_workflow(plugin_api.CreateBody(workflow={
        "name": "Hook", "nodes": [{"id": "t", "kind": "trigger", "config": {"type": "webhook"}},
                                  {"id": "a", "kind": "llm", "config": {"prompt": "rezumă"}}],
        "edges": [{"source": "t", "target": "a"}]}))
    exported = plugin_api.export_workflow(source["id"])

    assert exported["format"] == "brain-workflow"
    assert source["hook"]["secret"] not in json.dumps(exported)

    copy = plugin_api.import_workflow(plugin_api.ImportBody(data=json.loads(json.dumps(exported))))
    assert copy["id"] != source["id"]
    assert [(n["id"], n["kind"]) for n in copy["nodes"]] == [("t", "trigger"), ("a", "llm")]
    assert copy["hook"]["secret"] != source["hook"]["secret"]


def test_a_file_that_is_not_a_workflow_is_refused():
    with pytest.raises(plugin_api.HTTPException) as refused:
        plugin_api.import_workflow(plugin_api.ImportBody(data={"hello": "world"}))
    assert refused.value.status_code == 400


def test_each_version_says_what_it_changed():
    wf = _workflow([{"id": "a", "kind": "llm", "config": {"prompt": "x"}}], [("t", "a")])
    doc = {k: wf[k] for k in ("name", "description", "nodes", "edges", "viewport")}

    moved = {**doc, "nodes": [{**n, "x": n["x"] + 40} for n in doc["nodes"]]}
    store.save_workflow(wf["id"], model.normalize(moved))
    edited = {**doc, "name": "Altul", "nodes": [*doc["nodes"][:1], {**doc["nodes"][1], "config": {"prompt": "y"}},
                                                {"id": "o", "kind": "output", "title": "Trimite"}],
              "edges": [*doc["edges"], {"source": "a", "target": "o"}]}
    store.save_workflow(wf["id"], model.normalize(edited))

    newest, first = store.list_versions(wf["id"])
    assert first["changes"] == {"first": True}
    assert newest["changes"] == {"added": ["Trimite"], "removed": [], "changed": ["LLM"], "links_added": 1,
                                 "links_removed": 0, "renamed": True, "described": False}
