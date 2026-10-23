"""The team's org chart: each profile's job title and the profile it reports to.

Both live in the profile's ``profile.yaml`` under ``org`` (``{title, reports_to}``), next to
the description the kanban decomposer routes on, so they travel with the profile and hold on
every board. The chart is advisory: it tells the decomposer and each worker who leads whom,
so work is handed down to the right report and questions go up to the right manager; nothing
here gates a claim.

A manager that no longer exists (deleted profile) reads as no manager. A manager renamed
since is followed through its ``previous_names``. A chart edited by hand into a loop is cut
where the loop closes, so every agent still has one chain up to a top.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

TITLE_MAX = 60


def _profiles():
    from hermes_cli import profiles as profiles_mod

    return profiles_mod


def read_org(profile_dir: Path) -> dict:
    """``{title, reports_to}`` from ``profile.yaml`` (empty strings when unset). Never raises."""
    profiles_mod = _profiles()
    path = profile_dir / "profile.yaml"

    def _read() -> dict:
        org = (profiles_mod._load_yaml_dict(path) or {}).get("org")
        org = org if isinstance(org, dict) else {}
        return {"title": str(org.get("title") or "").strip()[:TITLE_MAX],
                "reports_to": str(org.get("reports_to") or "").strip()}

    return dict(profiles_mod._cached_profile_read(path, "profile-org", _read))


def write_org(profile_dir: Path, *, title: Optional[str] = None, reports_to: Optional[str] = None) -> None:
    """Set the passed fields (an empty string clears one); other ``profile.yaml`` keys are kept."""
    if not profile_dir.is_dir():
        raise FileNotFoundError(f"profile directory does not exist: {profile_dir}")
    from utils import atomic_yaml_write

    path = profile_dir / "profile.yaml"
    existing: dict = _profiles()._load_yaml_dict(path) or {}
    org = dict(existing.get("org") or {}) if isinstance(existing.get("org"), dict) else {}
    for key, value in (("title", title), ("reports_to", reports_to)):
        if value is None:
            continue
        value = value.strip()[:TITLE_MAX] if key == "title" else value.strip()
        if value:
            org[key] = value
        else:
            org.pop(key, None)
    if org:
        existing["org"] = org
    else:
        existing.pop("org", None)
    atomic_yaml_write(path, existing, sort_keys=False)


def _resolve(manager: str, names: set[str], renamed: dict[str, str]) -> str:
    if manager in names:
        return manager
    return renamed.get(manager, "")


def _cut_loops(rows: dict[str, dict]) -> None:
    """Drop the manager link that closes a loop (A → B → A), so every chain ends at a top."""
    for start in sorted(rows):
        seen = {start}
        node = start
        while rows[node]["reports_to"]:
            boss = rows[node]["reports_to"]
            if boss in seen:
                rows[node]["reports_to"] = ""
                break
            seen.add(boss)
            node = boss


def chart(profiles: Optional[list] = None) -> dict[str, dict]:
    """Every profile by name: ``{title, reports_to, reports}`` with managers resolved
    (renames followed, missing ones dropped, loops cut) and ``reports`` the direct reports."""
    profiles_mod = _profiles()
    profiles = profiles_mod.list_profiles(lazy_skill_count=True) if profiles is None else profiles
    names = {p.name for p in profiles}
    renamed = {old: p.name for p in profiles for old in (p.previous_names or []) if old not in names}
    rows: dict[str, dict] = {}
    for p in profiles:
        org = read_org(Path(p.path))
        boss = _resolve(org["reports_to"], names, renamed)
        rows[p.name] = {"title": org["title"], "reports_to": "" if boss == p.name else boss, "reports": []}
    _cut_loops(rows)
    for name in sorted(rows):
        boss = rows[name]["reports_to"]
        if boss:
            rows[boss]["reports"].append(name)
    return rows


def manager_problem(name: str, manager: str, rows: dict[str, dict]) -> Optional[str]:
    """Why ``name`` may not report to ``manager``: ``self``, ``unknown`` or ``loop``
    (``manager`` already reports, directly or not, to ``name``); ``None`` when it may."""
    if not manager:
        return None
    if manager == name:
        return "self"
    if manager not in rows:
        return "unknown"
    node, seen = manager, set()
    while node and node not in seen:
        if node == name:
            return "loop"
        seen.add(node)
        node = rows[node]["reports_to"]
    return None


def set_org(name: str, *, title: Optional[str] = None, reports_to: Optional[str] = None) -> dict:
    """Validate and save one profile's place in the chart; returns the updated chart.
    Raises ``LookupError`` for an unknown profile and ``ValueError(<problem>)`` for a
    manager it may not report to."""
    profiles_mod = _profiles()
    canon = profiles_mod.normalize_profile_name(name)
    rows = chart()
    if canon not in rows:
        raise LookupError(canon)
    manager = None
    if reports_to is not None:
        manager = profiles_mod.normalize_profile_name(reports_to) if reports_to.strip() else ""
        problem = manager_problem(canon, manager, rows)
        if problem:
            raise ValueError(problem)
    write_org(profiles_mod.get_profile_dir(canon), title=title, reports_to=manager)
    return chart()


def _label(name: str, rows: dict[str, dict]) -> str:
    title = rows.get(name, {}).get("title")
    return f"`{name}` ({title})" if title else f"`{name}`"


def team_context(name: Optional[str]) -> list[str]:
    """The worker-context section telling ``name`` its place in the chart, or nothing
    when it has neither a title, a manager nor reports."""
    if not name:
        return []
    try:
        rows = chart()
    except Exception:  # health: allow BLE001 -- the chart is advisory; a broken profile.yaml must not stop a worker
        return []
    row = rows.get(name)
    if not row or not (row["title"] or row["reports_to"] or row["reports"]):
        return []
    lines = ["## Your team", f"Your role: {row['title'] or name}"]
    if row["reports_to"]:
        lines.append(f"You report to {_label(row['reports_to'], rows)}: hand questions or decisions "
                     "above your role up to them as a card (`kanban_create`, assignee = their name).")
    if row["reports"]:
        names = ", ".join(_label(r, rows) for r in row["reports"])
        lines.append(f"Your direct reports: {names}. Delegate the parts of this task that fit their "
                     "roles with `kanban_create` (assignee = their name), then review what they return.")
    lines.append("")
    return lines


def roster_tag(name: str, rows: dict[str, dict]) -> str:
    """`` [Title, reports to boss]`` for the decomposer's roster line, or ``""``."""
    row = rows.get(name) or {}
    bits = [row["title"]] if row.get("title") else []
    if row.get("reports_to"):
        bits.append(f"reports to {row['reports_to']}")
    return f" [{', '.join(bits)}]" if bits else ""
