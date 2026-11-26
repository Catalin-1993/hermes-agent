"""Workflows: a canvas of steps that start from a trigger, run by Hermes's own agents, cron and channels.

The page and its API live in ``dashboard/`` and the desktop app. This module is the part the gateway
loads (``plugins.enabled``): the two hooks that start a workflow from outside (``core.ingress``).
"""


def register(ctx) -> None:
    from plugins.workflows.core import ingress

    ctx.register_hook("pre_gateway_dispatch", ingress.on_webhook)
    ctx.register_hook("post_gateway_admission", ingress.on_message)
