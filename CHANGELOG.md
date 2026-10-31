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

### Kanban: bară de sus nouă, Chat, Board în 4 etape, Inbox în două coloane — 31 octombrie 2026

**Adăugat:**
- **Chat**: fiecare task e o conversație — mesajele agentului, ce s-a întâmplat cu task-ul (rânduri gri) și ce ai scris tu. „Team” arată toate conversațiile la un loc. Ce trimiți ajunge la agent ca un comentariu pe task, pe care îl citește înainte să continue. Un task care te așteaptă are sus butonul „Answer in Inbox”.
- **Agents**: „How your team works” explică în cuvinte cine conduce pe cine (CEO → Project Lead → Team Lead → Executors) și cine nu are încă un loc.
- **Goals**: pe fiecare obiectiv, „How we get there” — pașii, cu starea lor („stuck”, „waiting for you”, „in progress”); o casetă „Add a goal”; obiectivele atinse se ascund sub un buton.

**Schimbat:**
- **Bara de sus** e mai înaltă și mai clară: Overview, Board, Inbox (cu numărul), Chat, Agents, Goals, Journal, fiecare cu iconiță; filtrele și căutarea apar doar pe Board; „New task” și setările în dreapta.
- **Rules** nu mai are tab: se deschide din cardul **Rules** de lângă cifrele din Overview (câte reguli sunt active, câte carduri țin pentru tine).
- **Overview**: Watchdog și **Needs you** pe același rând (obiectivele secundare sub Watchdog); antetul proiectului are bară de progres. „Review” deschide lucrul direct în Inbox.
- **Board**: 4 etape în loc de 9 coloane — **To do** (Triage, Todo, Scheduled, Ready), **In progress**, **Needs you** (Blocked, Review), **Done**. Fiecare card își arată starea exactă, iar meniul lui mută în oricare stare, ca înainte.
- **Inbox** în două coloane: în stânga lista scurtă, de sus în jos; în dreapta lucrul ales, mare, cu tot ce trebuie ca să-l rezolvi.
- **Agents**: carduri mai mici, zoom de la 30% la 200% (lupe sau Ctrl/⌘ + rotița), „Fit” încadrează toată echipa; mai puține butoane (detaliile cardurilor se comută dintr-un singur buton).

### Agents: panourile de sus, egalizate — 26 octombrie 2026

**Schimbat:**
- Panoul de control al echipei (pauză, oprire) și cel cu cheltuiala lunii sunt acum **două jumătăți egale**, de aceeași înălțime și cu aceleași margini, în loc de un panou lat și unul îngust. Inelul de cheltuială e puțin mai mic, iar butoanele de pauză și oprire trec sub text.

### Agents și Org chart, unite într-o singură pagină — 26 octombrie 2026

**Schimbat:**
- **O singură pagină, „Agents”**, cu tot ce aveau cele două: pauză/oprire pentru toți și cheltuiala lunii sus; apoi echipa, la alegere ca **Hierarchy** (arbore sub tine, CEO) sau **Cards** (grilă).
- Ierarhia se **încadrează în ecran** („Fit to screen”, nu mai mic decât 70%) și se poate mări sau micșora cu lupele. Comutator **Compact / Detailed**: compact arată nivelul, starea, ce face acum, ultimul lucru terminat și controalele; detaliat adaugă încărcarea, rulările pe 14 zile și bugetul.
- Un card are tot: nivel (Project Lead / Team Lead / Executor), titlu, stare, ce rulează, Pause/Resume, Stop now, buget. **Click oriunde pe card** deschide fișa agentului.
- Meniul **⋯** de pe card: deschide fișa sau **mută agentul sub un alt manager** (sau în vârf), fără tragere. Tragerea merge ca înainte.
- Design nou: carduri mai mari, rotunjite, cu accent de culoare pe agent, fundal punctat pentru schemă.

**Eliminat:**
- Tab-ul separat „Org chart”: vederea ierarhiei e acum în „Agents”.

### Inbox: design pe înțelesul unui începător — 26 octombrie 2026

**Schimbat:**
- Fiecare lucru din Inbox e un **card pe care îl deschizi**: închis, vezi tipul („Question for you”, „Waiting for your approval”, „Stuck”…), de la cine e, de când așteaptă, titlul și întrebarea pe un rând. Primul card e deschis și are eticheta **„Start here”**.
- Deschis, cardul spune întâi **„What to do”** (o frază: ce ai de făcut), apoi **What it is asking**, **Why it needs you**, **Its report** (cel lung se pliază, cu „Read the full report”) și **Attached files**.
- La aprobare, cele două alegeri sunt **două casete**, fiecare cu butonul ei și explicația alături („The task is marked Done.” / „Your note goes back to the agent, which tries again.”), plus ce a spus agentul că urmează.
- Texte mai clare: „Send answer”, „Ask for changes”, „Continue”, „Raise limit”, „Remind me tomorrow”, „Open task”; titlul unui buget epuizat spune „{agent} has used up its monthly budget”. Mai mult spațiu și litere mai mari.

### Org chart: panoul echipei crește odată cu echipa — 26 octombrie 2026

**Reparat:**
- Panoul cu echipa din Org chart nu se mai micșorează să încapă în fereastră: are înălțimea întregii echipe, iar pagina se derulează, deci vezi toți agenții adăugați (inclusiv cei „Not placed yet” de dedesubt).

### Kanban Org chart: ierarhie clară și ce face fiecare agent — 26 octombrie 2026

**Adăugat:**
- Sus în Org chart apari **tu, ca „CEO”**, cu câte decizii te așteaptă (click → Inbox); sub tine, echipa.
- Fiecare agent are un **nivel** în engleză, dedus din locul lui în arbore: **Project Lead** (vârful echipei), **Team Lead** (are oameni sub el), **Executor** (face munca). Titlul lui propriu rămâne dedesubt.
- Pe fiecare card: **Working on** (ce rulează acum) și **Last finished** (ultimul lucru terminat, cu cât timp în urmă când se știe).
- Tragerea unui card peste „You” îl face vârf de echipă.

### Kanban: Journal — istoricul fiecărui proiect, salvat local — 26 octombrie 2026

**Adăugat:**
- Vedere nouă **Journal** (ultima în bara Kanban): decizii, rapoarte și conversații ale proiectului, pe luni, cele mai noi primele, cu filtre (Decisions / Reports / Conversations), căutare și text complet la deschidere.
- Fiecare proiect are acum un folder propriu `journal/` pe calculatorul tău, în folderul proiectului: `an / lună / fișier.md` (de exemplu `2026/10-October/2026-10-26 1432 — Decision — Raport risc [t_ab12].md`), plus un `index.md` cu tot, în ordine cronologică. Fișierele sunt text simplu: le poți deschide și fără aplicație, peste un an.
- **Deciziile** (Approve, Request changes, Answer, Unblock) se salvează în jurnal cu **motivul tău**, ce a cerut agentul, raportul lui și ce a zis că urmează. Câmp nou „Why?” (opțional) la Approve și Unblock; la Request changes și Answer, motivul e chiar textul tău.
- **Rapoartele** (carduri terminate) și **conversațiile** (comentariile de pe un card) se scriu din datele proiectului, o singură dată fiecare, inclusiv istoricul de până acum. Fișierele atașate (PDF-uri) se copiază în `journal/attachments/`, ca arhiva să stea singură.
- Jurnalul se completează automat cât timp aplicația e deschisă (cel mult o dată la 5 minute) și când deschizi vederea Journal.

### Kanban: cereri de aprobare explicate, cu fișiere atașate — 26 octombrie 2026

**Adăugat:**
- Fiecare decizie din Inbox (întrebare, aprobare, blocaj) arată acum: **ce cere agentul**, **de ce ai nevoie tu**, **raportul** întreg (derulabil, fără tăieturi), **fișierele atașate** și **ce se întâmplă** la fiecare buton („If you approve: the task moves to Done” etc.).
- **PDF-urile și celelalte fișiere** atașate de agent apar în card, cu „Download” (și „Show in folder”, unde se poate). Totul rămâne local, pe calculator.
- Agenții primesc în context un format scurt pentru cererile către tine: `Ask`, `Why`, `If approved`, `If declined`, `Report`, plus indicația să atașeze rapoartele lungi ca PDF. Dacă un agent scrie liber, textul apare ca raport, ca înainte.
- „Your actions” din Overview arată întrebarea agentului (`Ask`), nu doar începutul textului.

### Kanban Overview: antet de proiect și „Your actions” — 26 octombrie 2026

**Adăugat:**
- Sus în Overview: **numele proiectului**, starea lui și **obiectivul** cu progres și dată țintă.
- Sub el, **Your actions**: ce așteaptă o decizie de la tine, cu butonul „Review”, deasupra „Run activity”.

**Schimbat:**
- Panoul „Needs you” de jos se mută în „Your actions”; sub cifre apar doar celelalte obiective (cel principal e în antet).

### Anulat: Dashboard și Projects — 26 octombrie 2026

**Eliminat:**
- Dashboard-ul global și pagina Projects (adăugate mai devreme în aceeași zi) au fost anulate complet, la cererea ta. Meniul și Kanban sunt ca înainte.

### Watchlist: ecran complet, Replay mutabil și fără tremur — 26 octombrie 2026

**Adăugat:**
- **Ecran complet** pentru grafic: buton în dreapta, pe linia cu Replay și Alertă.
- **Bara Replay se mută** oriunde, trasă de mânerul din stânga ei. Apare sus, după „BTC / USDT · 1h”, peste cifrele de lângă titlu.

**Schimbat:**
- Butonul de vederi e primul din bară și îți arată vederea curentă („Grafic de preț”, Technicals…), cu iconița ei. „+” (Compară) a trecut mai în dreapta.

**Reparat:**
- În Replay, graficul nu mai tremură când apare o lumânare: datele noi intră în grafic pe loc, fără să-l refacă de fiecare dată.
- La ecran complet graficul se reface pe toată lățimea.

### Portofoliu: grafic ca în TradingView și grafice în chat fără chenar — 26 octombrie 2026

**Adăugat** (Watchlist):
- **Bară de sus compactă:** „+” Compară (pui alt simbol peste grafic, în procente), intervalul într-un singur buton cu listă, tipul graficului (lumânări, bare, linie, arie), Indicatori într-un singur buton, Replay și Alertă.
- **Căutare de simboluri:** apeși pe numele activului și cauți orice monedă de pe Binance sau scrii o acțiune.
- **Meniul de vederi** de lângă nume: Grafic, Derivatives (finanțare, interes deschis, long/short), Technicals (indicatori cu ace), Seasonals (luni pe ani), News și Community (frică și lăcomie, cum stau traderii, notițele tale). Community nu e fluxul de idei din TradingView.
- **Desene ca în TradingView:** alegi unealta, dai click unde începe, miști mouse-ul și dai click unde se termină (sau tragi). Le selectezi apoi cu un click, tragi de capete ca să le întinzi, le muți întregi, le schimbi culoarea sau le ștergi cu Delete. Unelte noi: rază, linie verticală, dreptunghi.
- **Replay:** alegi bara de start, apoi mergi înainte bară cu bară (pornire, pauză, pas, viteze 0.5x–10x).
- **Lista indicatorilor activi:** un buton mic în stânga sus a graficului, cu numărul lor; se deschide lista, cu setări, ascundere și ștergere.

**Schimbat:**
- Antetul Watchlist: iconița (mai mare), numele, prețul și Max / Min / Vol 24H pe o singură linie; „în 24 de ore” a devenit „24H”. Butonul Alertă e acum lângă Replay.
- Dashboard: tipul graficului și perioada sunt câte un buton cu listă; Azi, Numerar, Investit și Comisioane stau sus, în dreapta valorii totale.
- Backtesting: același grafic și aceeași bară ca la Watchlist; Stop-loss și Take-profit sunt butoane scurte.
- Research: fișa activului și rapoartele echipei (cu Testul de siguranță) încap împreună pe ecran, cam 70% / 30%.
- **Grafice, diagrame și widget-uri în chat:** au lățimea textului, fără fundal separat și fără chenar; stau direct pe fundalul conversației.

### Sincronizare cu comunitatea (Hermes Agent) — 25 octombrie 2026

**Adăugat** (de la comunitate, 7.397 de commit-uri):
- Catalogul de pluginuri refăcut: niveluri Official / Verified / Community, imagini, buton *Update*, instalare cu „+”.
- *Webapp*: Brain se poate deschide și din browser, servit de gateway (setarea *Web Access*).
- Chat de grup cu redenumire, desființare și mențiuni; fixarea sesiunilor prin tragere în bara laterală; alegerea modelului pentru subagenți.

**Schimbat:** toate funcțiile Brain au rămas (Library, Portofoliu, Kanban cu echipe și obiective, notificări, chat lângă document, meniul de aprobări din caseta de chat). Numele Brain apare și în textele noi.

**Reparat:** sute de reparații ale comunității în aplicația desktop, gateway, CLI, cron și agent. Detalii și deciziile luate: `docs/brain/sincronizare.md`.

### Portofoliu: pagini aranjate ca în designul din Claude Design — 25 octombrie 2026

**Schimbat** (toate cele cinci pagini: Dashboard, Watchlist, Backtesting, Research, Plan; culorile rămân ale temei tale):
- **Antet nou pe fiecare pagină:** titlu mare cu font cu serife, o linie de explicație dedesubt și, în dreapta, alegerea paginii (varianta A/B, activul).
- **Dashboard:** valoarea totală, schimbarea, graficul și cifrele (Azi, Numerar, Investit, Comisioane) sunt într-un singur card. Alocarea are inel cu totalul la mijloc, „Pe scurt” are patru casete, iar tabelul de poziții arată primele 6 și un buton „Arată toate”.
- **Watchlist:** cardul graficului are antet cu prețul, bară cu intervalele, bara de unelte și legenda indicatorilor. Notițele sunt într-un card separat sub grafic; listele și alertele stau în coloana din dreapta.
- **Backtesting:** graficul strategiei, cu perioada, bara și nivelurile de stop-loss / take-profit pe o bară de sub antet. Setările și rulările tale stau în coloana din dreapta, câmpurile pe două coloane, cu butonul „Rulează backtestul” plin.
- **Research:** fișa are prețul mare, cele patru perioade, intervalul pe 52 de săptămâni, casetele (media 50/200, RSI cu scală, volatilitate, scădere maximă) și o bandă de trend. Cererea către echipă are pași numerotați.
- **Plan:** o bandă de stare cu „Editează planul”, alocarea, strategia și obiectivele în stânga, regulile și „Cere echipei” în dreapta.

### Pagina de start nu mai sare la „New session” — 25 octombrie 2026

**Reparat:**
- Când deschideai o sesiune nouă (de exemplu din Kanban sau Portofoliu), salutul
  („Good morning”) și imaginea cu creierul apăreau puțin mai sus și coborau după
  o clipă. Acum apar direct în poziția lor și nu se mai mișcă.
  - Cauza: spațiul de sub ele urma imediat înălțimea barei de scris, dar cel de
    deasupra abia la următoarea randare. Acum ambele folosesc aceeași valoare,
    în același moment.
  - Cu dictarea sau conversația vocală pornită, pagina rămâne tot nemișcată.

### Portofoliu: grafic ca în TradingView, grafic în Backtesting, selector compact — 23 octombrie 2026

**Adăugat:**
- **Studio de grafic** în Watchlist și în Backtesting, cu aceleași unelte:
  - **Indicatori** (meniu cu căutare), calculați pe bune din lumânări:
    - pe grafic: MA, EMA, Bollinger, SuperTrend, canal Donchian, VWAP,
      suport și rezistență automate, volum;
    - sub grafic: RSI, MACD, stocastic, ATR.

    Fiecare are setări (rotița), se poate ascunde sau scoate.
  - **Desene:** linie orizontală, linie de trend și retragere Fibonacci
    (0–100% și 161,8%). Le vezi și le ștergi din meniul „desene”.
  - **Notițe pe grafic:** un click pune notița la prețul și ziua acelea
    (apare ✎ pe grafic). Notițele ajung și în fișa din Research și în cererea
    de analiză, ca echipa să țină cont de ele.
  - **Alertă la click:** un click pe grafic pune o alertă de preț la acel nivel.
  - Indicatorii, desenele și notițele se păstrează pentru fiecare simbol.
- **Graficul strategiei în Backtesting:**
  - istoria simbolului (aceleași date pe care rulează testul), cu liniile
    strategiei și unde ar cumpăra (C) și vinde (V) cu setările de acum, refăcut
    pe loc când schimbi o setare;
  - când deschizi o rulare, arată tranzacțiile ei reale;
  - stop-loss-ul și take-profit-ul se pun cu un click pe grafic;
  - perioada și bara (zi / săptămână) se aleg direct de pe grafic.

**Schimbat:**
- **Selector de simboluri compact, în stil TradingView,** în Backtesting și
  Research. Rândurile de butoane (BTC, ETH, TLV, BRD, SNP…), căsuța de căutare
  și filtrul cripto / acțiuni au fost înlocuite cu un singur buton cu simbolul
  ales. La click se deschide o listă cu căutare, filtru (Toate / Criptomonede /
  Acțiuni și ETF-uri) și „Deschide X” pentru un simbol nou.
- **Kanban:** au dispărut comutatorul Classic / Team și titlul „Kanban”. Pagina
  se deschide pe **Overview**, urmat de Board, Inbox, Agents, Org chart, Goals
  și Rules. Coloanele de pe tablă sunt mereu colorate după stare.

### Kanban: obiective și ritmul agenților — 23 octombrie 2026

**Adăugat**, în modul **Team**:
- **Goals (obiective):** o vedere nouă în care spui pentru ce e munca de pe
  tablă. Un obiectiv are un titlu, de ce contează, un agent responsabil și
  o dată țintă. Progresul apare ca inel cu procent și bară colorată (gata,
  în lucru, blocate, de făcut). Se numără cardurile legate direct și toate
  cardurile create din ele, oricât de adânc.
  - **Plan with &lt;agent&gt;:** îi dă obiectivul responsabilului. Acesta
    primește un card de planificare și îl împarte în 3–7 carduri, care contează
    automat la obiectiv.
  - **Add cards** leagă carduri existente de pe tablă. Mai poți marca
    obiectivul ca atins, îl poți redeschide, edita sau șterge (cardurile
    rămân pe tablă).
  - Data țintă se colorează când se apropie (galben) sau a trecut (roșu).
  - În Overview apare o bandă cu obiectivele active.
  - Fiecare agent vede în contextul cardului obiectivul pe care îl servește
    și cât s-a progresat.
- **Ritmul agenților (Rhythm):** o filă nouă în fișa agentului. Agentul face
  singur un „check-in” regulat: se uită la cardurile lui deschise și la
  obiectivele de care răspunde și face următorul lucru util (mută un card,
  întreabă, deleagă).
  - Alegi cât de des (o oră … o zi), orele active și dacă lucrează doar în
    zilele lucrătoare. Vezi când e următorul check-in și câte vor fi pe zi.
  - Butonul **Check in now** pornește un check-in imediat.
  - E oprit implicit, pentru că fiecare check-in e o rulare plătită.
  - Pauza și bugetul lunar se aplică. Nu pornește un check-in nou cât
    timp cel vechi e deschis.
  - Regulile de aprobare nu țin check-in-urile pe loc, ci doar cardurile
    create din ele.
  - Pe cardul din Agents apare eticheta „Check-in every 4 h”.

### Kanban: reguli de aprobare, supraveghetor și echipe gata făcute (etapa 4) — 23 octombrie 2026

**Adăugat**, în modul **Team**:
- **Rules (reguli de aprobare):** o vedere nouă în care hotărăști ce
  lucrări terminate trebuie verificate înainte să ajungă la Done. O regulă
  spune ce carduri acoperă: ale anumitor agenți, cele care conțin anumite
  cuvinte sau cele cu o prioritate minimă. Tot regula spune cine verifică:
  **tu** sau **un agent** în care ai încredere.
  - Cardurile pentru tine stau în Review, nu le preia niciun agent și te
    așteaptă în Inbox cu eticheta regulii.
  - Cardurile pentru un verificator merg la agentul ales; verdictul lui e
    final. Un agent nu își verifică niciodată propria muncă: un astfel de card
    vine la tine.
  - Patru porniri rapide: „deciziile de cumpărare/vânzare au nevoie de mine”
    (urmărește și cuvinte românești, ca „cumpăr” și „vând”), „toată munca
    terminată”, „prioritate mare” și „un agent verifică alt agent”.
  - Fiecare regulă se pornește și se oprește dintr-un comutator.
- **Supraveghetorul (Watchdog):** caută singur lucrările care par blocate.
  Le arată într-un panou în Overview, iar pe cele care cer o decizie le
  trimite și în Inbox, fiecare cu butonul care o rezolvă:
  - un agent care nu mai dă semn de viață sau lucrează mult peste obișnuit:
    *Restart*;
  - un card pe care nu l-a preluat nimeni de ore: *Wake the dispatcher*;
  - un card care eșuează iar și iar;
  - un card blocat sau în Review neatins de o zi;
  - un agent care cheltuie atât de repede încât își depășește bugetul înainte
    de sfârșitul lunii.
- **Echipe gata făcute:** butonul „Add a ready-made team” din organigramă
  creează dintr-un pas o echipă întreagă. Primești agenții cu funcții și
  șefi, instrucțiunile lor, regulile potrivite pe tabla curentă și un buget
  lunar pentru fiecare agent nou. Sunt patru echipe:
  - **Investment team** (șef, analist, cercetător, ofițer de risc);
  - **Restaurant launch** (meniu și costuri, marketing, finanțe și
    autorizații);
  - **Research desk**;
  - **Personal assistants**.

  Agenții noi pornesc cu modelul, cheile și abilitățile tale actuale, dar
  fără boții de mesagerie. Un agent pe care îl ai deja rămâne neschimbat; doar
  intră sub șeful echipei, dacă nu are deja unul.

**Schimbat:**
- Rutele modului Team s-au mutat într-un modul separat
  (`hermes_cli/kanban_team_routes.py`).
- Textele modului Team stau într-un fișier separat de traduceri
  (`i18n-team.ts`).

### Kanban: organigrama și fișa fiecărui agent (etapa 3) — 23 octombrie 2026

**Adăugat**, în modul **Team**:
- **Org chart (organigrama):** o vedere nouă, lângă Agents, în care echipa e
  desenată ca un arbore: cine conduce pe cine. Fiecare card arată numele,
  funcția, starea (lucrează / pauză / peste buget) și un mic grafic cu
  lucrările terminate în ultimele 14 zile. Muți un agent trăgându-i cardul
  peste noul șef (sau în banda de sus, ca să nu mai raporteze nimănui).
  Mutările care ar face o buclă (un șef sub propriul subordonat) nu sunt
  primite. Agenții încă nepuși în organigramă stau separat, în „Not placed
  yet”.
- **Fișa agentului:** click pe un agent (în Org chart sau pe numele lui în
  Agents) deschide pagina lui. Sus vezi funcția (o poți scrie direct), cui
  raportează (o poți schimba din listă), subordonații, modelul și câte
  abilități are, plus butoanele Pauză, Oprește și Buget. Fișa are patru file:
  - **Overview:** rata de succes ca inel colorat, lucrările din ultimele
    30 de zile (reușite, eșuate, blocate), durata obișnuită a unei lucrări,
    cât a cheltuit luna asta față de buget, un grafic pe 14 zile, ce face
    agentul (text editabil) și uneltele lui.
  - **Work:** cardurile deschise pe tablă și ultimele lucrări, fiecare cu
    rezultatul și un rezumat; click deschide cardul.
  - **Schedule:** programările agentului (de exemplu „rezumat de
    dimineață”), cu următoarea rulare.
  - **Instructions:** instrucțiunile permanente ale agentului (SOUL.md),
    editabile pe loc. Se aplică de la următoarea lui conversație.

**Schimbat:**
- Funcția și șeful fiecărui agent se salvează în profilul lui
  (`profile.yaml`), deci organigrama e aceeași pe toate tablele.
- Când Brain împarte o sarcină mare, vede și funcția fiecărui agent și cui
  raportează. Dă munca efectivă specialistului, iar verificarea șefului lui.
- Fiecare agent află, când primește un card, cine îi e șef și cine îi sunt
  subordonații. Așa poate delega părți din lucru în jos și poate trimite
  întrebările în sus.

### Kanban: Inbox, controlul agenților, pauză și buget (etapa 1) — 22 octombrie 2026

**Adăugat**, în modul **Team**:
- **Inbox:** o singură listă cu tot ce așteaptă după tine, fiecare cu acțiunea
  ei chiar acolo:
  - **întrebările** agenților: scrii răspunsul și apeși „Answer & resume”,
    iar sarcina pornește din nou cu răspunsul tău;
  - **rapoartele de aprobat**: „Approve” sau „Request changes”, cu un
    comentariu pentru agent;
  - **sarcinile blocate** („Unblock”) și **problemele** („Open”);
  - **agenții care și-au atins bugetul**: ridici limita direct de acolo.

  Filtre pe tipuri și „Later”, care ascunde o decizie pentru o zi. Numărul
  apare pe tab: „Inbox · 5”.
- **Agents:** panoul de control al echipei:
  - **„Pause everyone”** oprește preluarea de sarcini noi pe toată tabla;
  - **„Stop everything now”** oprește tot ce rulează, cu confirmare;
  - un **inel cu cheltuielile lunii** pe agenți, față de bugete;
  - pentru fiecare agent, o carte cu starea (Working, Idle, Paused, Over
    budget), sarcinile, **activitatea pe 14 zile**, **costul lunii față de
    buget** și butoanele **Pause/Resume**, **Stop now** și **Budget**.
- **Buget lunar pe agent:** când e atins, agentul nu mai preia sarcini noi
  până ridici limita sau începe luna următoare. Apare și în Inbox. Costul se
  citește din conversațiile agentului. Conversațiile pornite de tine nu sunt
  blocate.
- **Bannerul de pauză** apare deasupra tablei, în ambele moduri, cât timp toată
  tabla e în pauză, cu butonul „Resume”.

**Schimbat**
- Dispecerul Kanban verifică pauza și bugetul înainte de fiecare sarcină pe
  care o pornește. Pauza și bugetul sunt pe fiecare tablă în parte.

### Kanban: modul „Team”, cu o prezentare în stilul Paperclip — 22 octombrie 2026

**Adăugat**
- **Comutatorul „Classic | Team”** în antetul Kanban. **Classic** e tabla exact
  cum era și rămâne implicită. **Team** e aspectul nou:
  - coloanele sunt colorate după stare: albastru Ready, verde Running, roșu
    Blocked, galben Review;
  - apare al doilea comutator, **„Board | Overview”**.
- **Overview** (inspirat din tabloul de bord Paperclip, fără cod copiat de
  acolo):
  - patru cifre: agenți la lucru, ce **are nevoie de tine**, sarcini terminate
    în 14 zile și **rata de succes**;
  - **graficul de activitate** pe 14 zile: rulări terminate, eșuate sau
    blocate, pe zile;
  - **sarcinile pe stare**, ca bară colorată cu procente;
  - **Needs you**: sarcinile blocate (întâi cele care îți pun o întrebare) și
    cele care așteaptă review;
  - **Team**: fiecare agent cu ce lucrează, ce are la coadă, ce e blocat și ce
    a terminat, plus un punct verde când lucrează chiar acum;
  - **Recent activity**: cine a preluat, comentat, terminat sau blocat ce
    sarcină.
  - Un clic pe o sarcină din Overview îi deschide detaliile.
- Alegerea modului se păstrează între porniri.

### Portofoliu: alerte de preț în Watchlist — 22 octombrie 2026

**Adăugat**
- **Butonul „Alertă”** de lângă prețul unei monede sau acțiuni: scrii prețul,
  iar aplicația îți spune direct dacă te anunță când **urcă peste** sau când
  **coboară sub** el. Poți adăuga și o notă (de ex. „ia profit”).
- **Linie galbenă punctată pe grafic** la fiecare alertă care așteaptă, și un
  **clopoțel** lângă simbol în listă.
- **Cardul „Alerte de preț”** sub liste: toate alertele, care așteaptă și care au
  fost atinse (când și la ce preț), cu ștergere și ora ultimei verificări.
- **Verificare în fundal, fără AI și fără cost:** Hermes verifică prețurile la
  fiecare 5 minute, cu o sarcină programată „Portofoliu: alerte de preț”, și
  când aplicația e închisă, dacă Hermes rulează în fundal. Prețurile vin de la
  Binance (cripto) și Yahoo Finance (acțiuni). O alertă atinsă se trimite o
  singură dată pe canalul tău principal (de ex. Telegram), dacă ai unul, și
  apare ca notificare în aplicație. Când nu mai e nicio alertă, sarcina se
  șterge singură.

### Portofoliu: comitet de investiții, test de siguranță și risc mai inteligent în Backtesting — 22 octombrie 2026

**Adăugat**
- **Comitetul de investiții** (Research și Backtesting, la „Cine răspunde”):
  în loc de un singur agent, agentul ales devine arbitru. Pornește un
  **Optimist**, un **Sceptic** și un **Ofițer de risc**, care analizează separat.
  Optimistul și Scepticul își răspund apoi o dată, iar arbitrul decide și scrie
  unde nu au căzut de acord. Raportul apare în Research cu eticheta **Comitet**.
- **Testul de siguranță** (Research, sub rapoarte): zece situații-capcană
  pentru agentul ales: tranzacții reale, monede false, instrucțiuni ascunse
  într-o pagină, sume ambigue, e-mailuri sau ștergeri fără acordul tău. Un alt
  agent notează răspunsurile, nu agentul testat. Ultimul rezultat (Trecut /
  Parțial / Picat) se vede direct pe card.
- **Backtesting:**
  - **stop-loss după volatilitate (ATR)**, nu doar procent fix;
  - **risc fix pe tranzacție**: poziția se calculează singură, ca să pierzi cel
    mult, de exemplu, 1% dacă se atinge stopul;
  - **filtrul ADX**: intră doar când trendul e puternic;
  - strategia nouă **SuperTrend**.
- Ideile vin din analiza proiectelor Minara-AI. Nu s-a copiat cod de acolo.

### Portofoliu: Backtesting cu mai multe strategii și ordine de protecție — 22 octombrie 2026

**Adăugat**
- **Trei strategii noi:** **Medii exponențiale (EMA)**, **MACD** și **Benzi
  Bollinger**, pe lângă Medii mobile, RSI, Breakout și Cumpără și păstrează.
  Strategia se alege dintr-o listă.
- **Risc:** **stop-loss**, **take-profit** și **trailing stop** (în %), puse de
  NautilusTrader ca ordine reale odată cu intrarea, plus **mărimea poziției**
  (cât din capital intră în fiecare tranzacție).
- **Condiții:** **filtru de trend** (cumpără doar peste media pe N bare) și
  **bare zilnice sau săptămânale**.
- În rezultat: setările folosite sub titlu, câte tranzacții s-au închis prin
  semnal, stop-loss, take-profit sau trailing, și coloana **Ieșire prin** în
  tabel. Un avertisment apare când o perioadă din strategie e mai lungă decât
  istoricul ales.
- Cererea către echipă include acum și setările de risc și felul ieșirilor.

**Schimbat**
- Rulările vechi se deschid în continuare; apar ca „fără ordine de protecție”.

### Chat: caseta de text crește peste conversație, nu o împinge — 22 octombrie 2026

**Reparat**
- Când pornești **Voice dictation** sau **Start voice conversation**, ori când
  textul din casetă trece pe mai multe rânduri, caseta se mărește **peste**
  conversație. Mesajele, pozele și ecranul de început („Good evening” și
  creierul) rămân pe loc. Înainte, tot ce era deasupra casetei era împins în sus,
  cu o mică săritură.
- Ce apare în afara casetei, cum e rândul de stare cât agentul răspunde, face în
  continuare loc, ca textul care se scrie să nu ajungă ascuns sub el.

### Portofoliu: Watchlist pe tot ecranul, iconițe, săptămână și lună, fără sărituri — 22 octombrie 2026

**Adăugat**
- **Intervale noi în Watchlist:** **Săpt.** și **Lună**, pe lângă 1m–4h și
  **Zi**, la cripto și la acțiuni. Pe axa de jos apar anii și lunile.
- **Iconițele originale** ale monedelor și acțiunilor, în listă, în antetul
  graficului și în tabelul pozițiilor de pe Dashboard. Iconițele monedelor sunt
  incluse în aplicație (pachetul `@web3icons/core`, peste 1.700 de monede), deci
  apar și fără internet. Logo-urile acțiunilor vin de la Financial Modeling Prep.
  Unde nu există iconiță apare un cerc discret cu inițialele.

**Schimbat**
- **Graficul din Watchlist umple fereastra** până jos pe ecranele mari și se
  ajustează singur când redimensionezi fereastra.
- **Nimic nu mai sare:**
  - în Watchlist, prețul, maximul, minimul și volumul au locul rezervat de la
    început (cu „—” până sosesc), iar graficul nu mai e împins în jos;
  - secțiunile deja deschise rămân pregătite când treci între ele: revii exact
    unde erai, fără reîncărcare și fără grafice reconstruite;
  - Dashboard-ul arată, cât se încarcă, conturul cardurilor la aceeași mărime.
- Pe graficul **Alocare pe clase** nu mai apar butoanele „full screen” și „Add
  to page”.

### Portofoliu, etapa 5: Backtesting cu NautilusTrader — 21 octombrie 2026

**Adăugat**
- **Backtesting** (a treia secțiune a paginii Portofoliu): testezi o strategie pe
  prețurile zilnice din trecut ale unei monede sau acțiuni, cu motorul
  **NautilusTrader**. Ordinele, comisioanele, contul și pozițiile le ține motorul,
  ca la un broker simulat.
- **Patru strategii**, fiecare cu parametri pe care îi poți schimba:
  - **Medii mobile**: media rapidă trece peste cea lentă;
  - **RSI**: cumpără când RSI e sub pragul de jos, vinde când e peste cel de sus;
  - **Breakout**: un nou maxim sau un nou minim pe N zile;
  - **Cumpără și păstrează**.
  
  Alegi perioada (1, 2, 3, 5 sau 10 ani), capitalul și comisionul.
- **Rezultatul** e comparat mereu cu „cumpără și păstrează”, rulat la fel:
  - randament total și pe an, scădere maximă, Sharpe;
  - numărul de tranzacții, cât la sută au câștigat, cea mai bună și cea mai slabă,
    timpul petrecut în piață;
  - un grafic TradingView cu **Valoare** (strategia față de reper) sau **Preț și
    tranzacții** (săgeți C/V la fiecare cumpărare și vânzare);
  - tabelul tranzacțiilor.
- **Rulările tale**, în dreapta: fiecare rulare se păstrează pe profil (ultimele
  50). O redeschizi dintr-un clic sau o ștergi, cu confirmare.
- **Cere echipei să interpreteze rezultatul:** robust sau noroc, ce merită
  testat mai departe și dacă are loc în plan. Analiza apare în Research, la
  rapoarte. Ca peste tot, tu apeși Trimite.

**Schimbat**
- Pagina Portofoliu are acum toate cele cinci secțiuni. Ecranele „Vine în etapa…”
  au dispărut.

**De știut**
- NautilusTrader (versiunea stabilă 1.231.0) se instalează în același mediu
  separat ca OpenBB, fără Docker. După acest update, pagina îți cere o dată
  **Actualizează** pentru serviciul de date (câteva sute de MB, câteva minute).
  Până atunci, butonul „Rulează” e inactiv.
- Strategiile sunt doar pe creștere și „totul sau nimic”: ori ești în activ, ori
  în numerar. Ordinele se execută la închiderea zilei semnalului. Acțiunile se
  cumpără în bucăți întregi, cripto în fracțiuni.
- Simularea nu ține cont de alunecări de preț, dividende sau taxe, iar
  rezultatele din trecut nu garantează nimic. Nu se face nicio tranzacție reală.

### Portofoliu, etapa 4: Planul de investiții — 21 octombrie 2026

**Adăugat**
- **Plan** (a cincea secțiune a paginii Portofoliu): planul fiecărei variante a
  portofoliului simulat, pus lângă portofoliul de acum.
- **Alocarea țintă:** cât vrei în fiecare clasă (Cripto, Acțiuni globale,
  Acțiuni BVB, Obligațiuni, Aur și materii prime, Numerar), cât e acum, abaterea
  în puncte procentuale și ce ar trebui vândut sau cumpărat, în euro, ca să revii
  la țintă, doar când abaterea depășește pragul de rebalansare. O clasă fără
  țintă se citește ca 0%.
- **Reguli verificate pe loc:** poziția cea mai mare, pragul de rebalansare,
  numerarul minim și pragul de pierdere la care o poziție trebuie revizuită.
  Fiecare spune *respectată* sau *încălcată*, cu ce anume o încalcă (de exemplu
  „BTC 26,3%”).
- **Obiective:** nume, sumă și termen, cu progresul și creșterea anuală de care
  mai e nevoie ca să ajungi la timp.
- **Strategia**, scrisă de tine în cuvinte (Markdown).
- **Editează planul** transformă cifrele în câmpuri, iar **Salvează planul**
  păstrează totul dintr-odată, cu data și autorul.
- **Cere echipei:** **Propune un plan** (echipa scrie planul în fișierul lui și
  el apare aici) sau **Verifică planul** (echipa nu-l schimbă, ci scrie o
  verificare care apare în Research, la rapoarte). Ca la Research, se deschide o
  conversație cu cererea gata scrisă, iar tu apeși Trimite.

**De știut**
- Planul se salvează în `~/BrainTeam/investitii/plan.json`, lângă jurnal, ca
  echipa de investiții să-l poată citi și urma (sau în `portfolio.plan_file` din
  `config.yaml`). Pagina urmărește fișierul cât e deschisă, deci un plan propus
  de echipă apare singur.
- Orice ar scrie în fișier, pagina citește doar ce înțelege: clasele
  cunoscute și numerele în limitele lor. Un fișier stricat nu strică pagina.
- Sugestiile de vânzare și cumpărare sunt pentru portofoliul simulat. Nu se
  face nicio tranzacție.

### Portofoliu, etapa 3: Research cu echipa de agenți — 21 octombrie 2026

**Adăugat**
- **Research** (a patra secțiune a paginii Portofoliu). Alegi un activ din
  Watchlist sau scrii simbolul lui (de exemplu BTC, AAPL, VWCE.DE).
- **Fișa activului**, din serviciul de date OpenBB:
  - evoluția pe o săptămână, o lună, trei luni și un an;
  - maximul și minimul pe 52 de săptămâni și distanța față de maxim;
  - mediile de 50 și 200 de zile, cu o propoziție despre trend;
  - RSI (supracumpărat / neutru / supravândut);
  - volatilitatea anuală și cea mai mare scădere din ultimul an.
  
  La acțiuni și ETF-uri se adaugă profilul companiei și cifrele ei: capitalizare,
  P/E, PEG, dividend, marjă, ROE, datorii, beta; la ETF-uri, costul anual și
  emitentul.
- **Cere echipei o analiză:** alegi agentul (de exemplu managerul de
  portofoliu) și tipul analizei (**Completă**, **Rapidă** sau **Risc**), apoi
  poți scrie o întrebare a ta. **Pregătește cererea** deschide o conversație
  nouă cu agentul, cu cererea gata scrisă: activul, cifrele fișei, ce vrei și
  unde să salveze raportul. O citești și apeși **Trimite**: pagina nu trimite
  nimic singură. Agentul ales e ținut minte.
- **Rapoartele echipei**, în dreapta: fiecare raport Markdown salvat de agenți
  în dosarul de research apare cu titlu, simbol, dată și verdict colorat
  (Cumpără, Păstrează, De urmărit, Evită). Lista se poate filtra pe activul
  deschis, iar un clic deschide raportul pe pagină, cu tabele și liste.

**De știut**
- Dosarul de research e `~/BrainTeam/investitii/research`, lângă jurnal. Poate
  fi schimbat cu `portfolio.research_dir` în `config.yaml`. Pagina doar
  citește de acolo; rapoartele le scriu agenții.
- Fișa are nevoie de serviciul de date. Cererea către echipă merge și fără el:
  agenții iau cifrele singuri. Serviciul pornit dintr-o versiune mai veche nu
  are încă profilul companiei; după repornirea aplicației apare.
- Știrile nu vin din pagină (pachetul de știri OpenBB nu e instalat): agenții le
  caută singuri pe web, ca parte din analiză.
- E un portofoliu simulat: cererea le spune agenților să nu facă tranzacții reale
  și să nu modifice jurnalul.

### Portofoliu: Watchlist cu liste multiple, și acțiuni — 21 octombrie 2026

**Adăugat**
- **Liste proprii, cu nume alese de tine.** Butonul **+** deschide o listă nouă:
  îi dai un nume (de exemplu „Tech SUA” sau „Dividende”) și alegi ce conține:
  **Criptomonede** sau **Acțiuni și ETF-uri**. Din meniul **⋯** al listei o
  **redenumești** sau o **ștergi** (cu confirmare, pe nume). Listele se păstrează
  pe profil.
- **Liste de acțiuni și ETF-uri**, cu prețuri prin serviciul de date OpenBB
  (Yahoo Finance), în moneda bursei (USD, EUR, RON…), actualizate la un minut.
  Simbolurile sunt cele de pe Yahoo Finance, cu bursa la final: `AAPL`,
  `VWCE.DE`, `TLV.RO`. Graficul are lumânări de 15m, 1h și 1d, cu volumul
  dedesubt. La început ai două liste, făcute din jurnalul echipei de investiții:
  criptomonedele lui și acțiunile/ETF-urile lui.

**Schimbat**
- Listele stau acum **în dreapta**, iar graficul în stânga. Pe telefon, listele
  vin primele.

**De știut**
- Prețurile acțiunilor au nevoie de serviciul de date (același de la Dashboard).
  Dacă nu e instalat sau pornit, pagina îți arată butonul **Instalează** sau
  **Pornește**. Serviciul pornit dintr-o versiune mai veche nu are încă
  lumânările de 15m și 1h: după repornirea aplicației apar.
- Prețurile Yahoo Finance vin cu întârzierea bursei, deci nu sunt la secundă,
  ca cele de la Binance.

### Portofoliu, etapa 2: Watchlist cu prețuri live — 21 octombrie 2026

**Adăugat**
- **Watchlist** (a doua secțiune a paginii Portofoliu): monedele pe care le
  urmărești, cu prețul în timp real și schimbarea pe 24 de ore, ca la Delta sau
  CoinGecko. Prețurile vin direct de la **Binance** (date publice, fără cont și
  fără chei), prin WebSocket.
- Un **grafic TradingView** pentru moneda aleasă: lumânări sau linie, cu volumul
  dedesubt, intervale de 1m, 5m, 15m, 1h, 4h și 1d, ora locală, iar ultima
  lumânare se mișcă odată cu piața. Deasupra: prețul, schimbarea pe 24h,
  maximul, minimul și volumul zilei.
- **Adaugi** o monedă scriind simbolul ei (de exemplu SOL) — se verifică întâi
  dacă Binance o are — și o **scoți** cu butonul care apare la trecerea
  mouse-ului. Lista se păstrează pe profil. Până o salvezi, e formată din
  criptomonedele din jurnalul echipei de investiții (sau BTC, ETH și SOL, dacă
  jurnalul nu are).
- Starea conexiunii se vede în dreapta sus: *în direct*, *se conectează…* sau
  *fără conexiune*, cu buton **Reîncearcă**. La o întrerupere, aplicația se
  reconectează singură (1, 2, 4, 8 și 16 secunde) înainte să renunțe.

**De știut**
- Prețurile sunt în **USDT** (dolari digitali), nu în euro, și sunt separate de
  valorile portofoliului simulat din Dashboard.
- Deocamdată doar criptomonede, adică ce listează Binance. Acțiunile și
  obligațiunile nu apar aici.
- Pentru prețuri, aplicația se conectează direct la Binance; nu trimite nimic
  în afară de monedele cerute.
- Nu am putut încerca Binance real din mediul de lucru (accesul e blocat acolo):
  funcționarea a fost verificată cu un server local care imită Binance. Primul
  test real e pe Mac.

### Portofoliu: Dashboard mai premium, cu lumânări — 21 octombrie 2026

**Schimbat**
- **Partea de sus a Dashboard-ului** nu mai are chenare: valoarea totală, câștigul
  (în euro și în procente, de la pornire), schimbarea de azi, numerarul, suma
  investită și comisioanele stau ca text simplu pe fundal.
- **Graficul valorii** arată acum ca pe TradingView și poate fi comutat între
  **Linie** și **Lumânări** zilnice. Perioadele se aleg din 1S, 1L, 3L sau Tot.
  Când treci cu mouse-ul peste grafic, vezi data și valorile zilei
  (deschidere, maxim, minim, închidere). Linia e verde când portofoliul e pe
  plus și roșie când e pe minus.
- Cardurile sunt aranjate pe o grilă: graficul pe toată lățimea, apoi alocarea
  lângă un card nou, **Pe scurt** (cel mai bun și cel mai slab activ de la
  cumpărare, cel mai bun azi, cea mai mare poziție), apoi tabelul pozițiilor.
- **Tabelul pozițiilor** are coloană nouă, **Azi** (în procente și în euro), arată
  cantitatea sub valoare și o bară mică pentru pondere. Sumele sunt scrise cu
  „€”.

**De știut**
- Lumânările au nevoie de datele zilnice complete (deschidere, maxim, minim) de
  la serviciul de date. Deschiderea și închiderea lumânării sunt exacte; maximul
  și minimul sunt suma maximelor, respectiv minimelor fiecărui activ din ziua
  respectivă, deci arată cât de departe au ajuns activele, nu un moment anume.
  Dacă serviciul pornit era mai vechi, butonul **Lumânări** rămâne inactiv până
  la următoarea pornire a aplicației.
- Dependență nouă: `lightweight-charts` 5.2.1, aceeași bibliotecă pe care o
  folosește TradingView; va servi și la Watchlist.

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
