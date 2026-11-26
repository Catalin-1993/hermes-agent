"""Start a run in its own process, so the request (or the cron tick) that asked for it returns at once.

The process is ``python -m plugins.workflows.core.runner <run id>`` in its own session, with this
profile's home and only this profile's credentials (``served_profile_child_env``: one backend serves
several profiles), writing its log to ``<HERMES_HOME>/workflows/logs/<run id>.log``. A cancel
terminates the run and the agent it is waiting on together (``stop``).
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import psutil

from hermes_constants import get_hermes_home

import plugins.workflows as _package

REPO_ROOT = Path(_package.__file__).resolve().parents[2]


def log_path(run_id: str) -> Path:
    return get_hermes_home() / "workflows" / "logs" / f"{run_id}.log"


def child_env(home: Path) -> dict:
    """The environment of a process that acts for the profile living in ``home``."""
    from tools.environments.local import served_profile_child_env

    return served_profile_child_env(target_home=home, inherit_credentials=True)


def runner_env() -> dict:
    env = child_env(get_hermes_home())
    env["PYTHONPATH"] = os.pathsep.join(p for p in (str(REPO_ROOT), env.get("PYTHONPATH", "")) if p)
    return env


def launch(run_id: str) -> int:
    path = log_path(run_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "ab") as log:
        proc = subprocess.Popen(
            [sys.executable, "-m", "plugins.workflows.core.runner", run_id],
            cwd=str(REPO_ROOT), env=runner_env(), stdin=subprocess.DEVNULL, stdout=log, stderr=log,
            # detached-spawn: ok — a run outlives the request and a gateway restart by design; cancel stops its whole tree (stop)
            start_new_session=True,
        )
    return proc.pid


def stop(pid: int) -> bool:
    """Terminate the run process and its agent; True once none of them is left."""
    try:
        runner = psutil.Process(pid)
        processes = [*runner.children(recursive=True), runner]
    except psutil.NoSuchProcess:
        return True
    for process in processes:
        try:
            process.terminate()
        except psutil.NoSuchProcess:
            continue
    _gone, alive = psutil.wait_procs(processes, timeout=5)
    return not alive
