"""Where an Output step sends its message, and what the owner has connected.

- ``chat``: a reply in the conversation whose message started the run (a Telegram, Discord or Slack
  trigger), in its thread or topic where the platform has one.
- ``telegram`` / ``discord`` / ``slack``: a conversation id (or a name the channel directory knows);
  empty means the platform's home channel.
- ``github``: a comment on an issue or pull request, ``owner/repo#123``; empty means the one the GitHub
  event that started the run is about. Sent with ``gh`` under this profile's login or ``GH_TOKEN``.

Messages go out through Hermes's own sender (``send_message``, what cron delivery and ``hermes send``
use), with the bots and home channels the owner set up in Brain; nothing here holds a token.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from typing import Any, Callable

CHAT_PLATFORMS = ("telegram", "discord", "slack")
_GITHUB_TARGET = re.compile(r"^\s*([A-Za-z0-9._-]+/[A-Za-z0-9._-]+)#(\d+)\s*$")
_THREADED = ("telegram", "discord")  # "<chat>:<thread>" is how these name a topic or thread


def send_message(platform: str, target: str, message: str) -> str:
    """Send through Hermes; an empty string when it went out, else why not."""
    from tools.send_message_tool import send_message_tool

    ref = f"{platform}:{target}" if target else platform
    result = json.loads(send_message_tool({"action": "send", "target": ref, "message": message}))
    if result.get("success"):
        return ""
    return str(result.get("error") or "Mesajul nu a putut fi trimis.")[:2_000]


def _reply(target: str, message: str, trigger: dict) -> tuple[str, str]:
    platform, chat = trigger.get("platform") or trigger.get("type"), trigger.get("chat_id")
    if platform not in CHAT_PLATFORMS or not chat:
        return "", "Răspunsul în conversație merge doar într-un workflow pornit de un mesaj din Telegram, Discord sau Slack."
    where = f"{chat}:{trigger['thread_id']}" if trigger.get("thread_id") and platform in _THREADED else str(chat)
    return f"{platform}:{where}", send_message(platform, where, message)


def _github_issue(target: str, trigger: dict) -> tuple[str, int]:
    match = _GITHUB_TARGET.match(target)
    if match:
        return match.group(1), int(match.group(2))
    body = trigger.get("body") if trigger.get("type") == "github" and isinstance(trigger.get("body"), dict) else {}
    item = body.get("issue") or body.get("pull_request") or {}
    number = item.get("number") or body.get("number")
    repository = (body.get("repository") or {}).get("full_name")
    return (repository, int(number)) if repository and isinstance(number, int) else ("", 0)


def _github(target: str, message: str, trigger: dict) -> tuple[str, str]:
    repository, number = _github_issue(target, trigger)
    if not repository:
        return "", ("Scrie unde se comentează, de forma owner/repo#123. Gol merge doar când un eveniment GitHub "
                    "despre un issue sau un pull request a pornit workflow-ul.")
    gh = shutil.which("gh")
    if gh is None:
        return "", "Instalează GitHub CLI (gh) și autentifică-te cu gh auth login."
    where = f"{repository}#{number}"
    try:
        done = subprocess.run([gh, "api", f"repos/{repository}/issues/{number}/comments", "--input", "-"],
                              input=json.dumps({"body": message}), capture_output=True, text=True, timeout=60,
                              check=False)
    except subprocess.TimeoutExpired:
        return where, "GitHub nu a răspuns în 60 de secunde."
    if done.returncode != 0:
        return where, (done.stderr.strip() or done.stdout.strip() or "gh api a eșuat.")[:2_000]
    return where, ""


def _platform(name: str) -> Callable[[str, str, dict], tuple[str, str]]:
    def send(target: str, message: str, trigger: dict) -> tuple[str, str]:
        return f"{name}:{target}" if target else name, send_message(name, target, message)
    return send


_SENDERS: dict[str, Callable[[str, str, dict], tuple[str, str]]] = {
    "chat": _reply, "github": _github, **{name: _platform(name) for name in CHAT_PLATFORMS},
}


def deliver(channel: str, target: str, message: str, trigger: dict) -> tuple[str, str]:
    """``(where it went, error)``; the error is empty when the message was delivered."""
    return _SENDERS[channel](target, message, trigger if isinstance(trigger, dict) else {})


# ── what the owner has connected ───────────────────────────────────────────────────────────────


def _platform_state(config: Any, name: str, directory: dict) -> dict:
    from gateway.config import Platform

    try:
        platform = Platform(name)
    except ValueError:
        return {"configured": False, "home": False, "channels": []}
    pconfig = config.platforms.get(platform)
    channels = [{"id": str(entry.get("id")), "name": str(entry.get("name") or entry.get("id")),
                 "type": entry.get("type") or ""}
                for entry in directory.get(name, []) if isinstance(entry, dict) and entry.get("id")]
    return {"configured": bool(pconfig and pconfig.enabled), "home": bool(config.get_home_channel(platform)),
            "channels": channels[:300]}


def hooks_enabled() -> bool:
    """True when the gateway loads this plugin's hooks (``plugins.enabled`` lists it)."""
    from hermes_cli.config import cfg_get, load_config

    enabled = cfg_get(load_config(), "plugins", "enabled")
    return isinstance(enabled, list) and "workflows" in enabled


def connectors() -> dict:
    """What a trigger or an Output can use right now, for the inspector to say what is missing."""
    import hermes_cli.webhook as wh
    from gateway.channel_directory import load_directory
    from gateway.config import load_gateway_config

    config = load_gateway_config()
    directory = load_directory().get("platforms", {})
    return {
        "hooks": hooks_enabled(),
        "webhook": {"enabled": wh._is_webhook_enabled(), "base_url": wh._get_webhook_base_url()},
        "platforms": {name: _platform_state(config, name, directory) for name in CHAT_PLATFORMS},
        "gh": shutil.which("gh") is not None,
    }
