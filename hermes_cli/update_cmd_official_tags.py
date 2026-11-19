"""Brain: a fork's checkout learns the official release tags its history already contains.

Every version reader (About, /health, the plugin catalog's ``requires_hermes``) names the newest
release tag merged into HEAD (``version_info``). A fork's ``origin`` usually carries no tags, so a
fork that merged upstream ``vX.Y.Z`` kept naming whatever tag it was installed with, and catalog
plugins that need ``vX.Y.Z`` refused to install. After the update's fetch, this lists the official
repository's stable tags and fetches only those whose commit is already in HEAD's history: tag
objects only, never another history. Best effort and create-only, like ``fetch_release_tag``.
"""

from __future__ import annotations

import logging
import re
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

OFFICIAL_URL = "https://github.com/NousResearch/hermes-agent.git"
_STABLE_REF = re.compile(r"^refs/tags/(v\d+\.\d+\.\d+)(\^\{\})?$")


def _git(git_cmd: list[str], root: Path, args: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run([*git_cmd, *args], cwd=str(root), capture_output=True, check=False,
                          text=True, encoding="utf-8", errors="replace", **kwargs)


def official_stable_tags(ls_remote: str) -> dict[str, str]:
    """``{tag: commit}`` from ``git ls-remote --tags`` output; a peeled ``^{}`` line names the commit."""
    tags: dict[str, str] = {}
    for line in ls_remote.splitlines():
        sha, _, ref = line.partition("\t")
        match = _STABLE_REF.match(ref.strip())
        if match and (match[2] or match[1] not in tags):
            tags[match[1]] = sha.strip()
    return tags


def _contained(git_cmd: list[str], root: Path, commit: str) -> bool:
    return (_git(git_cmd, root, ["cat-file", "-e", f"{commit}^{{commit}}"]).returncode == 0
            and _git(git_cmd, root, ["merge-base", "--is-ancestor", commit, "HEAD"]).returncode == 0)


def _follows_every_commit(root: Path) -> bool:
    try:
        from hermes_cli.config import get_config_path, require_readable_config_before_write
        from hermes_cli.update_channel import resolve_update_channel

        return resolve_update_channel(require_readable_config_before_write(get_config_path()), root) == "main"
    except Exception:  # health: allow BLE001 -- an unreadable channel record of any kind keeps the update on origin
        return False


def fetch_official_release_tags(git_cmd: list[str], root: Path, *, pinned: bool = False) -> list[str]:
    """Fetch the official stable tags this fork's HEAD already contains; the tags fetched.

    Runs only for an install recorded on the every-commit channel (``main``) and not ``pinned`` to a
    release: a release channel's update talks to ``origin`` only and fetches its own release tag
    (``fetch_release_tag``)."""
    from hermes_cli._subprocess_compat import no_prompt_git_kwargs
    from hermes_cli.update_cmd import NETWORK_GIT_TIMEOUT_SECONDS

    if pinned or not _follows_every_commit(root):
        return []
    try:
        origin = _git(git_cmd, root, ["remote", "get-url", "origin"]).stdout.strip().lower()
        if not origin or "nousresearch/hermes-agent" in origin:
            return []
        listed = _git(git_cmd, root, ["ls-remote", "--tags", OFFICIAL_URL, "refs/tags/v*"],
                      timeout=NETWORK_GIT_TIMEOUT_SECONDS, **no_prompt_git_kwargs())
        if listed.returncode:
            return []
        local = set(_git(git_cmd, root, ["tag", "--list", "v*"]).stdout.split())
        wanted = [tag for tag, commit in official_stable_tags(listed.stdout).items()
                  if tag not in local and _contained(git_cmd, root, commit)]
        if wanted and _git(git_cmd, root, ["fetch", "--no-tags", OFFICIAL_URL,
                                           *(f"refs/tags/{tag}:refs/tags/{tag}" for tag in wanted)],
                           timeout=NETWORK_GIT_TIMEOUT_SECONDS, **no_prompt_git_kwargs()).returncode:
            return []
        return wanted
    except (OSError, subprocess.SubprocessError) as exc:
        logger.warning("Could not fetch the official release tags: %s", exc)
        return []
