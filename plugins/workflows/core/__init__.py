"""Workflows core.

- ``model``: the workflow document (nodes, edges, trigger) — parsed and normalised where it enters.
- ``rules``: the condition language of a Condition step (``priority = high and count > 2``).
- ``templates``: ``{{input}}`` / ``{{steps.<id>.output}}`` references inside a step's text.
- ``store``: SQLite under ``<HERMES_HOME>/workflows/``: workflows, versions, runs and their steps.
- ``graph``: which steps a run reaches, in what order, and which branch a condition takes.
- ``steps``: what each step kind does when it runs (agent, LLM, condition, approval, answer, output).
- ``engine``: one run, from its start to its end or to a step that waits for the owner.
- ``schedule``: a schedule trigger as a Hermes cron job that starts the run.
- ``launcher``: starts a run in its own process, so the request that asked for it never waits.
- ``runner``: that process's entry point (``python -m plugins.workflows.core.runner``).
"""
