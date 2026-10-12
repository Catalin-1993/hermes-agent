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
