"""Brain: a fork's update fetches the official release tags its history contains, so the version is the real one."""

from __future__ import annotations

import subprocess
from pathlib import Path

from hermes_cli import update_cmd_official_tags as tags


def _git(cwd: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def _commit(repo: Path, name: str) -> str:
    (repo / name).write_text(name)
    _git(repo, "add", name)
    _git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", name)
    return _git(repo, "rev-parse", "HEAD")


def test_a_fork_fetches_only_the_release_tags_its_history_contains(tmp_path, monkeypatch):
    official = tmp_path / "official"
    official.mkdir()
    _git(official, "init", "-q", "-b", "main")
    _commit(official, "a")
    _git(official, "-c", "user.name=t", "-c", "user.email=t@t", "tag", "-a", "v0.23.1", "-m", "release")
    _git(official, "tag", "v0.23.1+canary.1")

    fork = tmp_path / "fork"
    _git(tmp_path, "clone", "-q", "--no-tags", str(official), str(fork))
    _git(fork, "remote", "set-url", "origin", "https://github.com/someone/hermes-agent.git")
    _commit(fork, "brain")  # the fork's own work on top of the release

    _commit(official, "b")
    _git(official, "-c", "user.name=t", "-c", "user.email=t@t", "tag", "-a", "v0.23.2", "-m", "release")

    monkeypatch.setattr(tags, "OFFICIAL_URL", str(official))
    monkeypatch.setattr(tags, "_follows_every_commit", lambda _root: True)

    assert tags.fetch_official_release_tags(["git"], fork) == ["v0.23.1"]
    assert _git(fork, "tag", "--list").split() == ["v0.23.1"]  # not v0.23.2 (not merged), not the canary

    from hermes_cli.version_info import _git_version_info
    info = _git_version_info(fork)
    assert (info.base_version, info.distance) == ("0.23.1", 1)


def test_the_official_checkout_fetches_nothing(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    _commit(repo, "a")
    _git(repo, "remote", "add", "origin", "https://github.com/NousResearch/hermes-agent.git")

    assert tags.fetch_official_release_tags(["git"], repo) == []


def test_a_release_channel_install_stays_on_origin(tmp_path, monkeypatch):
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    _commit(repo, "a")
    _git(repo, "remote", "add", "origin", "https://github.com/someone/hermes-agent.git")
    monkeypatch.setattr(tags, "_follows_every_commit", lambda _root: False)

    assert tags.fetch_official_release_tags(["git"], repo) == []
