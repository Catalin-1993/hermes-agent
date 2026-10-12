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
