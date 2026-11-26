"""The run process: ``python -m plugins.workflows.core.runner <run id>`` (see ``launcher``).

Also ``--workflow <id> --trigger <type>``: create a run of that workflow and execute it here — what a
schedule's cron script calls. A SIGTERM (the owner's cancel) stops the run as cancelled.
"""

from __future__ import annotations

import argparse
import signal
import sys

from plugins.workflows.core import engine, store


def _on_term(signum, frame):
    raise engine.Cancelled()


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="workflow-runner")
    parser.add_argument("run_id", nargs="?")
    parser.add_argument("--workflow")
    parser.add_argument("--trigger", default="schedule")
    args = parser.parse_args(argv)
    signal.signal(signal.SIGTERM, _on_term)
    run_id = args.run_id
    if args.workflow:
        workflow = store.get_workflow(args.workflow)
        if workflow is None:
            print(f"workflow {args.workflow} not found", file=sys.stderr)
            return 1
        run_id = engine.start(workflow, trigger={"type": args.trigger})
    if not run_id:
        parser.error("a run id or --workflow is required")
    outcome = engine.execute(run_id)
    print(f"{run_id}: {outcome}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
