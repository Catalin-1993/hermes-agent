# Brain — ghidul modificărilor

Brain este proiectul lui **Vasi Catalin**, construit peste
[Hermes Agent](https://github.com/NousResearch/hermes-agent) (proiectul
comunității, păstrat ca bază). Acest ghid descrie **tot ce aduce Brain în plus**:
ce face fiecare funcție, cum funcționează și unde se află în cod.

| Document | Ce găsești acolo |
|---|---|
| [`CHANGELOG.md`](../../CHANGELOG.md) | Lista scurtă, la fiecare push: *Adăugat / Schimbat / Reparat* |
| **Acest ghid** | Explicația pe larg a fiecărei funcții |
| [`sincronizare.md`](sincronizare.md) | Cum aducem actualizările comunității și jurnalul fiecărei sincronizări |

---

## 1. Library — documentele tale, lângă Brain

O bibliotecă în stil Notion, în aplicația desktop: pagini, prezentări, tabele
și orice fișier.

**Ce poți face**
- **Pagini** scrise cu un editor pe blocuri (titluri, liste, tabele, imagini).
- **Prezentări** cu editor de slide-uri: anulare/refacere, editare direct pe
  slide, text formatat (font, mărime, culoare, bold / italic / subliniat /
  tăiat, aliniere, stil de paragraf).
- **Tabele** cu editor propriu.
- **Fișiere** de orice tip, cu pictograme care arată formatul (PDF, DOCX,
  XLSX, PPTX…) pe o foaie cu colțul îndoit.
- Vizualizare **listă sau grilă**, căutare, sortare, filtre și o vedere
  **„Din chat-uri”** care arată ce a produs fiecare conversație.
- Meniul **New**: pagină, prezentare, tabel, din șablon, folder, încărcare.
- Meniul unui element: *Open, Details* (previzualizare + informații în același
  panou), *Ask Brain, Rename, Move, Duplicate, Copy/Cut, Tags*, accesul lui
  Brain, *Trash*.

**Export**

| Ce exporți | Formate |
|---|---|
| Pagini | PDF · HTML · Markdown · ZIP |
| Prezentări | PowerPoint (PPTX) · Word (DOCX) · PDF · Markdown · imagini · pachet |
| Tabele | CSV · TSV · JSON · Markdown · Excel (XLSX) · ZIP |
| Imagini | PNG · JPEG · WebP · original · ZIP |
| Foldere | ZIP (până la 3000 de elemente / 400 MB) |

Formatarea textului din slide-uri se păstrează în PowerPoint și Word.

**Cum funcționează**
- Datele stau într-o bază de date locală, în folderul profilului
  (`hermes_cli/library_db.py`), cu versiuni, etichete, încărcări, previzualizări
  și procesare în fundal (`hermes_cli/library_*.py`).
- Prezentările sunt slide-uri Markdown (`hermes_cli/library_deck.py`,
  `apps/desktop/src/app/library/deck*.ts`); stilurile de text se scriu ca
  `<u>…</u>` și `<span style="…">…</span>`, aliniamentul ca un comentariu
  `<!-- align=center -->` deasupra blocului.
- Exportul se face în aplicație (`export-formats.ts`, `export-actions.tsx`,
  `deck-pptx.ts`, `deck-docx.ts`).

**Unde în cod:** `apps/desktop/src/app/library/`, `hermes_cli/library_*.py`.

---

## 2. Brain lucrează în Library

Agentul poate **căuta, citi, vedea și edita** documentele din Library.

- O singură unealtă, `library`, cu acțiunile *search, read, view, edit, create,
  update, delete, block, import* (`tools/library_tool.py`).
- **„look”**: Brain poate cere o imagine a slide-ului pe care îl vezi, ca să
  lucreze pe ce vezi tu.
- **Acord înainte de acțiune**: înainte să umble în Library, Brain îți arată un
  card de confirmare (`library-consent.tsx`).
- Comunicarea aplicație ↔ agent trece prin metodele `library.*` din
  `tui_gateway/methods_library.py`, cu contracte în
  `tui_gateway/contracts/library.py`.

---

## 3. Chat-ul Brain lângă un document

- Deschizi un document și apeși **Ask Brain**: se deschide **un singur** chat,
  fixat în stânga, cu lățime fixă (puțin mai lat decât bara laterală), fără bară
  de tab-uri.
- Fișierele trimise din Library ajung în **acel** chat, nu deschid altul.
- Butoanele chat-ului sunt aliniate cu săgețile ← → din bara de sus și nu se
  suprapun.

**Unde în cod:** `apps/desktop/src/app/chat/companion-frame.tsx`,
`session-tile.tsx`, `pane-mirror.ts`, `apps/desktop/src/app/library/chat-bridge.ts`.

---

## 4. Interfața

- **Bara laterală stângă** se deschide dacă ții mouse-ul **1,5 secunde** pe
  butonul ei (sau puțin pe marginea stângă a ferestrei). Rămâne deschisă cât
  timp mouse-ul e în zona ei, inclusiv în bara de titlu de deasupra și în
  meniurile deschise din ea. Un clic pe buton o fixează deschisă.
  (`apps/desktop/src/store/sidebar-peek.ts`)
- **Meniul de profil** (stânga jos): *Personalization* deasupra lui
  *Capabilities*; profil nou, import, administrare profiluri și gateway-uri ca
  un rând de iconițe; „Open settings” eliminat.
- **Fișierele atașate în chat** arată tipul („PDF · nume”) și pictograma
  formatului.
- **Colțuri puțin mai pătrățoase** la tab-uri și la fișierele atașate.
- **Teme noi** cu bare laterale în degrade (de exemplu *Graphite*) și un font
  de afișare.
- **Notificări** pentru conversații în fundal, subagenți și sarcini programate.
- **Mesageria** se configurează din *Settings*.
- **Widget-uri în mesaje**: grafice, carduri (agenți, locuri pe hartă, video),
  embed-uri pentru link-uri și YouTube, cu acord înainte de încărcare.

---

## 5. Identitatea: Brain

- Agentul se prezintă: *„Sunt Brain, dezvoltat de Vasi Catalin”*
  (`agent/prompt_builder.py`, `hermes_cli/default_soul.py`).
- Aplicația și textele ei folosesc numele **Brain** în toate limbile.
- Rămâne „Hermes Agent” doar acolo unde e numele legal al proiectului de bază
  (de exemplu termenii de utilizare) și în numele tehnice din cod.

---

## Cum documentăm fiecare push

1. **O ramură pe temă** (de exemplu `brain/library-export`, `fix/sidebar-hover`).
2. **Commit-uri pe teme**, cu mesaj `tip(zonă): descriere` — `feat`, `fix`,
   `docs`, `refactor`, `test`, `chore` — și un corp care spune *de ce*.
3. **O intrare în `CHANGELOG.md`** în același push.
4. **Acest ghid se actualizează** când apare o funcție nouă sau se schimbă una.
5. **Pull request spre `main`**, cu descrierea schimbării și cum a fost verificată.
