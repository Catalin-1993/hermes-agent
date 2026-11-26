"""A schedule trigger as a Hermes cron job.

A workflow whose trigger is a schedule owns one cron job (``no_agent``: no model, no tokens) named
"Workflow: <name>". Its script, ``<HERMES_HOME>/scripts/workflow_<id>.py``, only starts the run in its
own process and returns, so a long run never meets the cron script timeout, and prints nothing, so
cron delivers nothing. Changing the trigger re-syncs the job; another trigger type, or deleting the
workflow, removes job and script. Cron owns the clock: catch-up, pause and the next run time.
"""

from __future__ import annotations

from typing import Optional

from hermes_constants import get_hermes_home

from plugins.workflows.core import model
from plugins.workflows.core.launcher import REPO_ROOT

_SCRIPT = '''"""Brain workflow schedule — starts the workflow {name!r} ({workflow_id}). Written by the Workflows plugin."""
import os
import subprocess
import sys

ROOT = {root!r}
HOME = {home!r}
LOG = os.path.join(HOME, "workflows", "logs", "schedule.log")
os.makedirs(os.path.dirname(LOG), exist_ok=True)
env = dict(os.environ, HERMES_HOME=HOME, PYTHONPATH=os.pathsep.join(p for p in (ROOT, os.environ.get("PYTHONPATH", "")) if p))
with open(LOG, "ab") as log:
    subprocess.Popen(
        [sys.executable, "-m", "plugins.workflows.core.runner", "--workflow", {workflow_id!r}, "--trigger", "schedule"],
        cwd=ROOT, env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True,
    )
'''


def cron_expression(schedule: dict) -> str:
    """The five-field cron line for a trigger's schedule. Weekdays count from Monday = 0."""
    hour, minute = (int(part) for part in schedule["time"].split(":"))
    lines = {
        "daily": f"{minute} {hour} * * *",
        "weekdays": f"{minute} {hour} * * 1-5",
        "weekly": f"{minute} {hour} * * {(schedule['weekday'] + 1) % 7}",
        "hourly": f"{schedule['minute']} * * * *",
        "cron": schedule["cron"],
    }
    return lines[schedule["mode"]]


def check(schedule: dict) -> str:
    """An empty string when the schedule is valid, else why not."""
    expression = cron_expression(schedule)
    if not expression:
        return "Scrie o expresie cron (de exemplu 0 9 * * 1-5)."
    try:
        from croniter import croniter
    except ImportError:  # cron validates it again when the job is created
        return ""
    return "" if croniter.is_valid(expression) else f"„{expression}” nu e o expresie cron validă."


def _script_name(workflow_id: str) -> str:
    return f"workflow_{workflow_id}.py"


def _write_script(workflow_id: str, name: str) -> None:
    path = get_hermes_home() / "scripts" / _script_name(workflow_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = _SCRIPT.format(name=name, workflow_id=workflow_id, root=str(REPO_ROOT), home=str(get_hermes_home()))
    if not path.is_file() or path.read_text(encoding="utf-8") != text:
        path.write_text(text, encoding="utf-8")


def _remove_script(workflow_id: str) -> None:
    (get_hermes_home() / "scripts" / _script_name(workflow_id)).unlink(missing_ok=True)


def sync(workflow: dict) -> Optional[str]:
    """Make the cron job match the workflow's trigger. Returns the job id (None when it has none)."""
    from cron.jobs import create_job, get_job, remove_job, update_job

    trigger = model.trigger_node(workflow)["config"]
    job = get_job(workflow["job_id"]) if workflow.get("job_id") else None
    if trigger["type"] != "schedule":
        if job is not None:
            remove_job(job["id"])
        _remove_script(workflow["id"])
        return None
    expression = cron_expression(trigger["schedule"])
    name = f"Workflow: {workflow['name']}"
    _write_script(workflow["id"], workflow["name"])
    if job is None:
        job = create_job(prompt=None, schedule=expression, name=name, script=_script_name(workflow["id"]),
                         no_agent=True, deliver="local")
    elif (job.get("schedule") or {}).get("expr") != expression or job.get("name") != name:
        job = update_job(job["id"], {"schedule": expression, "name": name}) or job
    return job["id"]


def next_run(job_id: Optional[str]) -> Optional[str]:
    if not job_id:
        return None
    from cron.jobs import get_job

    job = get_job(job_id)
    return job.get("next_run_at") if job else None


def remove(workflow: dict) -> None:
    from cron.jobs import remove_job

    if workflow.get("job_id"):
        remove_job(workflow["job_id"])
    _remove_script(workflow["id"])
