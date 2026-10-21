# Jurnal de modificări — Brain

Tot ce aduce Brain peste proiectul de bază (Hermes Agent, ramura `main` din
upstream), în ordinea în care a fost trimis pe GitHub. Cele mai noi intrări
stau sus.

## Cum documentăm fiecare push

1. **O ramură pe temă.** Lucrul nou pleacă din `main` pe o ramură cu nume
   clar, de exemplu `brain/library-export` sau `fix/sidebar-hover`.
2. **Commit-uri pe teme, cu mesaj explicit.** Primul rând spune *ce* se
   schimbă, în formatul `tip(zonă): descriere`:
   - `feat` — ceva nou; `fix` — o eroare reparată; `docs` — documentație;
     `refactor` — cod reorganizat fără schimbare de comportament;
     `test` — teste; `chore` — întreținere (dependențe, configurări).
   - Corpul mesajului spune *de ce* și ce observă utilizatorul.
3. **O intrare aici, în același push.** Sub „Nelansat” se adaugă, pe scurt,
   ce s-a schimbat pentru utilizator: *Adăugat*, *Schimbat*, *Reparat*,
   *Eliminat*.
4. **Pull request spre `main`.** Descrierea PR-ului repetă intrarea din jurnal
   și spune cum a fost verificată schimbarea (teste, verificare în aplicație).
5. **La o versiune nouă**, secțiunea „Nelansat” primește un număr și o dată
   (de exemplu `## 0.2.0 — 2026-11-01`) și se deschide una nouă.

## Nelansat

### Portofoliu, etapa 1: pagina și Dashboard-ul — 21 octombrie 2026

**Adăugat**
- Un rând nou în bara laterală, **Portofoliu**, cu o pagină pe cinci secțiuni:
  Dashboard, Watchlist, Backtesting, Research și Plan. Acum funcționează
  Dashboard-ul; celelalte patru spun în ce etapă vin.
- **Dashboard-ul** arată portofoliul simulat al echipei de investiții, citit
  din jurnalul ei (`~/BrainTeam/investitii/jurnal/tranzactii.csv`): valoarea
  totală, câștigul de la pornire, schimbarea de azi, numerarul, graficul
  valorii zi cu zi, alocarea pe clase (cripto, acțiuni BVB, acțiuni globale,
  obligațiuni, aur) și tabelul pozițiilor. Variantele A și B se schimbă dintr-un
  buton. Totul în euro: acțiunile BVB se convertesc din lei, cele americane din
  dolari.
- **Prețuri reale de piață** prin OpenBB (date yfinance). Serviciul de date
  rulează separat de Hermes, în mediul lui propriu, și se instalează o singură
  dată, doar când apeși **Instalează** pe pagină (circa 400 MB, 1–2 minute).
  Apoi pornește singur. Până atunci, și pentru activele fără preț de piață,
  valorile vin din jurnal și sunt marcate „jurnal”.
- Tranzacțiile fără verdictul ofițerului de risc sunt semnalate deasupra
  graficelor.

**De știut**
- E o simulare, nu consultanță financiară. Nu se fac tranzacții reale.
- După un update care schimbă versiunile serviciului de date, pagina îți cere
  **Actualizează**; nu se actualizează nimic pe ascuns.

### Imaginea de pe pagina de start rămâne fixă la voce — 19 octombrie 2026

**Reparat**
- Când apăsai microfonul (dictare) sau „Start Voice Conversation”, imaginea
  cu creierul și textul de pe pagina de start se mărea și se mutau. Panoul
  de voce mărește bara de jos, iar pagina de start își calcula mărimea din
  înălțimea ei. Acum folosește înălțimea de repaus a barei, care nu se mai
  schimbă când pornește vocea; se recalculează doar când redimensionezi
  fereastra.

### Calendar, Library, player video, Mermaid și dashboard-uri — 19 octombrie 2026

**Reparat**
- Cardurile (calendar, video etc.) apăreau ca text JSON când modelul lipea
  marcajul ` ```card ` de propoziție sau scria tot blocul pe un singur rând.
  Acum se desenează.
- Un link YouTube rupt pe mai multe rânduri sau o virgulă în plus în JSON nu
  mai strică un card sau un grafic.
- O diagramă Mermaid cu un rând greșit nu mai cade la cod. Rândul e omis, iar
  sub diagramă scrie „1 rând … a fost omis”.
- Mesajul „Syntax error in text” al Mermaid nu mai rămâne lipit în pagină.

**Adăugat**
- **Editare înainte de salvare în Library:** pe cardul de aprobare apare
  butonul **Editează**. Poți schimba titlul și conținutul paginii, iar
  agentul salvează exact versiunea ta și este anunțat că ai modificat-o.
- **Player video plutitor:** butonul „Detașează” pe orice video YouTube din
  chat.
  - Fereastra se trage oriunde și se fixează automat într-un colț.
  - Are două mărimi și butonul „Readu aici”, care continuă din același
    moment.
  - Minimizat, video-ul rulează în continuare, iar în bara de jos apar
    pauză/redare, ±10 secunde, readu și închide.
- **Dashboard-uri:**
  - fiecare KPI are unitatea lui (€, %), o notă scurtă și direcția „bine”
    (`better: "down"` pentru costuri sau retururi);
  - liniile de trend sunt colorate după direcție;
  - tipuri noi de grafice: pâlnie, indicator (gauge), radar și combinat bare
    + linie.

**Schimbat**
- Diagramele foarte late de la stânga la dreapta se desenează de sus în jos,
  iar diagramele înalte își păstrează mărimea, ca textul să rămână lizibil.
- Șablonul calculatorului are un design nou: glisoare colorate, rezultatul
  într-un panou și o bară sumă inițială/dobândă.
- Skillul `inline-widgets` (1.4.0) descrie noile tipuri de grafice și câmpuri.
- Textele noi sunt traduse în toate limbile aplicației. Textele elementelor
  vizuale stau acum în fișiere separate (`*_chat_visuals.ts`).

### Grafice, diagrame și widgeturi într-o singură linie de design — 18 octombrie 2026

**Reparat**
- Diagramele mermaid ieșeau de câteva ori prea mari și apoi micșorate până la
  ilizibil când macOS are „Reduce motion” pornit. Măsurarea diagramei nu mai
  e afectată de animații.
- Diagramele de clase (`classDiagram`) apăreau ca text de cod: liniile
  `class Nume {` erau șterse din greșeală. Acum se desenează.
- Pie-ul și graficul de commit-uri (`gitGraph`) ieșeau gri. Pie-ul mermaid și
  `xychart-beta` se desenează acum ca grafice native, iar celelalte diagrame
  primesc culorile temei.
- Numele ramurilor din `gitGraph` nu se vedeau: fundalul diagramelor era
  calculat aproape transparent.
- Un card scris de model ca ` ```card place ` apărea ca text JSON. Acum e card.
- Desenele SVG cu `currentColor` ieșeau negre, cu font Times, pe tema închisă.

**Schimbat**
- Toate elementele vizuale din chat stau în aceeași ramă, cu aceeași lățime:
  grafice, diagrame, desene SVG, widgeturi și pagini HTML. Rama are colțuri
  rotunjite, linie fină, suprafață, umbră și același titlu.
- Aceleași unelte la trecerea mouse-ului: ecran complet (cu zoom, deplasare și
  copiere ca imagine) și salvare în Library, inclusiv pentru diagrame.
- Diagramele stau centrate la mărimea lor și se micșorează doar cât rămân
  lizibile. Cele foarte late se derulează lateral.
- Widgeturile primesc automat fontul și culorile aplicației. Fundalul de
  pagină sau rama proprie desenate de model sunt neutralizate, ca să nu apară
  o ramă în ramă.
- Fișierele HTML întregi apar ca o fereastră cu numele fișierului sus și își
  păstrează designul propriu.
- Pie-urile cu peste 4 felii folosesc culori distincte din temă.
- Skillul `inline-widgets` (1.3.0) descrie noua ramă și panourile interioare.

### Aprobare doar pentru skillul de elemente vizuale — 15 octombrie 2026

**Adăugat**
- `skills.write_approval` acceptă acum și o listă de nume de skilluri, de
  exemplu `[inline-widgets]`. Doar scrierile în skillurile din listă cer
  aprobarea ta (`/skills pending`, `/skills approve <id>`). Restul skillurilor,
  memoria și orice altceva rămân neschimbate.
- Un lot de modificări care atinge un skill din listă este reținut întreg
  până la aprobare.

**Notă:** `/skills approval on|off` înlocuiește lista cu `true` / `false`.

### Sincronizat cu comunitatea — 12 octombrie 2026

Au intrat 5.201 commit-uri din Hermes Agent (proiectul comunității), cu toate
funcțiile Brain păstrate. Detaliile, inclusiv cum a fost rezolvat fiecare
conflict, sunt în [`docs/brain/sincronizare.md`](docs/brain/sincronizare.md).

- **De la comunitate:** catalog de pluginuri și *Settings ▸ Plugins*; favorite
  în meniul de modele; niveluri de viteză Standard / Fast / Ultrafast;
  avertisment înainte de limita abonamentului; *keep-awake* doar cât lucrează
  agentul; ora mesajului la hover; mărimea textului din chat separată; sute de
  reparații în aplicație, actualizări, gateway și agent.
- **Păstrat de la Brain:** Library, chat-ul de lângă document, bara laterală
  la hover, meniul de profil, glisorul *Thinking*, cardul de întrebări,
  soluția YouTube, numele Brain în toate limbile.
- **Ghid nou:** [`docs/brain/README.md`](docs/brain/README.md) explică fiecare
  funcție Brain: ce face, cum funcționează, unde e în cod.

### Adăugat

- **Paginile HTML create de agent apar în chat** — dacă agentul salvează o
  pagină sau un dashboard `.html` și nu o arată, chat-ul o desenează singur la
  finalul răspunsului.
- **Library** — pagini (editor pe blocuri, ca Notion), prezentări, tabele și
  fișiere, cu vizualizare listă/grilă, căutare, sortare, filtre și o
  vedere „Din chat-uri” cu ce a produs fiecare conversație.
- **Meniul New** — pagină, prezentare, tabel, din șablon, folder, încărcări.
- **Meniul unui element** — Open, Details (previzualizare și informații în
  același panou), Ask Brain, Rename, Move, Duplicate, Copy/Cut, Tags, accesul
  lui Brain, Trash.
- **Export** — pagini în PDF / HTML / Markdown / ZIP; prezentări în PPTX /
  Word (DOCX) / PDF / Markdown / imagini / pachet; tabele în CSV / TSV /
  JSON / Markdown / Excel (XLSX) / ZIP; imagini în PNG / JPEG / WebP;
  foldere în ZIP.
- **Text formatat în slide-uri** — font, mărime, culoare, bold / italic /
  subliniat / tăiat, aliniere și stil de paragraf, păstrate la export în
  PowerPoint și Word.
- **Pictograme de fișier** care arată formatul (PDF, DOCX, XLSX…) în Library
  și în chat.
- **Chat-ul Brain lângă un document** — un singur chat, fixat în stânga, cu
  lățime fixă; fișierele trimise din Library ajung în acel chat.
- **Brain în Library (backend)** — agentul poate căuta, citi, vedea și edita
  documente, cu acord cerut înainte de a umbla în Library.
- **Widget-uri în mesaje** — grafice, carduri (agenți, locuri pe hartă,
  video), embed-uri pentru link-uri și YouTube, cu acord înainte de încărcare;
  skill nou „inline-widgets” cu șabloane.
- **Teme noi** cu bare laterale în degrade (de exemplu Graphite) și un font
  de afișare.
- **Notificări** pentru conversații în fundal, subagenți și sarcini programate.

### Reparat

- **Diagrame cu culorile modelului sau cu greșeli mici** — chat-ul ignoră
  culorile fixe puse de model într-o diagramă (`style`, `classDef`) și repară
  paranteza închisă greșit (`{lead]`), ca diagrama să fie desenată.
- **Spațiu gol sub widget-urile mici** — rama widget-urilor putea doar să
  crească, niciodată să scadă sub 280 px; acum se potrivește conținutului.
- **Skill-ul de vizualizări din profilul tău** era rescris de agent cu reguli
  greșite (fundal bleumarin fix, culori fixe); a fost readus la original
  (copia veche e în `~/.hermes/backups/`).
- **Pagini HTML afișate ca cod** — când modelul scrie un dashboard într-un
  bloc ` ```html `, chat-ul îl desenează acum ca widget (cu cardul *Open*
  dedesubt, pentru panoul din dreapta). Codul simplu de HTML rămâne cod.
- **Forme inventate de model** — o linie `::card{…}` sau `::chart{…}` cu JSON
  valid e desenată ca un card sau grafic normal, nu afișată ca text.
- **Dashboard-uri afișate ca text/cod în loc de grafic** — un widget sau un
  grafic lung (peste 48 de rânduri, de exemplu un dashboard) era transformat
  într-un card de cod cu buton *Open* în loc să fie desenat în chat. Acum
  toate blocurile pe care chat-ul le desenează singur (widget, chart, card,
  mermaid) sunt desenate oricât de lungi ar fi.
- **Grafice tăiate pe margini** — graficele și widget-urile mai late decât
  coloana de text își pierdeau marginile (titlul, ultima bară) după ce
  apăreau mesaje noi. Acum se văd întregi.
- **Dunga neagră după schimbarea temei pe ecran complet** — la schimbarea
  temei, bara de jos își măsura culoarea prea devreme (în modul „glass”
  fereastra își schimbă materialul cu o clipă mai târziu) și rămânea cu
  culoarea temei vechi până la redimensionare. Acum se măsoară din nou după
  ce schimbarea s-a terminat.
- **Bara neagră de jos** — cu transparența „glass” pornită, bara de jos
  copia culoarea paginii pe jumătate transparentă și lăsa să se vadă fundalul
  închis al ferestrei. Acum ia culoarea paginii complet opacă: fundal uniform
  sus, la mijloc și jos, în chat și în Library, în toate temele.
- **Imaginea cu creierul lipsea în aplicația instalată** — adresa imaginii
  se calcula greșit în aplicația împachetată (o căuta în `dist/assets/` în
  loc de `dist/`), așa că se vedea doar fundalul temei. În varianta de test nu
  apărea problema. Acum imaginea apare la toate profilurile.
- **Verificările automate de pe GitHub (Python)** — codul Library nu respecta
  două reguli ale comunității: stilul Python (`ruff`) și citirea fișierelor
  scrise pe Windows (cu semn BOM la început). Acum ambele trec; comportamentul
  aplicației nu se schimbă.
- **Imaginea cu creierul de pe pagina de start** — pe ferestre late și joase
  (ecran 16:9, fereastră nemaximizată) urca sub bara de sus și i se tăia
  partea de sus. Acum mărimea ei se calculează din spațiul liber dintre bara
  de sus și caseta de chat, așa că se vede întreagă la orice mărime de ecran;
  pe ecranele mari arată ca înainte.
- **Bara laterală la hover, după sincronizare** — comunitatea a schimbat
  butonul din stânga: acum pliază coloana din stânga, nu mai ascunde doar bara
  laterală. Deschiderea la hover folosea vechiul mecanism, așa că nu mai
  deschidea nimic după ce închideai bara cu butonul. Acum folosește exact
  același mecanism ca butonul.
- **Exportul din Library lipsea de pe GitHub** — regula `export*` din
  `.gitignore` (gândită pentru fișiere exportate) ascundea și codul
  exportului (`export-actions`, `export-menu`, `export-formats` și testul
  lor). Acum aceste fișiere sunt urmărite de git.

### Schimbat

- **Dashboard-urile cerute în chat** sunt grafice native în răspuns, nu pagini
  HTML (doar dacă ceri explicit un fișier); un proces primește o diagramă.
- **Agentul știe când să deseneze** — instrucțiunile de bază și skill-ul
  *inline-widgets* spun acum clar: text în mod implicit; grafic doar pentru
  date, procese, locuri, video sau când ceri; blocul direct în răspuns (nu în
  fișiere); grafice native în loc de Chart.js; fără culori fixe sau emoji;
  un dashboard = mai multe grafice native, nu o pagină HTML.
- **Șabloanele** — bare mai subțiri și mai aerisite; centrul donut-ului arată
  „total” sau rămâne gol când feliile sunt procente.
- **Diagramele (mermaid) în stilul aplicației** — culorile temei, fontul
  aplicației, colțuri rotunjite și linii subțiri, în loc de mov și font serif.
- **Bara cu numele tău din meniul lateral e cu 12% mai joasă** (44 px în loc
  de 50 px); textul, poza, butoanele și bara de jos rămân neschimbate.
- **Fără imaginea cu statuia Hermes în fundal** — opțiunea *Backdrop* din
  Appearance a fost scoasă; fundalul e o singură culoare.
- **API și Telegram în bara de jos** — lângă *Open Command Center*, cu
  același aspect ca celelalte butoane; apar odată cu bara, la hover. Dacă bara
  de jos e ascunsă (modul Simple), rămân la baza meniului lateral.
- **Sursele de mesaje (API, Telegram…) într-o bară la baza meniului lateral**
  — nu mai ocupă lista de conversații. Bara stă ascunsă deasupra numelui tău
  și apare când treci cu mouse-ul pe partea de jos a meniului; are doar
  iconițe (API își păstrează și numele). Un clic deschide conversațiile acelei
  surse.
- **Bara laterală închisă dispare complet** — după sincronizare, butonul
  din stânga lăsa la marginea ferestrei o bandă cu „Sessions” și „Bots”
  scrise vertical. Acum bara laterală se ascunde de tot, ca înainte; butoanele
  Sessions ⇄ Bots din bara de sus rămân.
- **Iconițele din meniul de profil își arată numele la hover** — *New profile,
  Import profile, Manage profiles, Manage gateways* apar într-o etichetă după
  0,2 secunde (înainte, textul nativ al sistemului apărea greu).
- **Numele** — agentul și aplicația se numesc **Brain**; agentul se prezintă:
  „Sunt Brain, dezvoltat de Vasi Catalin”.
- **Bara laterală stângă** — se deschide dacă ții mouse-ul pe buton 1,5
  secunde (sau pe marginea stângă a ferestrei) și rămâne deschisă cât timp
  mouse-ul e în zona ei; un clic pe buton o fixează deschisă.
- **Meniul de profil** — Personalization deasupra lui Capabilities;
  profil nou, import, administrare profiluri și gateway-uri ca un rând de
  iconițe jos; „Open settings” eliminat din meniu.
- **Colțuri mai pătrățoase** la tab-uri și la fișierele atașate în chat.
- **Mesageria** se configurează acum din Settings.
