"""The words and page shapes of Brain's notebook.

Every notebook page has the same shape, written for someone who has never seen it: a short plain
summary first, then the details. The model only supplies the content (``state``); the headings, the
order and the lists are drawn here, so the notebook looks the same page after page and a mistake in
one reply can never break its layout.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Callable

DEFAULT_LANGUAGE = "en"

_EN = {
    "start": "Start here", "about": "About you", "projects": "Projects", "conversations": "Conversations",
    "topics": "Topics", "todo": "What's next",
    "summary": "In short", "details": "Details", "decided": "What was decided", "next": "What's next",
    "learned": "What I learned about you", "status": "Status", "questions": "Open questions", "log": "Log",
    "talks": "Conversations", "points": "Key points", "updated": "Updated", "source": "From the conversation",
    "brain_updates": "Brain's updates", "nothing": "Nothing yet.",
    "active": "In progress", "blocked": "Blocked", "done": "Done", "idea": "Idea",
    "start_intro": "This is Brain's notebook. Brain writes here by itself, so you can always see what it knows and "
                   "what it has done. If something is wrong, just change it: Brain will keep your version.",
    "start_how": "How it is organised", "recent": "Recently updated",
    "start_about": "who you are and what Brain remembers about you",
    "start_projects": "one page for each project: its status, decisions and next steps",
    "start_conversations": "a short summary of each conversation, by month",
    "start_topics": "what you have talked about, by subject",
    "start_todo": "everything still left to do, in one place",
    "about_intro": "What Brain remembers about you. This is its real memory: if you change or delete a line here, "
                   "Brain changes or forgets it too.",
    "about_user": "About you", "about_memory": "Brain's own notes",
    "todo_intro": "Every step still open, from your projects and conversations.",
    "month": "Month", "no_project": "No project",
}

_RO = {
    "start": "Începe aici", "about": "Despre tine", "projects": "Proiecte", "conversations": "Conversații",
    "topics": "Teme", "todo": "Ce urmează",
    "summary": "Pe scurt", "details": "Detalii", "decided": "Ce s-a decis", "next": "Ce urmează",
    "learned": "Ce am aflat despre tine", "status": "Stadiu", "questions": "Întrebări deschise", "log": "Jurnal",
    "talks": "Conversații", "points": "Ideile principale", "updated": "Actualizat", "source": "Din conversația",
    "brain_updates": "Actualizările lui Brain", "nothing": "Încă nimic.",
    "active": "În lucru", "blocked": "Blocat", "done": "Terminat", "idea": "Idee",
    "start_intro": "Acesta e caietul lui Brain. Brain scrie aici singur, ca să poți vedea oricând ce știe și ce a "
                   "făcut. Dacă ceva e greșit, schimbă-l: Brain îți păstrează varianta.",
    "start_how": "Cum e organizat", "recent": "Actualizate recent",
    "start_about": "cine ești și ce ține minte Brain despre tine",
    "start_projects": "câte o pagină pentru fiecare proiect: stadiu, decizii și pașii următori",
    "start_conversations": "un rezumat scurt al fiecărei conversații, pe luni",
    "start_topics": "despre ce ai vorbit, pe subiecte",
    "start_todo": "tot ce mai e de făcut, într-un singur loc",
    "about_intro": "Ce ține minte Brain despre tine. Aceasta e memoria lui reală: dacă schimbi sau ștergi un rând "
                   "aici, Brain îl schimbă sau îl uită și el.",
    "about_user": "Despre tine", "about_memory": "Notițele lui Brain",
    "todo_intro": "Fiecare pas încă deschis, din proiectele și conversațiile tale.",
    "month": "Luna", "no_project": "Fără proiect",
}

_DE = {
    "start": "Hier beginnen", "about": "Über dich", "projects": "Projekte", "conversations": "Gespräche",
    "topics": "Themen", "todo": "Wie es weitergeht",
    "summary": "Kurz gesagt", "details": "Details", "decided": "Was entschieden wurde", "next": "Wie es weitergeht",
    "learned": "Was ich über dich gelernt habe", "status": "Stand", "questions": "Offene Fragen", "log": "Verlauf",
    "talks": "Gespräche", "points": "Die wichtigsten Punkte", "updated": "Aktualisiert", "source": "Aus dem Gespräch",
    "brain_updates": "Updates von Brain", "nothing": "Noch nichts.",
    "active": "In Arbeit", "blocked": "Blockiert", "done": "Erledigt", "idea": "Idee",
    "start_intro": "Das ist Brains Notizbuch. Brain schreibt hier selbst, damit du jederzeit siehst, was es weiß und "
                   "getan hat. Wenn etwas nicht stimmt, ändere es einfach: Brain behält deine Version.",
    "start_how": "So ist es aufgebaut", "recent": "Zuletzt aktualisiert",
    "start_about": "wer du bist und was Brain sich über dich merkt",
    "start_projects": "eine Seite pro Projekt: Stand, Entscheidungen und nächste Schritte",
    "start_conversations": "eine kurze Zusammenfassung jedes Gesprächs, nach Monaten",
    "start_topics": "worüber ihr gesprochen habt, nach Themen",
    "start_todo": "alles, was noch offen ist, an einem Ort",
    "about_intro": "Was Brain sich über dich merkt. Das ist sein echtes Gedächtnis: Änderst oder löschst du hier eine "
                   "Zeile, ändert oder vergisst Brain sie auch.",
    "about_user": "Über dich", "about_memory": "Brains eigene Notizen",
    "todo_intro": "Jeder noch offene Schritt aus deinen Projekten und Gesprächen.",
    "month": "Monat", "no_project": "Kein Projekt",
}

_ES = {
    "start": "Empieza aquí", "about": "Sobre ti", "projects": "Proyectos", "conversations": "Conversaciones",
    "topics": "Temas", "todo": "Lo que sigue",
    "summary": "En breve", "details": "Detalles", "decided": "Lo que se decidió", "next": "Lo que sigue",
    "learned": "Lo que aprendí sobre ti", "status": "Estado", "questions": "Preguntas abiertas", "log": "Registro",
    "talks": "Conversaciones", "points": "Ideas principales", "updated": "Actualizado", "source": "De la conversación",
    "brain_updates": "Actualizaciones de Brain", "nothing": "Todavía nada.",
    "active": "En curso", "blocked": "Bloqueado", "done": "Terminado", "idea": "Idea",
    "start_intro": "Este es el cuaderno de Brain. Brain escribe aquí por sí mismo, para que siempre veas lo que sabe "
                   "y lo que ha hecho. Si algo está mal, cámbialo: Brain conservará tu versión.",
    "start_how": "Cómo está organizado", "recent": "Actualizado hace poco",
    "start_about": "quién eres y qué recuerda Brain de ti",
    "start_projects": "una página por proyecto: estado, decisiones y próximos pasos",
    "start_conversations": "un resumen corto de cada conversación, por meses",
    "start_topics": "de qué habéis hablado, por temas",
    "start_todo": "todo lo pendiente, en un solo lugar",
    "about_intro": "Lo que Brain recuerda de ti. Es su memoria real: si cambias o borras una línea aquí, Brain "
                   "también la cambia o la olvida.",
    "about_user": "Sobre ti", "about_memory": "Notas propias de Brain",
    "todo_intro": "Cada paso aún abierto, de tus proyectos y conversaciones.",
    "month": "Mes", "no_project": "Sin proyecto",
}

_FR = {
    "start": "Commencer ici", "about": "À propos de vous", "projects": "Projets", "conversations": "Conversations",
    "topics": "Sujets", "todo": "La suite",
    "summary": "En bref", "details": "Détails", "decided": "Ce qui a été décidé", "next": "La suite",
    "learned": "Ce que j'ai appris sur vous", "status": "État", "questions": "Questions ouvertes", "log": "Journal",
    "talks": "Conversations", "points": "Points clés", "updated": "Mis à jour", "source": "De la conversation",
    "brain_updates": "Mises à jour de Brain", "nothing": "Rien pour l'instant.",
    "active": "En cours", "blocked": "Bloqué", "done": "Terminé", "idea": "Idée",
    "start_intro": "Voici le carnet de Brain. Brain y écrit lui-même, pour que vous voyiez toujours ce qu'il sait et "
                   "ce qu'il a fait. Si quelque chose est faux, modifiez-le : Brain garde votre version.",
    "start_how": "Comment c'est organisé", "recent": "Mis à jour récemment",
    "start_about": "qui vous êtes et ce que Brain retient de vous",
    "start_projects": "une page par projet : état, décisions et prochaines étapes",
    "start_conversations": "un court résumé de chaque conversation, par mois",
    "start_topics": "ce dont vous avez parlé, par sujet",
    "start_todo": "tout ce qui reste à faire, au même endroit",
    "about_intro": "Ce que Brain retient de vous. C'est sa vraie mémoire : si vous modifiez ou supprimez une ligne "
                   "ici, Brain la modifie ou l'oublie aussi.",
    "about_user": "À propos de vous", "about_memory": "Notes propres de Brain",
    "todo_intro": "Chaque étape encore ouverte, de vos projets et conversations.",
    "month": "Mois", "no_project": "Sans projet",
}

LABELS: dict[str, dict[str, str]] = {"en": _EN, "ro": _RO, "de": _DE, "es": _ES, "fr": _FR}
STATUSES = ("active", "blocked", "done", "idea")


def labels(language: str | None) -> dict[str, str]:
    return LABELS.get((language or "").lower()[:2], _EN)


def _bullets(items: list[str], empty: str) -> str:
    rows = [f"- {text}" for text in items if text]
    return "\n".join(rows) if rows else f"_{empty}_"


def _section(title: str, body: str) -> str:
    return f"## {title}\n\n{body}\n"


def _stamp(epoch: float | None, fmt: str = "%Y-%m-%d") -> str:
    return datetime.fromtimestamp(epoch).strftime(fmt) if epoch else ""


def _footer(L: dict[str, str], updated: float | None) -> str:
    return f"\n---\n{L['updated']}: {_stamp(updated, '%Y-%m-%d %H:%M')}\n"


def _decisions(items: list[dict[str, Any]]) -> list[str]:
    return [f"{d.get('text', '')}" + (f" — _{d['why']}_" if d.get("why") else "") for d in items if d.get("text")]


def render_conversation(L: dict[str, str], s: dict[str, Any], updated: float | None) -> str:
    parts = [f"# {s.get('title') or ''}\n", f"> {s.get('summary') or ''}\n"]
    parts.append(_section(L["decided"], _bullets(_decisions(s.get("decisions") or []), L["nothing"])))
    parts.append(_section(L["next"], "\n".join(f"- [ ] {t}" for t in s.get("next") or [] if t) or f"_{L['nothing']}_"))
    if s.get("learned"):
        parts.append(_section(L["learned"], _bullets(s["learned"], L["nothing"])))
    if s.get("details"):
        parts.append(_section(L["details"], str(s["details"])))
    parts.append(f"\n{L['source']}: {_stamp(s.get('date'))}")
    return "\n".join(parts) + _footer(L, updated)


def render_project(L: dict[str, str], s: dict[str, Any], updated: float | None) -> str:
    status = s.get("status") if s.get("status") in STATUSES else "active"
    parts = [f"# {s.get('name') or ''}\n", f"**{L['status']}:** {L[status]}\n", f"> {s.get('summary') or ''}\n"]
    parts.append(_section(L["decided"], _bullets(_decisions(s.get("decisions") or []), L["nothing"])))
    parts.append(_section(L["next"], "\n".join(f"- [ ] {t}" for t in s.get("next") or [] if t) or f"_{L['nothing']}_"))
    parts.append(_section(L["questions"], _bullets(s.get("questions") or [], L["nothing"])))
    parts.append(_section(L["talks"], _bullets(
        [f"{c.get('date', '')} · {c.get('title', '')}".strip(" ·") for c in (s.get("talks") or [])[-12:][::-1]],
        L["nothing"])))
    parts.append(_section(L["log"], _bullets(
        [f"{e.get('date', '')}: {e.get('text', '')}" for e in (s.get("log") or [])[-20:][::-1]], L["nothing"])))
    return "\n".join(parts) + _footer(L, updated)


def render_topic(L: dict[str, str], s: dict[str, Any], updated: float | None) -> str:
    parts = [f"# {s.get('name') or ''}\n", f"> {s.get('summary') or ''}\n"]
    parts.append(_section(L["points"], _bullets(s.get("points") or [], L["nothing"])))
    parts.append(_section(L["talks"], _bullets(
        [f"{c.get('date', '')} · {c.get('title', '')}".strip(" ·") for c in (s.get("talks") or [])[-12:][::-1]],
        L["nothing"])))
    return "\n".join(parts) + _footer(L, updated)


def render_about(L: dict[str, str], s: dict[str, Any], updated: float | None) -> str:
    parts = [f"# {L['about']}\n", f"> {L['about_intro']}\n"]
    parts.append(_section(L["about_user"], _bullets(s.get("user") or [], L["nothing"])))
    parts.append(_section(L["about_memory"], _bullets(s.get("memory") or [], L["nothing"])))
    return "\n".join(parts) + _footer(L, updated)


def render_todo(L: dict[str, str], s: dict[str, Any], updated: float | None) -> str:
    parts = [f"# {L['todo']}\n", f"> {L['todo_intro']}\n"]
    groups = s.get("groups") or []
    if not groups:
        parts.append(f"_{L['nothing']}_\n")
    for group in groups:
        parts.append(_section(group.get("title") or L["no_project"], "\n".join(f"- [ ] {t}" for t in group.get("next") or [])))
    return "\n".join(parts) + _footer(L, updated)


def render_start(L: dict[str, str], s: dict[str, Any], updated: float | None) -> str:
    how = [("about", "start_about"), ("projects", "start_projects"), ("conversations", "start_conversations"),
           ("topics", "start_topics"), ("todo", "start_todo")]
    parts = [f"# {L['start']}\n", f"> {L['start_intro']}\n",
             _section(L["start_how"], "\n".join(f"- **{L[name]}** — {L[text]}" for name, text in how))]
    recent = [f"{r.get('date', '')} · {r.get('title', '')}".strip(" ·") for r in s.get("recent") or []]
    parts.append(_section(L["recent"], _bullets(recent, L["nothing"])))
    return "\n".join(parts) + _footer(L, updated)


RENDERERS: dict[str, Callable[[dict[str, str], dict[str, Any], float | int | None], str]] = {
    "conversation": render_conversation, "project": render_project, "topic": render_topic,
    "about": render_about, "todo": render_todo, "start": render_start,
}
