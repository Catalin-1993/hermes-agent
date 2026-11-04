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

# Pages added after the first release: "How Brain works" and one overview per other profile.
_X = {
    "en": {
        "work": "How Brain works", "profiles": "Profiles", "profile": "Profile", "overview": "Overview",
        "work_intro": "How Brain works and what it has learned to do. Written from its memory and from what its "
                      "skill curator does, so you can check both.",
        "remembers": "What Brain remembers", "remembers_line": "{u} notes about you and {m} notes of its own. "
                                                               "You can read and correct them in “About you”.",
        "skills": "Skills Brain learned", "skill_active": "active", "skill_stale": "not used lately",
        "skill_archived": "archived", "used": "used {n} times", "patched": "improved {n} times",
        "curator": "What the curator did", "curator_none": "The curator has not changed anything yet.",
        "curator_state": "The curator is {state}. Last check: {when}.", "on": "on", "off": "off", "never": "never",
        "archived_x": "archived", "auto_x": "automatic check", "merged_x": "merged into", "added_x": "new skill", "moved_x": "changed from {a} to {b}",
        "start_work": "how Brain works: what it remembers, the skills it learned and what its curator did",
        "start_profiles": "what your other profiles decided and said, one folder each",
        "profile_intro": "What this profile decided and said, from its conversations.",
    },
    "ro": {
        "work": "Cum lucrează Brain", "profiles": "Profiluri", "profile": "Profil", "overview": "Privire de ansamblu",
        "work_intro": "Cum lucrează Brain și ce a învățat să facă. Scris din memoria lui și din ce face curatorul de "
                      "abilități, ca să poți verifica ambele.",
        "remembers": "Ce ține minte Brain", "remembers_line": "{u} notițe despre tine și {m} notițe proprii. Le poți "
                                                              "citi și corecta în „Despre tine”.",
        "skills": "Abilități învățate de Brain", "skill_active": "activă", "skill_stale": "nefolosită de curând",
        "skill_archived": "arhivată", "used": "folosită de {n} ori", "patched": "îmbunătățită de {n} ori",
        "curator": "Ce a făcut curatorul", "curator_none": "Curatorul n-a schimbat încă nimic.",
        "curator_state": "Curatorul este {state}. Ultima verificare: {when}.", "on": "pornit", "off": "oprit",
        "never": "niciodată", "archived_x": "arhivat", "auto_x": "verificare automată", "merged_x": "îmbinat în", "added_x": "abilitate nouă",
        "moved_x": "schimbat din {a} în {b}",
        "start_work": "cum lucrează Brain: ce ține minte, abilitățile învățate și ce a făcut curatorul lui",
        "start_profiles": "ce au decis și ce au spus celelalte profiluri ale tale, câte un folder fiecare",
        "profile_intro": "Ce a decis și ce a spus acest profil, din conversațiile lui.",
    },
    "de": {
        "work": "Wie Brain arbeitet", "profiles": "Profile", "profile": "Profil", "overview": "Überblick",
        "work_intro": "Wie Brain arbeitet und was es gelernt hat. Geschrieben aus seinem Gedächtnis und aus dem, was "
                      "sein Skill-Kurator tut, damit du beides prüfen kannst.",
        "remembers": "Was Brain sich merkt", "remembers_line": "{u} Notizen über dich und {m} eigene Notizen. Du kannst "
                                                              "sie unter „Über dich“ lesen und korrigieren.",
        "skills": "Von Brain gelernte Fähigkeiten", "skill_active": "aktiv", "skill_stale": "zuletzt ungenutzt",
        "skill_archived": "archiviert", "used": "{n}-mal benutzt", "patched": "{n}-mal verbessert",
        "curator": "Was der Kurator getan hat", "curator_none": "Der Kurator hat noch nichts geändert.",
        "curator_state": "Der Kurator ist {state}. Letzte Prüfung: {when}.", "on": "an", "off": "aus",
        "never": "nie", "archived_x": "archiviert", "auto_x": "automatische Prüfung", "merged_x": "zusammengeführt in", "added_x": "neue Fähigkeit",
        "moved_x": "von {a} zu {b} geändert",
        "start_work": "wie Brain arbeitet: was es sich merkt, welche Fähigkeiten es gelernt hat und was sein Kurator tat",
        "start_profiles": "was deine anderen Profile entschieden und gesagt haben, je ein Ordner",
        "profile_intro": "Was dieses Profil entschieden und gesagt hat, aus seinen Gesprächen.",
    },
    "es": {
        "work": "Cómo trabaja Brain", "profiles": "Perfiles", "profile": "Perfil", "overview": "Resumen general",
        "work_intro": "Cómo trabaja Brain y qué ha aprendido a hacer. Escrito a partir de su memoria y de lo que hace su "
                      "curador de habilidades, para que puedas comprobar ambas.",
        "remembers": "Lo que Brain recuerda", "remembers_line": "{u} notas sobre ti y {m} notas propias. Puedes leerlas y "
                                                               "corregirlas en «Sobre ti».",
        "skills": "Habilidades que Brain aprendió", "skill_active": "activa", "skill_stale": "sin usar últimamente",
        "skill_archived": "archivada", "used": "usada {n} veces", "patched": "mejorada {n} veces",
        "curator": "Lo que hizo el curador", "curator_none": "El curador todavía no ha cambiado nada.",
        "curator_state": "El curador está {state}. Última revisión: {when}.", "on": "activado", "off": "desactivado",
        "never": "nunca", "archived_x": "archivada", "auto_x": "revisión automática", "merged_x": "fusionada en", "added_x": "habilidad nueva",
        "moved_x": "cambiada de {a} a {b}",
        "start_work": "cómo trabaja Brain: qué recuerda, las habilidades aprendidas y lo que hizo su curador",
        "start_profiles": "lo que decidieron y dijeron tus otros perfiles, una carpeta cada uno",
        "profile_intro": "Lo que este perfil decidió y dijo, a partir de sus conversaciones.",
    },
    "fr": {
        "work": "Comment Brain travaille", "profiles": "Profils", "profile": "Profil", "overview": "Vue d'ensemble",
        "work_intro": "Comment Brain travaille et ce qu'il a appris à faire. Écrit à partir de sa mémoire et de ce que "
                      "fait son curateur de compétences, pour que vous puissiez vérifier les deux.",
        "remembers": "Ce que Brain retient", "remembers_line": "{u} notes sur vous et {m} notes personnelles. Vous pouvez "
                                                              "les lire et les corriger dans « À propos de vous ».",
        "skills": "Compétences apprises par Brain", "skill_active": "active", "skill_stale": "peu utilisée",
        "skill_archived": "archivée", "used": "utilisée {n} fois", "patched": "améliorée {n} fois",
        "curator": "Ce que le curateur a fait", "curator_none": "Le curateur n'a encore rien changé.",
        "curator_state": "Le curateur est {state}. Dernière vérification : {when}.", "on": "activé", "off": "désactivé",
        "never": "jamais", "archived_x": "archivée", "auto_x": "vérification automatique", "merged_x": "fusionnée dans", "added_x": "nouvelle compétence",
        "moved_x": "passée de {a} à {b}",
        "start_work": "comment Brain travaille : ce qu'il retient, les compétences apprises et ce qu'a fait son curateur",
        "start_profiles": "ce que vos autres profils ont décidé et dit, un dossier chacun",
        "profile_intro": "Ce que ce profil a décidé et dit, à partir de ses conversations.",
    },
}
for _lang, _words in _X.items():
    LABELS[_lang].update(_words)

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
    parts = [f"# {s.get('title') or ''}\n"]
    if s.get("profile"):
        parts.append(f"**{L['profile']}:** {s['profile']}\n")
    parts.append(f"> {s.get('summary') or ''}\n")
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
    how = [("about", "start_about"), ("work", "start_work"), ("projects", "start_projects"),
           ("conversations", "start_conversations"), ("topics", "start_topics"), ("profiles", "start_profiles"),
           ("todo", "start_todo")]
    parts = [f"# {L['start']}\n", f"> {L['start_intro']}\n",
             _section(L["start_how"], "\n".join(f"- **{L[name]}** — {L[text]}" for name, text in how))]
    recent = [f"{r.get('date', '')} · {r.get('title', '')}".strip(" ·") for r in s.get("recent") or []]
    parts.append(_section(L["recent"], _bullets(recent, L["nothing"])))
    return "\n".join(parts) + _footer(L, updated)


def render_work(L: dict[str, str], s: dict[str, Any], updated: float | None) -> str:
    parts = [f"# {L['work']}\n", f"> {L['work_intro']}\n"]
    parts.append(_section(L["remembers"], L["remembers_line"].format(u=s.get("user_n", 0), m=s.get("memory_n", 0))))
    rows = []
    for skill in s.get("skills") or []:
        bits = [L.get("skill_" + str(skill.get("state")), str(skill.get("state") or ""))]
        if skill.get("uses"):
            bits.append(L["used"].format(n=skill["uses"]))
        if skill.get("patches"):
            bits.append(L["patched"].format(n=skill["patches"]))
        rows.append(f"**{skill.get('name')}** — " + " · ".join(bits))
    parts.append(_section(L["skills"], _bullets(rows, L["nothing"])))
    cur = s.get("curator") or {}
    state = L["on"] if cur.get("enabled") else L["off"]
    when = _stamp(cur.get("last_run"), "%Y-%m-%d %H:%M") or L["never"]
    actions = []
    for a in s.get("actions") or []:
        verb = L.get(f"{a.get('kind')}_x", a.get("kind") or "")
        line = f"{a.get('date', '')} · {verb} **{a.get('name')}**"
        if a.get("kind") == "merged" and a.get("into"):
            line = f"{a.get('date', '')} · **{a.get('name')}** {verb} **{a['into']}**"
        elif a.get("kind") == "auto":
            line = (f"{a.get('date', '')} · {L['auto_x']}: {a.get('archived', 0)} {L['archived_x']}, "
                    f"{a.get('stale', 0)} {L['skill_stale']}")
        elif a.get("kind") == "moved":
            line = f"{a.get('date', '')} · **{a.get('name')}** " + L["moved_x"].format(a=a.get("a"), b=a.get("b"))
        if a.get("reason"):
            line += f" — _{a['reason']}_"
        actions.append(line)
    body = L["curator_state"].format(state=state, when=when) + "\n\n" + _bullets(actions, L["curator_none"])
    parts.append(_section(L["curator"], body))
    return "\n".join(parts) + _footer(L, updated)


def render_profile(L: dict[str, str], s: dict[str, Any], updated: float | None) -> str:
    parts = [f"# {s.get('name') or ''}\n", f"> {L['profile_intro']}\n"]
    parts.append(_section(L["decided"], _bullets(
        [f"{d.get('date', '')} · {d.get('text', '')}" + (f" — _{d['why']}_" if d.get("why") else "")
         for d in s.get("decisions") or []], L["nothing"])))
    parts.append(_section(L["next"], "\n".join(f"- [ ] {t}" for t in s.get("next") or []) or f"_{L['nothing']}_"))
    parts.append(_section(L["talks"], _bullets(
        [f"{t.get('date', '')} · **{t.get('title', '')}** — {t.get('summary', '')}" for t in s.get("talks") or []],
        L["nothing"])))
    return "\n".join(parts) + _footer(L, updated)


RENDERERS: dict[str, Callable[[dict[str, str], dict[str, Any], float | int | None], str]] = {
    "conversation": render_conversation, "project": render_project, "topic": render_topic,
    "about": render_about, "todo": render_todo, "start": render_start, "work": render_work,
    "profile": render_profile,
}
