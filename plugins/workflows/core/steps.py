"""What each step kind does when a run reaches it.

Every executor takes the node, the values it sees (``templates.context``) and the run, and returns a
``Result``. ``waiting`` stops the run at that step until the owner answers (Approval, Answer); the
answer itself is recorded by ``engine.resume_with``, not here.

- Agent: the task goes to a Hermes agent (a profile) as one turn, ``hermes chat --query-file … -Q``,
  in that profile's home; its reply is the step's output.
- LLM: one completion on the owner's active model (or the model the step names), through the host's
  plugin LLM access; an optional system prompt; optional JSON output.
- Image / Video: one generation with the backend the owner set up for the agent (``media``); the
  output is the file or URL, shown in the run view like chat media.
- Condition: the rule decides the branch (``yes`` / ``no``); the input passes through unchanged.
- Output: the message, filled in: a notification the app announces, or a message sent on a channel
  (``channels``: the conversation that started the run, Telegram, Discord, Slack, a GitHub comment).
"""

from __future__ import annotations

import json
import logging
import signal
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

from plugins.workflows.core import model, rules, templates

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Result:
    status: str  # succeeded | failed | waiting
    output: str = ""
    data: Optional[dict] = None
    error: str = ""


@dataclass
class StepContext:
    run_id: str
    values: dict
    input_text: str
    on_child: Callable[[Optional[int]], None] = field(default=lambda pid: None)


def _profile_home(name: str) -> Path:
    from hermes_cli.profiles import get_profile_dir  # in-tree plugin; resolved per call, never at import

    return get_profile_dir(name or "default")


def _agent_env(home: Path) -> dict:
    from plugins.workflows.core.launcher import child_env

    env = {k: v for k, v in child_env(home).items() if not k.startswith("HERMES_KANBAN")}
    env["HERMES_SESSION_SOURCE"] = "workflow"
    return env


def run_agent(node: dict, ctx: StepContext) -> Result:
    config = node["config"]
    task = templates.render(config["task"], ctx.values).strip()
    if not task:
        return Result("failed", error="Pasul Agent nu are o sarcină.")
    if ctx.input_text and "{{" not in config["task"]:
        task = f"{task}\n\n---\nDin pasul anterior:\n{ctx.input_text}"
    try:
        home = _profile_home(config["agent"])
    except (FileNotFoundError, ValueError) as exc:
        return Result("failed", error=f"Agentul „{config['agent'] or 'default'}” nu există: {exc}")
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as handle:
        handle.write(task)
        query_file = handle.name
    command = [sys.executable, "-m", "hermes_cli.main", "chat", "--query-file", query_file, "-Q",
               "--source", "workflow"]
    try:
        proc = subprocess.Popen(command, env=_agent_env(home), stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, text=True, cwd=str(home))
        ctx.on_child(proc.pid)
        try:
            stdout, stderr = proc.communicate(timeout=config["timeout_min"] * 60)
        except subprocess.TimeoutExpired:
            proc.send_signal(signal.SIGTERM)
            proc.communicate(timeout=30)
            return Result("failed", error=f"Agentul nu a terminat în {config['timeout_min']} minute.")
    finally:
        ctx.on_child(None)
        Path(query_file).unlink(missing_ok=True)
    reply = stdout.strip()
    if proc.returncode != 0:
        lines = [line for line in stderr.strip().splitlines() if line.strip() and not line.startswith("session_id:")]
        reason = lines[-1] if lines else f"Agentul s-a oprit cu codul {proc.returncode}."
        return Result("failed", output=reply, error=reason[:2_000])
    return Result("succeeded", output=reply, data=_data(reply))


def _data(text: str) -> Optional[dict]:
    parsed = templates.as_data(text)
    return parsed if isinstance(parsed, dict) else None


def run_llm(node: dict, ctx: StepContext) -> Result:
    from agent.plugin_llm import PluginLlm, PluginLlmTrustError

    config = node["config"]
    prompt = templates.render(config["prompt"], ctx.values).strip()
    if not prompt:
        return Result("failed", error="Pasul LLM nu are un prompt.")
    if ctx.input_text and "{{" not in config["prompt"]:
        prompt = f"{prompt}\n\n---\nDin pasul anterior:\n{ctx.input_text}"
    system = templates.render(config["system"], ctx.values).strip()
    if config["json"]:
        system = (system + "\n\n" if system else "") + "Răspunde doar cu un obiect JSON valid, fără alt text."
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    try:
        result = PluginLlm(plugin_id="workflows").complete(messages, model=config["model"] or None, timeout=600,
                                                          purpose="workflow step")
    except PluginLlmTrustError:
        return Result("failed", error=(
            f"Modelul „{config['model']}” poate fi ales doar după ce permiți asta în config.yaml: "
            "plugins.entries.workflows.llm.allow_model_override: true. Fără model ales, pasul folosește modelul activ."))
    except Exception as exc:  # health: allow BLE001 -- the provider's own failure belongs on the step
        logger.warning("workflow LLM step failed", exc_info=True)
        return Result("failed", error=str(exc)[:2_000] or exc.__class__.__name__)
    text = result.text.strip()
    return Result("succeeded", output=text, data={**(_data(text) or {}), "_model": result.model})


def _media_step(kind: str, node: dict, ctx: StepContext) -> Result:
    from plugins.workflows.core import media

    config = node["config"]
    prompt = templates.render(config["prompt"], ctx.values).strip()
    if not prompt:
        prompt = ctx.input_text.strip()
    if not prompt:
        return Result("failed", error="Scrie ce să genereze pasul.")
    args: dict[str, Any] = {"prompt": prompt[:4_000], "aspect_ratio": config["aspect_ratio"]}
    source = templates.render(config["source"], ctx.values).strip()
    if source:
        args["image_url"] = source
    if kind == "video":
        args["resolution"] = config["resolution"]
        if config["duration"]:
            args["duration"] = config["duration"]
    location, error = media.generate(kind, args, ctx.run_id)
    if error:
        return Result("failed", error=error)
    return Result("succeeded", output=location, data={kind: location, "media": location, "prompt": prompt})


def run_image(node: dict, ctx: StepContext) -> Result:
    return _media_step("image", node, ctx)


def run_video(node: dict, ctx: StepContext) -> Result:
    return _media_step("video", node, ctx)


def run_condition(node: dict, ctx: StepContext) -> Result:
    rule = node["config"]["rule"].strip()
    if not rule:
        return Result("failed", error="Condiția nu are o regulă.")
    try:
        passed = rules.evaluate(rule, ctx.values)
    except rules.RuleError as exc:
        return Result("failed", error=str(exc))
    return Result("succeeded", output=ctx.input_text, data={"branch": "yes" if passed else "no", "result": passed})


def run_approval(node: dict, ctx: StepContext) -> Result:
    message = templates.render(node["config"]["message"], ctx.values).strip()
    return Result("waiting", output=message, data={"waiting": "approval"})


def run_answer(node: dict, ctx: StepContext) -> Result:
    if not node["config"]["fields"]:
        return Result("failed", error="Pasul Răspuns nu are câmpuri.")
    message = templates.render(node["config"]["message"], ctx.values).strip()
    return Result("waiting", output=message, data={"waiting": "answer"})


def run_output(node: dict, ctx: StepContext) -> Result:
    from plugins.workflows.core import channels

    config = node["config"]
    message = templates.render(config["message"], ctx.values).strip() or ctx.input_text.strip()
    if not message:
        return Result("failed", error="Ieșirea nu are nimic de trimis.")
    if config["channel"] == "notification":
        return Result("succeeded", output=message, data={"notify": True, "channel": "notification"})
    target = templates.render(config["target"], ctx.values).strip()
    where, error = channels.deliver(config["channel"], target, message, ctx.values.get("trigger") or {})
    if error:
        return Result("failed", output=message, error=error)
    return Result("succeeded", output=message, data={"channel": config["channel"], "sent_to": where})


def run_trigger(node: dict, ctx: StepContext) -> Result:
    """What started the run, as the first step's output: the message, or the webhook's body."""
    trigger = ctx.values.get("trigger") or {}
    body = trigger.get("body")
    if isinstance(body, str):
        return Result("succeeded", output=body, data={k: v for k, v in trigger.items() if k != "body"})
    if body is None:
        return Result("succeeded", output="", data=trigger)
    return Result("succeeded", output=json.dumps(body, ensure_ascii=False, indent=2),
                  data=body if isinstance(body, dict) else {"items": body})


EXECUTORS: dict[str, Callable[[dict, StepContext], Result]] = {
    "trigger": run_trigger,
    "agent": run_agent,
    "llm": run_llm,
    "image": run_image,
    "video": run_video,
    "condition": run_condition,
    "approval": run_approval,
    "answer": run_answer,
    "output": run_output,
}


def validate_answer(node: dict, values: Any) -> tuple[dict, str]:
    """The owner's answer coerced to the fields' types, or the reason it cannot be taken."""
    if not isinstance(values, dict):
        return {}, "Răspunsul trebuie să fie un obiect JSON."
    clean: dict[str, Any] = {}
    by_name = {model.fold(str(k)): v for k, v in values.items()}
    for item in node["config"]["fields"]:
        raw = values.get(item["key"], by_name.get(model.fold(item["label"]), by_name.get(model.fold(item["key"]))))
        empty = raw is None or (isinstance(raw, str) and not raw.strip())
        if empty:
            if item["required"]:
                return {}, f"Lipsește „{item['label']}”."
            clean[item["key"]] = None
            continue
        value, error = _coerce(item, raw)
        if error:
            return {}, error
        clean[item["key"]] = value
    return clean, ""


def _coerce(item: dict, raw: Any) -> tuple[Any, str]:
    kind = item["type"]
    if kind == "number":
        try:
            number = float(str(raw).replace(",", "."))
        except ValueError:
            return None, f"„{item['label']}” trebuie să fie un număr."
        return (int(number) if number.is_integer() else number), ""
    if kind == "boolean":
        if isinstance(raw, bool):
            return raw, ""
        text = str(raw).strip().lower()
        if text in ("true", "da", "yes", "1"):
            return True, ""
        if text in ("false", "nu", "no", "0"):
            return False, ""
        return None, f"„{item['label']}” trebuie să fie da sau nu."
    if kind == "list":
        # With options: one of them. Without: a list of items (an array, or text split on commas/lines).
        if item["options"]:
            if str(raw) not in item["options"]:
                return None, f"„{item['label']}” trebuie să fie una dintre: {', '.join(item['options'])}."
            return str(raw), ""
        items = raw if isinstance(raw, list) else str(raw).replace("\n", ",").split(",")
        return [str(entry).strip() for entry in items if str(entry).strip()][:200], ""
    return str(raw)[:20_000], ""
