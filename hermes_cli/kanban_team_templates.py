"""Ready-made teams: a whole team in one step — agents with titles, a reporting line, standing
instructions, and the board rules and budgets that suit them.

Installing a team creates each member as a profile cloned from the active one (its model,
keys and skills, never its messaging channels), writes the member's instructions (``SOUL.md``),
description and place in the org chart, then adds the team's rules and budgets to the board.
A member whose name is already a profile keeps its instructions, description, title and budget;
it only joins the team's reporting line when it reports to no one yet. A rule the board already
has by name is not added again. Nothing is removed, so installing twice changes nothing the
second time.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from typing import Optional

_COMMON = (
    "\n\nWork on the Kanban board: one card at a time, a short summary when you finish. "
    "Ask your manager (a card assigned to them) when a decision is above your role. "
    "Answer in the language the owner writes in."
)


@dataclass(frozen=True)
class Member:
    name: str
    title: str
    reports_to: str
    description: str
    instructions: str
    budget_usd: Optional[float] = None


@dataclass(frozen=True)
class Template:
    id: str
    icon: str
    members: tuple[Member, ...]
    rules: tuple[dict, ...] = field(default_factory=tuple)


_SAFE_MONEY = ("Everything here is a simulated portfolio: never place a real order, move real money "
               "or connect to an exchange account.")

TEMPLATES: dict[str, Template] = {t.id: t for t in (
    Template("investing", "graph-line", (
        Member("invest-lead", "Head of investments", "",
               "Turns the owner's goals into research and review cards, and decides what reaches the owner.",
               "You lead the investment team. Split each goal into cards for the analyst, researcher and "
               "risk officer; read their reports and send the owner one clear recommendation. " + _SAFE_MONEY,
               10),
        Member("market-analyst", "Market analyst", "invest-lead",
               "Analyses coins and stocks: trend, indicators, key levels, scenarios.",
               "You analyse markets. Every analysis has the trend, key levels, the indicators you used, "
               "a bull and a bear case, and what would prove you wrong. " + _SAFE_MONEY, 15),
        Member("researcher", "Researcher", "market-analyst",
               "Finds sources, on-chain data and news; writes project fact sheets.",
               "You research. Cite every source with a date; separate facts from opinions; say what you "
               "could not verify.", 10),
        Member("risk-officer", "Risk officer", "invest-lead",
               "Checks allocation, concentration and stop-losses against the plan.",
               "You check risk. Compare every proposal with the plan's allocation limits, flag concentration "
               "and missing stop-losses, and say plainly when something should not go ahead. " + _SAFE_MONEY,
               5),
    ), (
        {"name": "Buy or sell decisions need my approval", "action": "owner",
         "keywords": ["buy", "sell", "rebalance", "allocate", "cumpăr", "vând", "rebalans", "alocare"]},
        {"name": "Risk officer checks the analyst's reports", "action": "verifier",
         "verifier": "risk-officer", "agents": ["market-analyst"]},
    )),
    Template("restaurant", "coffee", (
        Member("venue-lead", "Project lead", "",
               "Runs the restaurant launch plan: timeline, decisions, what the owner must sign off.",
               "You lead the launch of a small restaurant/café. Keep the plan and timeline, split work into "
               "cards for menu, marketing and finance, and bring the owner only decisions that need them.", 10),
        Member("menu-chef", "Menu & food cost", "venue-lead",
               "Designs the menu, recipes and portion costs; suggests suppliers.",
               "You design the menu. Every dish gets a recipe card, portion cost and selling price with the "
               "margin; note allergens and seasonal ingredients.", 10),
        Member("marketing", "Marketing", "venue-lead",
               "Brand, social media, opening campaign and local partnerships.",
               "You do marketing for a local restaurant: brand voice, social posts, the opening campaign and "
               "local partnerships. Draft; the owner publishes.", 5),
        Member("finance", "Finance & permits", "venue-lead",
               "Budget, cash flow, prices and the permits and paperwork to open.",
               "You keep the numbers: start-up budget, monthly cash flow, break-even, and the list of permits "
               "and registrations with their status. Mark anything you are unsure of for checking.", 5),
    ), (
        {"name": "Spending and contracts need my approval", "action": "owner",
         "keywords": ["contract", "pay", "order", "sign", "deposit", "plătesc", "comand", "semn", "avans"]},
        {"name": "Finance checks menu costs", "action": "verifier", "verifier": "finance",
         "agents": ["menu-chef"]},
    )),
    Template("research", "search", (
        Member("research-lead", "Research lead", "",
               "Plans research questions and assembles the final brief.",
               "You lead research: turn a question into sub-questions on cards, then assemble the final brief "
               "with a short answer first.", 10),
        Member("researcher", "Researcher", "research-lead",
               "Finds sources, on-chain data and news; writes project fact sheets.",
               "You research. Cite every source with a date; separate facts from opinions; say what you "
               "could not verify.", 10),
        Member("writer", "Writer", "research-lead",
               "Writes clear briefs and summaries from the research.",
               "You write: short sentences, the answer first, sources at the end.", 5),
        Member("fact-checker", "Fact-checker", "research-lead",
               "Checks claims and sources before a brief goes out.",
               "You fact-check: every claim against its source; list what is wrong, unsupported or outdated.", 5),
    ), (
        {"name": "Fact-checker checks every brief", "action": "verifier", "verifier": "fact-checker",
         "agents": ["writer"]},
    )),
    Template("personal", "person", (
        Member("chief-of-staff", "Chief of staff", "",
               "The owner's assistant: priorities, follow-ups, and what needs them today.",
               "You are the owner's chief of staff. Keep their priorities, follow up on open cards, and each "
               "morning list what needs them today.", 10),
        Member("planner", "Planner", "chief-of-staff",
               "Plans the week: schedule, errands, reminders.",
               "You plan the week: time blocks, errands and reminders; keep room for rest.", 5),
        Member("learning-coach", "Learning coach", "chief-of-staff",
               "Builds short learning plans and quizzes on topics the owner picks.",
               "You coach learning: short daily lessons, one exercise each, and a weekly recap.", 5),
    ), (
        {"name": "Messages and emails need my approval", "action": "owner",
         "keywords": ["email", "send", "message", "trimite", "mesaj"]},
    )),
)}


def catalog(existing: set[str]) -> list[dict]:
    """Every template with its members (and which names are already profiles) and rules."""
    return [{"id": t.id, "icon": t.icon,
             "members": [{"name": m.name, "title": m.title, "reports_to": m.reports_to,
                          "description": m.description, "budget_usd": m.budget_usd,
                          "exists": m.name in existing} for m in t.members],
             "rules": [dict(rule) for rule in t.rules]}
            for t in TEMPLATES.values()]


def _create_member(member: Member) -> None:
    from hermes_cli import profiles as profiles_mod, profiles_org
    from hermes_cli.kanban_agent_file import write_instructions

    home = profiles_mod.create_profile(member.name, clone_config=True, no_alias=True,
                                       description=member.description)
    write_instructions(home, f"# {member.title}\n\n{member.instructions}{_COMMON}\n")
    profiles_org.write_org(home, title=member.title, reports_to=member.reports_to)


def _join_chart(member: Member) -> None:
    """An existing profile with no manager yet takes its place under the team's."""
    from hermes_cli import profiles as profiles_mod, profiles_org

    home = profiles_mod.get_profile_dir(member.name)
    if member.reports_to and not profiles_org.read_org(home)["reports_to"]:
        profiles_org.write_org(home, reports_to=member.reports_to)


def _board_setup(conn: sqlite3.Connection, template: Template, created: list[str]) -> tuple[list[str], dict[str, float]]:
    from hermes_cli import kanban_db_controls as kbctl, kanban_db_rules as kbrules

    have = {rule["name"] for rule in kbrules.list_rules(conn)}
    rules = [kbrules.save_rule(conn, rule)["name"] for rule in template.rules if rule["name"] not in have]
    controls = kbctl.controls(conn)
    budgets = {m.name: m.budget_usd for m in template.members  # only the agents this install created
               if m.name in created and m.budget_usd and controls.get(m.name, {}).get("monthly_budget_usd") is None}
    for name, usd in budgets.items():
        kbctl.set_budget(conn, name, usd)
    return rules, budgets


def install(conn: sqlite3.Connection, template_id: str) -> dict:
    """Create the team's missing members, then add its rules and budgets to the board."""
    from hermes_cli import profiles as profiles_mod

    template = TEMPLATES.get(template_id)
    if template is None:
        raise LookupError(template_id)
    existing = {p.name for p in profiles_mod.list_profiles(lazy_skill_count=True)}
    created, kept = [], []
    for member in template.members:
        if member.name in existing:
            kept.append(member.name)
            _join_chart(member)
            continue
        _create_member(member)
        created.append(member.name)
    rules, budgets = _board_setup(conn, template, created)
    return {"template": template_id, "created": created, "kept": kept, "rules": rules, "budgets": budgets}
