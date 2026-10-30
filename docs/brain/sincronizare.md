# Sincronizarea cu comunitatea (Hermes Agent)

Brain păstrează proiectul comunității ca bază și îi aduce periodic
actualizările, fără să piardă modificările proprii.

## Cum funcționează

| Ramură / remote | Ce este |
|---|---|
| `upstream` → `NousResearch/hermes-agent` | Proiectul comunității |
| `origin` → `Catalin-1993/hermes-agent` | Proiectul tău pe GitHub |
| `brain/…` | Ramurile cu lucrul tău |
| `sync/upstream-AAAA-LL-ZZ` | O sincronizare: lucrul tău + ultimele actualizări ale comunității |

**Pașii unei sincronizări**

1. Se descarcă ultima versiune a comunității (`git fetch upstream`).
2. Se face o ramură nouă `sync/upstream-<data>` din ramura ta curentă.
3. Se îmbină `upstream/main` în ea (`git merge`). Istoricul ambelor părți se
   păstrează, deci se vede mereu ce vine de la comunitate și ce e al tău.
4. Unde ambele părți au schimbat aceleași rânduri (*conflicte*), fiecare caz
   se rezolvă de mână, după regulile de mai jos.
5. Se verifică: verificarea tipurilor (TypeScript), testele aplicației
   desktop și testele backend-ului.
6. Se trimite pe GitHub și se notează aici ce s-a decis.

**Regulile de rezolvare a conflictelor**

- **Funcțiile tale rămân.** Dacă o funcție Brain și o schimbare a comunității
  ating același loc, se păstrează amândouă.
- **Reparațiile comunității intră.** Când comunitatea a reparat o eroare, se
  ia reparația, iar modificarea ta se mută peste ea.
- **Structura nouă a comunității se adoptă.** Dacă au reorganizat un fișier,
  se ia organizarea lor și se pun la loc bucățile tale în ea.
- **Numele Brain se păstrează** în textele vizibile, și în cele noi venite
  de la comunitate.
- **Orice alegere care renunță la ceva** se notează în jurnalul de mai jos.

---

## Jurnal

### 30 octombrie 2026 — `sync/upstream-2026-10-30`

**Înainte de îmbinare:** folderul local era rămas la baza v0.21.7, iar
`main` de pe GitHub conținea deja sincronizarea din 25 octombrie (v0.22.5)
plus 72 de commit-uri Brain. Singurul commit local nepublicat („figuri în chat
fără chenar”, `8f454720cb`) fusese deja refăcut pe GitHub (`36b52f1ac0`);
e păstrat pe ramura locală `backup/local-main-2026-10-30`. Sincronizarea
pornește din `origin/main`.

**Ce a venit de la comunitate:** 1.754 de commit-uri (1.734 fără îmbinări),
până la `690da2b7be` din 30 octombrie 2026. Printre ele:

- cardul de eroare v2 (gravitate, o singură acțiune, detalii de copiat);
- cron: oprirea unei rulări în curs și politica pentru rulările ratate;
- un formular unic pentru întrebările multiple (*clarify*);
- notificări în browser și clipirea iconiței în dock/taskbar;
- *Webapp*: pluginuri desktop în browser, documentele de previzualizare
  izolate de politica paginii, profiluri „nedeservite” afișate dezactivat;
- zeci de pluginuri noi în catalog și sute de reparații.

**Conflicte:** 17 fișiere. Cum s-au rezolvat:

| Zona | Decizia |
|---|---|
| Meniul de profil | Păstrat butonul tău „Edit”, mutat într-o funcție separată; adăugată starea nouă a comunității „Not served here” pe rânduri |
| Previzualizarea artefactelor | Păstrate bannerul de rețea și bara de unelte a widget-ului; iframe-ul e înlocuit cu `PreviewDocumentFrame` al comunității (izolare în Webapp) |
| `::preview` în chat | Păstrat cadrul tău unificat `WidgetFrame` (comunitatea își păstrează iframe-ul separat) |
| Taburile panourilor (`pane-mirror`) | Păstrat `bare` al tău + structura nouă `tabChrome` |
| Notificări în browser | Funcția nouă a comunității (clipire în tab, sesiune deschisă la click), cu titlul implicit „Brain” |
| Mesaje de eroare și traduceri | Textele noi ale comunității, cu numele Brain |
| Numele Brain | 75 de apariții „Hermes” din textele noi de traducere + ecranul „nu s-a putut încărca” (`BRAIN`, „Brain couldn’t load”). Excepții, ca înainte: comenzile `hermes …`, „Hermes Agent”, mesajele interne și dialogurile Electron de actualizare |

**Reparat după îmbinare:** `new-session-tab.ts` acceptă că funcția Brain
`openNewSessionTile` întoarce id-ul sesiunii; testele noi ale meniului de
profil adaptate la designul tău (fără meniul din bara de stare).

**Pachete:** reinstalate din `package-lock.json` (`npm ci`); folderul local
avea pachete vechi (de ex. `simple-git`).

### 25 octombrie 2026 — `sync/upstream-2026-10-25`

**Înainte de îmbinare:** `main` și `main-kbw61z` erau identice (`5aac31c`),
deci tot lucrul tău era pe `main`. Copie de siguranță pe GitHub:
ramura `backup/main-inainte-de-sync-2026-10-25`.

**Ce a venit de la comunitate:** 7.397 de commit-uri (7.114 fără îmbinări),
până la `8084684936` din 25 octombrie 2026. Printre ele:

- catalogul de pluginuri refăcut (niveluri Official / Verified / Community,
  imagini, buton *Update*, instalare cu „+”), pagina *Capabilities* reorganizată;
- *Webapp*: aplicația desktop se poate deschide și din browser, servită de
  gateway (setarea *Web Access*);
- chat de grup (redenumire, desființare, mențiuni), fixarea sesiunilor prin
  tragere în bara laterală, rutare pentru subagenți (*Delegation routing*);
- sute de reparații în aplicația desktop, gateway, CLI, cron și agent.

**Conflicte:** 69 de fișiere. Cum s-au rezolvat:

| Zona | Decizia |
|---|---|
| Agent (`run_agent`, `agent_init`, callback-uri) | Structura nouă a comunității (parametrii în `agent_init_params.py`); callback-ul tău de acord Library adăugat în ea. Comunitatea a scos `setup_choose` (înlocuit cu `theme_callback` + `setup_beat_callback`) — acceptat |
| Identitatea „Brain, dezvoltat de Vasi Catalin” | Păstrată; textul de ajutor folosește noua formulare a comunității, cu numele Brain |
| Kanban (contextul worker-ului) | Comunitatea a mutat aceleași funcții în `kanban_db_context.py`; funcția ta `place_context` (echipa + obiectivul cardului) pusă în fișierul lor |
| Library | Butonul „Salvează în Library” readus pe noua bară de acțiuni a mesajului, și în meniul de pe ecran tactil |
| Meniul de aprobări | Păstrat în caseta de chat (nu în bara de stare); preluată reparația comunității: întreabă gateway-ul abia după ce conexiunea e deschisă |
| Bara de stare | Păstrat aspectul tău: fără folderul de lucru, fără aprobări, cu sursele de mesagerie. Noul „Change workspace” al comunității nu e afișat acolo; folderul se schimbă din meniul de folder al casetei de chat |
| Bara de sus | Clopoțelul de notificări, bara laterală cu deschidere la hover și aliniere la marginea ei păstrate; preluată reparația comunității pentru ecranele înguste din browser. Butoanele rămân pe locul tău și pe ecran complet |
| Profilul din bara laterală | Păstrat butonul tău „Edit” (nume, poză); preluat meniul comunității de click-dreapta din Webapp |
| Electron | Păstrat Referer-ul pentru embed-uri; adăugată noua conexiune locală a comunității (bilet de unică folosință), cu Referer-ul aplicat și ei |
| Fișiere șterse de comunitate (`apply_layout_tool`, `start_chat`, opțiunile vechi de onboarding) | Acceptate: aveai în ele doar redenumirea Hermes → Brain |
| Dependențe | Versiunile noi ale comunității + pachetele tale (BlockNote, ECharts, lightweight-charts, MapLibre, docx-preview); `package-lock.json` regenerat |
| Traduceri | Structura nouă a comunității (încă secțiuni mutate în fișiere separate). Secțiunile tale (`library`, `inlineWidget`, `floatingVideo`, titlul cardului de întrebări) păstrate în toate limbile; pentru arabă și chineza tradițională rămân în `ar_brain.ts` / `zh-hant_brain.ts` |
| Numele Brain | 384 de apariții „Hermes” din textele noi ale comunității înlocuite cu „Brain”, în toate limbile, plus 8 mesaje vizibile din aplicație (de ex. „Brain ended this turn without a reply”). Excepții: termenii de utilizare și mesajele tehnice interne |

**Nimic din funcțiile tale n-a trebuit scos.** O verificare automată a
căutat fiecare rând adăugat de tine luna aceasta: cele care lipsesc din locul
vechi sunt fie mutate în fișierele noi ale comunității, fie în cele trei
fișiere șterse de comunitate (unde aveai doar redenumiri).

**Reparat după îmbinare** (regulile noi ale comunității au prins bucăți Brain):
pornirea serviciului Portofoliu folosește acum funcția comunității pentru
variabilele de mediu; butoanele de alegere din Portofoliu au tooltip-ul
aplicației în loc de cel nativ; două funcții simplificate (meniul de profil,
cardul de întrebări) ca să rămână sub limita de complexitate; o cerere fără
nimic de schimbat (de ex. embed YouTube) e lăsată neatinsă. Testele
comunității care presupuneau aspectul lor (Kanban deschis pe *Board*, ușa de
profil din bara de stare, butonul de setări din bara de sus, numele Hermes)
au fost adaptate la designul tău.

**Verificare**

| Ce | Rezultat |
|---|---|
| Verificarea tipurilor (desktop, Electron) | 0 erori |
| Testele aplicației desktop | 16.211 trecute; după reparații, 4 rămase picate (`voice-prefs`, `dead-session-prune`, `plugin-preview`): fișiere neatinse de tine, legate de mediul de test (Node 22; proiectul cere Node 26) |
| Testele backend (Kanban, gateway TUI, agent, Portofoliu) | trecute, cu excepția a 4 fișiere ale comunității legate de mediul de aici (`keyring` lipsă, dosarul `~/.hermes` real, un test de temporizare) |
| ESLint pe fișierele atinse | curat |
| Controlul de complexitate | cele două funcții semnalate din zona îmbinării, reparate; rămân 12 semnalări în cod al comunității (gateway, alegerea modelului) mutat în fișiere noi, pe care nu le-ai atins, care dispar ca semnalări după acest push |

### 12 octombrie 2026 — `sync/upstream-2026-10-12`

**Ce a venit de la comunitate:** 5.201 commit-uri (5.126 fără îmbinări),
până la `eefdfe0692` din 12 octombrie 2026. Printre ele:

- sute de reparații în aplicația desktop, actualizări, gateway, cron, agent;
- catalog de pluginuri și *Settings ▸ Plugins*;
- favorite și fixare în meniul de modele, niveluri de viteză (Standard / Fast
  / Ultrafast), avertisment înainte de limita abonamentului;
- *keep-awake* doar cât lucrează agentul, ora mesajului la hover;
- dimensiunea textului din chat separată de restul interfeței;
- ecranul de început refăcut (onboarding cu carduri de alegere);
- butonul din stânga al barei de sus acționează asupra coloanei aflate fizic
  în stânga, și după inversarea panourilor.

**Conflicte:** 60 de fișiere. Cum s-au rezolvat:

| Zona | Decizia |
|---|---|
| Library (backend, unelte, contracte) | Ambele: unealta `library` lângă noul `catalog` al comunității; callback-ul de acord Library lângă `setup_choose` |
| Bara de sus (`titlebar-controls`) | Logica nouă a comunității pentru stânga/dreapta + deschiderea ta la hover, butonul aliniat cu bara laterală și clopoțelul de notificări |
| Chat lângă document (`session-tile`, `pane-mirror`) | Cadrul tău *companion* păstrat, plus acțiunea nouă „branch in new chat” |
| Setări | Tabelul nou de pagini al comunității, cu pagina ta *Messaging* adăugată în el |
| Meniul de raționament | Păstrat glisorul tău pentru *Thinking* (comunitatea l-a înlocuit cu un panou nou de opțiuni) |
| Cardul de întrebări (*clarify*) | Păstrat designul tău de card, plus funcția nouă *skip* a comunității |
| Bara de stare | Păstrat aspectul tău: folderul de lucru stă în meniul de deasupra casetei de chat, nu în bara de stare; testele comunității pentru meniul folderului din bara de stare au fost scoase |
| Embed YouTube | Păstrată soluția ta (adresa aplicației nu ajunge la YouTube; procesul principal pune un Referer real). Pagina-gazdă locală a comunității rămâne în cod, dar nu e folosită; testul ei a fost scos |
| Modul Simple | Logica nouă a comunității, cu alegerea ta: banda de profiluri ascunsă |
| Bifa (`CheckboxMark`) | Readusă peste stilul nou al comunității |
| Fișiere șterse de comunitate (vechiul onboarding, catalogul vechi) | Acceptate: aveai în ele doar redenumirea Hermes → Brain |
| Traduceri | Structura nouă a comunității (secțiuni în fișiere separate). Secțiunile tale (`library`, `notificationFeed`, `introGreeting`) readuse în toate cele 10 limbi; pentru arabă și chineza tradițională, textele tale stau în `ar_brain.ts` / `zh-hant_brain.ts` |
| Numele Brain | 690 de apariții „Hermes” din textele noi ale comunității înlocuite cu „Brain”, în toate limbile. Excepție: termenii de utilizare („Use of Hermes Agent…”) |

**Reparat pe drum:** codul exportului din Library lipsea de pe GitHub (regula
`export*` din `.gitignore`); acum e urmărit de git.

**Verificare**

| Ce | Rezultat |
|---|---|
| Verificarea tipurilor (desktop) | 0 erori |
| Testele aplicației desktop | 11.018 trecute, 2 picate (`voice-prefs`, picau și înainte; nici tu, nici comunitatea nu ați schimbat acele fișiere) |
| Testele backend (Library, gateway, agent, contracte) | 760 trecute, 0 picate |
| Stil cod (ESLint, Prettier) pe fișierele atinse | curat |

**Completare (aceeași zi):** încă 30 de commit-uri noi ale comunității (unelte de editare a fișierelor, întreruperea sesiunilor, câteva reparații în aplicație), îmbinate fără conflicte; verificarea tipurilor curată.

**De urmărit:** aplicația n-a fost încă pornită pe noua versiune; merită o
verificare vizuală a Library, a chat-ului de lângă document și a barei laterale.
