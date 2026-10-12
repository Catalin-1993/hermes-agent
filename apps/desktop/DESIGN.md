# Desktop Design System

Conventions for the Electron desktop app (`apps/desktop`). Read this before
adding a component, overlay, or style. The rule of thumb: **one source per
concern, tokens over literals, flat over boxed.** If you reach for a raw color,
a one-off shadow, a bespoke button, or a hardcoded `px-*` on a control — stop,
there's already a primitive for it.

This file owns the visual and interaction contract. Read
[`AGENTS.md`](./AGENTS.md) for architecture, state, resolver, transport, and
testing rules.

This doc contains two kinds of content, maintained differently:

- **Principles** (flatness, intent, feedback, motion, cancellation) are durable.
  They hold as components come and go.
- **Named contracts** (tokens, `Button` variants, primitive names) are the
  design system's current API. They are maintained _with_ the code: if you
  change a primitive, token, or variant, update its entry here **in the same
  change** — a stale name in this file is a bug, exactly like a stale type.

When a rule and the code disagree, fix whichever is wrong rather than forking a
one-off at the call site.

## Principles

1. **Flat, not boxed.** No card-in-card, no divider borders inside a panel.
   Group with whitespace and a single hairline, never nested rounded boxes.
2. **Borderless elevation for floating panels.** Overlays float on
   `shadow-nous` + a `--stroke-nous` hairline, not thick framed boxes. In-panel
   structure may use token hairlines sparingly.
3. **One primitive per concern.** One `Button`, one set of control variants,
   one `SearchField`, one `Loader`, one `ErrorState`. Migrate onto them; don't
   fork.
4. **Tokens, not literals.** Reference CSS vars (`--ui-*`, `--shadow-nous`,
   `--theme-*`), never raw hex / ad-hoc rgba in components.
5. **Style lives in the primitive.** Variants and sizes own padding, radius,
   color, chrome. Call sites pass a `variant`/`size`, not `className` overrides
   that re-specify those.
6. **Intent before automation.** Surface useful actions and previews, but do not
   open panes, move focus, or navigate because a tool happened to produce
   something.
7. **Immediate feedback.** Direct manipulation updates the view first. Network
   or disk persistence reconciles afterward and rolls back visibly on failure.

## Information architecture

- **Chat is the home surface.** The transcript and composer stay primary; tools,
  previews, files, review, and terminal complement the conversation.
- **Pages are durable destinations.** Chat, Skills, Messaging, and Artifacts
  remain in shell chrome. Do not hide a distinct product noun inside an
  unrelated page.
- **Route overlays are short tasks.** Settings, Command Center, Cron, Profiles,
  Agents, and Starmap render as `OverlayView` cards and return to the previous
  route on close. Model/session pickers and dialogs layer above the current
  surface; they are not navigation stacks.
- **Panes are working context.** Preview, files, review, and terminal remain
  attached to the current task. Their state survives temporary hiding and chat
  switches where the underlying tool is meant to persist.
- **The bell is what happened while you were elsewhere** (`app/notifications/`, the titlebar's
  right edge, beside the right-sidebar toggle, in every layout and mode). Its count is what you have
  not opened; a click drops the panel: one row per event, newest first — a background chat finished
  (with the start of its reply) or stopped on an error, an agent delivered (its summary, files
  written, duration), a scheduled job ran (its output), a command exited, a session waits on an
  approval or an answer. A row opens the place it is about, marks itself read and closes the panel;
  looking at a session reads its rows too. It records only what you did not see: never the session
  you are looking at while the window has focus, never history from before the window opened, never
  a reconnect's replay. It is fed by the one notification door (`dispatchNativeNotification`,
  whatever the OS notification settings say) and by two watchers for what never notifies
  (`sources.ts`: cron runs and agents settling); `store/notification-feed.ts` keeps the last 60,
  persisted, primary window only. It is not a pane and repeats nothing the shell already shows.
- **One action, one home.** A command may have keyboard, palette, and visible
  affordances, but they invoke the same action and state. Do not fork behavior
  per entry point.
- **Projects own workspace cwd.** Use Sidebar → Projects for local folders and
  worktrees; do not reintroduce a per-session/right-sidebar folder-picker flow.
  The folder chip on the main composer's top edge (`WorkspaceChip`) is a door
  into Projects, not a second picker: its menu lists projects — on a fresh draft
  a choice enters the project and the draft takes its root; in a stored chat it
  starts a new session there — and ends in the app's one Open folder action
  (`openFolderAsProject`, same as ⌘O). Its label names the chat's folder, and below Open folder
  its menu carries what to do with that folder — Copy path, Open containing folder (only when the
  chat's backend is this computer), Reveal in filetree. The status bar has no folder item: the
  folder is chosen and managed in this one place.

Profile icons and condensed profile rows offer **Open in new window** and
**Set as default** in their existing context menus. Opening a profile creates a
full peer window without switching the source window. The desktop default
applies at startup and to generic new chats; explicit profile/project actions
and profile-specific windows keep their own destinations. Changing the default
does not move existing sessions or replace the active conversation.
Ordinary **New Window** (`⌘⇧N` / `Ctrl+Shift+N`) inherits its opener's device and
profile only at startup, not as a window-specific default. Later device/profile
selections remain authoritative for new chats unless a desktop default is set.

Navigation must preserve context. A background session finishing, a tool result
arriving, or a project refresh may update badges and cached data; it must not
replace the foreground transcript or steal focus.

## Shell surfaces — rails and a flush reading surface

The window has one fill for the rails; the reading column sits flush beside
them, told apart by colour alone (`src/app/shell/shell-surfaces.css`). Only
paint changes; the tree, sashes, anchors and keep-alive hosts are untouched:

- `[data-contrib-shell]` paints the rails: a gradient, lighter at the top and
  deeper at the bottom — the theme's `sidebarTop` / `sidebarBottom`, else
  derived from `--ui-bg-sidebar` (`--shell-rail-top` / `--shell-rail-bottom`,
  set further from the page than the raw tokens). Every zone's field tokens go
  transparent, so the sessions rail, the right rail, their headers and the
  status bar sit on it with no boxes, edges or seams.
- A zone holding the workspace or a conversation is the **reading surface**:
  flush and square, no frame, radius or shadow — just `--shell-sheet-fill`
  (deepened in dark mode). Keyed on content (`[data-workspace-pane]` — every
  route — and `[data-chat-surface]` for tiled conversations), not zone ids.
- The status bar under a surface that **ends on it** wears that surface's colour, so the
  surface reaches the window's bottom edge: the reading sheet, and the terminal (an opaque
  pinned colour — xterm cannot show the gradient) at the foot of the right column. Under the
  rails it stays clear and the gradient continues. `useStatusbarBand` measures this
  (`--statusbar-band`) from what is actually painted, never from a colour list, so any pane
  that ends on the bar — review, browser — is covered without a rule of its own.
- Rail-gradient themes (Graphite, Aurora, Obsidian, Sandstone) carry their own
  stops; every accent and text colour clears AA on both ends of the gradient.
- Rails carry no edge of their own: no sidebar border, no right-rail stroke.
  Sidebar destination rows are a glyph and a name (`SIDEBAR_NAV_ROW`) with a
  soft band on hover and when current — never a box.
- No `backdrop-filter` here — the fill or the native material is behind it.
- Titlebar controls are always shown, left to right: the traffic lights (drawn
  by the app in macOS fullscreen, `mac-traffic-lights.tsx`), the Sessions ⇄ Bots
  switch — a quiet segmented pill built from the panes that declare `modeIcon`
  (`sidebar-mode-switch.tsx`; a zone holding only modes shows no tab strip) —
  then the sidebar toggle in the rail's top-right corner and back / forward at
  the start of the main area. With the rail hidden they pack after the switch. The status bar's text rests invisible
  (`--shell-statusbar-rest-opacity: 0`) and comes up on hover/focus.
- The composer: one model pill (the selected model) whose menu opens on the
  thinking slider above the model catalog; the approval-mode pill sits beside
  "+"; Open folder sits on its top edge.
- Messaging setup is a Settings section (`?tab=messaging`), not a sidebar row;
  plugin-contributed sidebar destinations fold under **More**.
- The transcript fades out at the sheet's top edge and just above the floating
  composer (`--thread-fade-top`, `--thread-fade-bottom`, a mask on the
  viewport). HUD keeps its own fade.

Selectors are data attributes the shell already stamps, never class names.

## Library — pages, files and the agent's consent

The Library (`src/app/library/`, route `/artifacts`, sidebar row **Library**) holds the profile's
Notion-style pages and saved files; what sessions generated (the former Artifacts page) is its
**Generated** section. Storage and rules live in the backend (`hermes_cli/library_db.py`,
`library.*` RPCs); the renderer never keeps its own copy.

- **Layout:** one header (`LibraryHeader`): inside a folder, a drop-ready breadcrumb above the folder's
  name; the title row ends in **Templates** and a single **+ New** menu (Page, Folder, Upload files…, Upload folder…;
  Empty trash in Trash). Below, the views as pills — All · Recent · Pages · Images · Files · Favorites,
  with Generated and Trash behind "N more…" — ending in the search magnifier (opens into a field),
  one **Sort & filter** menu (`sort-filter-menu.tsx`: the sorts and their direction first, then the
  filters — type / Hermes access / created by / tag — under their own headings; Recents has no sort)
  and one view button that always offers the other view (Grid while listing, List while in the grid;
  view and sort are remembered, `library-prefs.ts`). There is no Info button: ⌘I and Get info open the
  panel, its own ✕ closes it. Templates sit behind one **Templates** button beside + New: a menu
  of every template (tinted glyph, name, one-line summary); a template (`templates.ts`) is a full working document —
  property table, one-line brief, sections, tables and checklists — and gives its page an emoji icon. All browses the folder tree (folders first); the other tabs are
  flat views across it that name each item's folder. Section, folder and item live in the URL on the
  routed page (`?section=&folder=&item=`), so back / forward walk them; local state in a split tile.
- **Organizing:** folders hold folders, pages and files; a page holds its subpages and embeds;
  nothing sits under a file. Rows and cards select with ⌘ / Shift / the hover checkbox (a floating
  bar acts on the selection: Move to…, Favorite, Hermes access, Trash), rename inline (menu or F2),
  drag onto folders and breadcrumb segments, and move through "Move to…" (`move-dialog.tsx`).
  Trashing takes the whole subtree; the Trash lists what was deleted, and Restore brings back
  exactly what went with it.
- **An opened page's bar** (`library-item.tsx`): the path, then the **Hermes** pill, Hermes access, the
  star and ⋯ — nothing that counts or reports. The ⋯ menu leads with the quiet status line (Saving… ·
  Saved · Edited a minute ago), then Full screen, then Move to, Tags, Version history and the exports. A
  small Full screen glyph rides the page's top corner (it stays visible inside full screen to leave it);
  "Edited …" also sits under the title. The editor's block handles (add, drag) are drawn about 8%
  smaller than BlockNote's, with a soft rounded hover (`library.css`).
- **Hermes beside the item** (`with-hermes.tsx`, `chat-bridge.ts::openHermesBeside`): the Hermes pill
  opens a fresh, unlisted chat docked on the right (`store/side-chat.ts`, wired by the shell) with the
  item attached; the page stays in view. A private item asks first, in a small card; allowing moves it
  to Ask, so every read and change still waits for the owner. When Hermes changes an open page, a
  floating capsule at the top says so — View changes (a line diff, removed before added) and Undo (the
  version the tool kept just before its edit). Never a modal on arrival, never a jump in scroll.
- **Create with Hermes** (`create-with-hermes.tsx`): the Library bar's lead action, a soft accent pill
  beside New (templates live in New › From template; there is no separate Templates button). A dialog:
  four kinds as cards (Document · Plan · Research · Interactive), one roomy field, two example chips per
  kind, the consent line in the footer, ⌘↵ to create. Creating makes the page (open to Hermes — writes
  still ask), opens it, and sends the request to the chat beside it. Pressing Hermes on an item whose
  chat is already docked returns to that chat instead of stacking another pane.
- **Views** (`index.tsx`): the pills are the everyday few — All · Recents · Favorites · From chats —
  and "N more…" holds Pages, Images, Files, Generated and Trash (a kind is also a Sort & filter choice).
- **From chats** (`chats-view.tsx`): what Hermes made or changed, one card per conversation (the tool
  stamps `session_id`; a compressed chat stays one card), newest work first. The card heads with the
  chat's title, "N items · when" and Open chat; below, the items as small cards. A block under a page in
  the same card is represented by its page. Empty: one calm line and Create with Hermes.
- **Tables** (`previews/table-editor.tsx`, `csv.ts`, `table-view.ts`): a CSV / TSV opens as a sheet to
  work in, Airtable-quiet: sticky header and row numbers, a column's menu on hover (sort, rename,
  insert left/right, delete), a row's ⋯ on its number (insert above/below, delete), "+" for a column
  and New row at the foot. Click selects (an accent ring), double-click / Enter / typing edits, Tab and
  arrows move, Delete clears. Sort and Filter shape the view only; edits save themselves ~1s later in
  the file's own separator. The toolbar carries Filter, Analyze with Hermes (the chat beside it, the
  file referenced) and ⋯ (Edit as text, versions). XLSX stays a viewer, with Edit a copy (the sheet as
  a CSV beside it) when the whole sheet is loaded.
- **Presentations** (`deck.ts`, `deck-editor.tsx`, `deck-slide.tsx`): a deck is an ordinary Library
  page whose text opens with `<!-- hermes:deck theme=… -->` and holds slides between `---` lines, so
  Hermes writes and edits it with the Library tool (consent, versions, Undo, the changes capsule — all
  as for any page) and it still reads as Markdown anywhere. A page with the marker opens in the deck
  editor instead of the block editor: four theme dots (Paper · Ink · Sand · Ocean), a slide rail
  (drag to reorder; hover to duplicate or delete; "Add slide"), one large 16:9 canvas, the slide's own
  text beneath it, and — the main way to work — text edited on the canvas itself: hover washes a
  block in a soft accent, a click edits it in place (showing its Markdown, so **bold** survives), Enter
  keeps it (in a list it starts the next item; on an empty item it ends the list), Esc drops the change.
  Thumbnails in the Library list and gallery show the deck's first slide in its theme (the listing carries
  only that slide), with a one-line hint, Export PDF (the system print sheet, one slide per
  page) and Present (full screen: → ↓ Space next, ← ↑ back, Esc leaves, a quiet "n / total"). Slides
  are drawn with inline styles in `cqw` units so one component serves thumbnail, canvas, stage and
  print. New › Presentation makes a starter; Create with Hermes › Slides asks Hermes for one.
- **Editing an image** (`previews/image-editor.tsx`, `image-crop.ts`): an image opened in the Library has an
  Edit button beside its zoom controls (PNG, JPEG, WebP). The editor keeps the same surface: rotate left /
  right and flip in the toolbar, a crop with eight handles, rule-of-thirds guides, a dimmed outside and a
  shape menu (Free · Original · 1:1 · 4:3 · 3:2 · 16:9 · 3:4 · 9:16 — a shape locks the corners). The
  status shows the result's size. Save replaces the file (its earlier bytes stay in Version history);
  Save a copy puts the edit beside it; Esc leaves, ⌘S saves. **Remove background** is Hermes's: it opens
  the chat beside with the image attached, and Hermes hands the transparent PNG back through the
  Library tool's `import` (a consent card first, like every write).
- **PowerPoint** (`deck-pptx.ts`): Export › PowerPoint writes a real .pptx — editable text boxes in the
  deck's colours, bullets and numbering, bold/italic/code, the first picture of a slide beside its text —
  with the `fflate` the app already carries (no new library). It opens in PowerPoint, Keynote and Google
  Slides. PDF stays the system print sheet.
- **A page's look** (`page-look.tsx`): Notion-style. On hover over the head, "Add icon" (the shared
  emoji picker) and "Add cover" (a random gallery gradient). The cover band carries Change cover
  (Gallery · Library · Upload — an upload is saved under the page), Reposition for images, Remove.
  Covers are one string on the page (`gradient:<name>` / `image:<id>@<focus>`); the gallery is quiet
  paper-and-ink tones first, a few deep ones last.
- **Explorer:** Finder's keys (`library-keys.ts`, one table): arrows move the selection (↑/↓ step a gallery
  row), ⇧ extends it from the anchor, Enter / ⌘↓ open, ⌘↑ goes to the parent folder, Space opens Quick
  Look (`quick-look.tsx`: the item large over the listing, ← / → page through it, Space or Esc close),
  ⌘I the Info panel (`inspector.tsx`: kind, size, dimensions, pages, dates, author, place, Hermes access,
  Copy path), ⇧⌘D duplicates (⌘D is the global default-profile chord), ⌘C / ⌘X then ⌘V copy or move into the folder being browsed (cut items
  fade), ⌫ trashes. Dragging on empty space draws a rubber band (`marquee.tsx`); a plain click there
  clears the selection. ⌥-drag takes copies of files out to Finder or another app, named as the user
  knows them (`electron/drag-out.ts`). Keys from dialogs (portals) never reach the listing.
- **Organizing:** Finder tags (`library_tags.py`, `organize-ui.tsx`): a name and one of seven colours,
  worn as overlapping dots on rows and cards, set from ⋯ → Tags, the selection bar or Info, managed
  in Manage tags…; tagging is not an edit. Filter → Tag lists everything wearing it, across the
  tree. Save search keeps the query and filters under a name in "N more…" (the pill shows it while
  open; any section or folder leaves it). Version history… (files and pages): a replace keeps the
  old bytes (hard-linked), a page keeps a snapshot when editing resumes after ten minutes; the last
  50 are kept and Restore makes the current state a version first. New items take their folder's
  access; changing a folder's access carries to what inherited it, never to a level set by hand.
- **Interactive blocks** (`interactive-block.tsx`, `interactive-html.ts`): `/html` (Media) puts a small
  web page — calculator, quiz, chart — inside a page, as Notion's HTML block does. Empty, the block
  is one dashed card: paste HTML, or upload a `.html` file, then Add block. The document is a Library
  file beneath the page (so versions, access and search come with it); the block holds its id, a
  fixed height (0 = fit the content) and its title. It runs in the `SandboxedFrame` (opaque origin,
  CSP with no network — `src/lib/frame-policy.ts`), which reports its content height up by `postMessage`
  (only its own frame is believed, clamped 120–1200). Hover shows three icons: Ask Hermes to change it, Edit and Full screen. **Edit** makes the
  page's own texts writable where they stand — no code is shown (`html-edit.ts`: the texts the file's markup holds are
  numbered, the sealed frame reports each change by message, and `use-edit-session.ts` writes them back into the
  markup a moment after typing stops, each a version; only text changes, never tags, styles or scripts). What a script draws
  — a chart, a table built in code — is not in the markup, so Hermes is asked for it. The same editing opens a Library HTML
  file from its ⋯ menu (Edit; Edit code keeps the code editor). The bottom edge drags the
  height, a double click gives it back to the content. Documents over 1.5 MB are refused (they travel
  as a `data:` URL). Markdown and the agent see a `library://<id>` link.
  **Hermes builds them:** the setup card's one button reads the text — HTML adds the block, words
  start a build (`interactive-agent.ts`). A build leaves a waiting block (its file holds a marker;
  the card says Hermes is building it, with Cancel) and opens a fresh chat that sends the request
  itself; the agent answers with the `library` tool's `block` action (`tools/library_tool.py`: a page
  id adds a block at its end, an HTML file id replaces its document; the whole document in `html`,
  the previous one kept as a version; each write asks the owner's consent like any other). A running
  block's sparkle icon asks Hermes to change it the same way. Handing a block over opens that one
  file to Hermes for asking if it was private; nothing else. A finished Library tool call bumps
  the Library revision: open blocks re-read their file, and an open page the agent changed starts
  afresh from it (unless the owner has unsaved edits). A page the agent wrote as markdown names a
  block as a lone `[title](library://<file id>)` line, which the editor turns back into the block
  (`restoreBlocks`).
  **Memory and theme:** the page gives the frame `window.hermes` and nothing else — `state` (what it
  saved last, or null) and `save(value)` (JSON, ≤ 64 KB, kept in the block's `state` prop so it is
  saved, versioned and exported with the page; only the frame's own message is believed, and a save
  never reloads the frame it came from), `theme` (the app's resolved colours — `readPalette` reads
  each token back as the colour it paints, since a token may be a `color-mix` the frame cannot see)
  mirrored as `--hermes-bg|fg|muted|border|accent` and `color-scheme`, and `onTheme(fn)`. A theme
  change is posted to the running frame, never reloaded into it; a block that leaves its own colours
  alone follows light and dark. A quiet strip under the frame, only when there is something to say, shows the saved size and Reset saved data.
  **Templates** (`interactive-templates.ts`): under the setup card's one field, six tiles — ROI
  calculator, Quiz, Flashcards, KPI dashboard, Chart, Timeline. A tile places that document as the
  block at once. Each is a complete themed page that keeps its data with `hermes.save`, uses no
  network and no library, and is the owner's (or Hermes's) to change like any block; their words are
  English. `interactive-templates.test.ts` runs every one in a frame and drives it.
  **Out of the page and into it** (`page-export.ts`, `page-export-actions.ts`): a page's ⋯ menu
  exports it as HTML — one file, text and pictures inline, each block alive in its own sealed frame
  (`srcdoc`, the same policy and runtime; a small script in the file lets frames fit their content) —
  or as PDF through the system print sheet, with each block as drawn at its set height. Links to
  other pages become their titles; attachments other than pictures are named, not embedded. The block's file keeps
  its own Version history… (open the file in the Library); a restore refreshes the block. Dropping an `.html` file on a page asks: Interactive block, or As text (its
  text and formatting become ordinary blocks, scripts left behind).
  **Internet access** (`src/lib/frame-policy.ts`, shared with chat widgets): a block is offline, except that scripts, styles and fonts may load from `LIBRARY_HOSTS` (cdnjs, jsdelivr, unpkg, esm.sh — Chart.js, D3, Mermaid) without asking; never data, images or a connection. One that
  needs the network names its hosts in its own document — `<meta name="hermes:network"
content="api.example.com">` — and the block asks, in a banner on itself: Allow or Not now. The owner's
  yes is stored on the block (`network`, the approved hosts) and covers exactly the hosts the document
  still names (approved ∩ named; a new host asks again). Only public https hosts, spelled out — no
  wildcards, addresses, ports or local names — so an approval cannot open the owner's machine or
  network; the Content-Security-Policy then admits just those hosts (`connect-src`, scripts, styles,
  images, media, fonts; `http:` and everything else stay shut). The strip under the frame shows the access and
  Revoke; the toolbar shows a globe while it is on; an exported page keeps what was approved. The
  agent declares hosts the same way (`library` tool, `block`; its consent card says what is asked and
  that the owner approves it on the block) and may not name a host the rule refuses. A block must still
  work without it — the currency converter shows saved rates until allowed.
  **Twelve templates** now: the six above plus Kanban board (drag or arrows), Focus timer, Invoice,
  Monthly budget (donut), Decision matrix and Currency converter (the one that asks for a host).
  **Chat widgets** (`components/assistant-ui/widget-frame.tsx`, `widget-frame-doc.ts`): an agent shows a
  chart, diagram or small tool in the reply two ways, in one sealed, themed, self-sizing frame. A
  ```` ```widget ```` fence carries the HTML in the reply itself (no file, so it works on any gateway); a
  `::preview{file}` directive shows a workspace file. A fence draws its markup and styles *while it is
  written* — poured into an already-loaded frame every 150 ms, scripts left out — and comes alive once
  its text reads as finished (scripts and styles closed, nothing cut mid-tag) and has been still for
  1.2 s, even if the reply goes on. **Size:** a widget is laid out on the *figure area* — the text column,
  widened on a wide window up to 56rem and centred on it (`figureArea`, `placeFigure` in
  `widget-frame-doc.ts`; `use-figure-area.ts` keeps it current as the window, pane or sidebar change).
  Its width is its finished content's, measured in a frame opened to the whole area, and measured again
  whenever the area changes: a fluid chart or table fills the area, a small card keeps its size and lines
  up with the text like an image, a wider one centres on the column. The message lets a figure paint past
  the column (`[data-figure]` in styles.css); nothing else in it does. **Full screen** (hover, beside the
  globe and the bookmark) lifts the same frame into the top layer with the Fullscreen API, as Library
  blocks do — nothing reloads, so the widget keeps its state; a fluid one takes the screen less a margin,
  a fixed one sits centred at its own size. Both follow the Library's network policy (`src/lib/frame-policy.ts`): the CDNs load, any
  other host needs the `hermes:network` meta and a banner above the widget (Allow / Not now). The yes is
  kept on this device — per file path, or per widget text (`store/widget-network.ts`); a globe on hover
  revokes it. In imported conversations a widget stays plain code. A `srcdoc` frame cannot navigate itself
  to the web (`electron/guest-frame-navigation.ts`, judged by the initiating frame).
  The **right-rail artifact pane** (`preview-artifact.tsx`) seals its HTML the same way, with the same
  banner. A finished widget or artifact shows two controls on hover (`widget-toolbar.tsx`): the globe
  (what is open, click to revoke) and a bookmark — **Add to page** — a small popover with a search box,
  *New page* and the owner's pages, newest first. Choosing one puts the widget in the Library as an
  interactive block (`saveWidgetToLibrary` in `library/chat-bridge.ts`): on a page of its own (titled
  from the widget's `<title>`, else its first heading), or at the end of the chosen page — in its
  markdown and, when it has a block document, in that too, so nothing already arranged is flattened. Inside a block the theme is also
  mirrored as `--foreground`, `--muted-foreground`, `--accent`, `--border`, `--card`, and
  `hermes.send` answers undelivered, so a saved widget runs as it did in the chat. Network approvals do
  not travel: the block asks again. The bundled `inline-widgets` skill (`skills/creative/`) gives the
  agent seven templates — KPI cards, bar, line, donut, flow diagram, sortable table, calculator — and
  the design rules that make them read as part of the app.
- **With the chat** (`chat-bridge.ts`, `library-picker.tsx`): the composer's + menu has From
  Library… (search pages and files, pick several, Attach); ⋯ → Ask Hermes on a file or page opens a
  new chat with it attached; an assistant reply's bookmark saves it as a page ("Saved to Library",
  Open). Attaching is the owner handing the item over, so access levels do not gate it: the item is
  exported (`library.export` — a hard link under its real name, pages as `<title>.md`, in
  `library/exports/<id>/`) and goes in as an ordinary file attachment.
- **Files:** one type table (`file-types.ts`: extension → category → glyph, tint, and next the
  previewer). Gallery cards (compact, `minmax(8.5rem,1fr)`) show images and video frames themselves, pages as a sheet with their
  first lines, everything else as its glyph and extension on a quiet tint. Uploads queue in a
  corner panel (`upload-panel.tsx`) with per-file progress, cancel and retry; a local backend
  copies by path, otherwise files cross in chunks (`library.upload_*`). A duplicate — identical
  bytes anywhere, or the same name in the folder — asks Replace / Keep both / Skip, optionally for
  the rest of the batch. Upload folder… mirrors a directory as a folder tree.
- **Processing:** a stored file is `pending` until the backend has made its derived renditions
  (`hermes_cli/library_processing.py`, two at a time, off the request thread): a thumbnail
  (QuickLook / sips / pdftoppm / ffmpeg / Pillow, whichever exists), page count and dimensions,
  and its text into the search index. Rows and cards say "Processing…" meanwhile and the listing
  polls until none are left. Search matches titles and file text and shows the matching line,
  query terms marked. External tools are optional rungs: a missing one costs a thumbnail or an
  exact rendering, never the file.
- **Previews** (`file-view.tsx` → `previews/`): a file opens in the Library, never "download to
  view". Bytes come in 8 MB slices (`library.read`, `readLibraryBlob`) — no size ceiling, local or
  remote — with a progress bar while they arrive and, if they cannot, a plain "couldn't open" with Try
  again; never an endless spinner. One frame for all of them (`PreviewSurface`: a quiet toolbar with
  the viewer's facts on the left, its tools and Full screen on the right). Images zoom and pan (the
  percentage toggles fit ⇄ actual size); PDFs open in Chromium's viewer; Word documents lay out as
  pages (`docx-preview`, lazy); audio is a card with the waveform as its seek bar; sheets are a grid
  with sticky column letters and row numbers, and CSV adds Source and Edit; ZIPs list their entries;
  text and code are highlighted source with an editor that saves back (⌘S); Markdown and HTML also
  render, HTML in an opaque `allow-scripts` frame under a CSP that admits no network. Other office
  formats render through LibreOffice when installed, else through macOS Quick Look (self-contained
  HTML or a PDF, in the same sealed frame), else as their text with a one-line notice offering
  Download LibreOffice and Check again (no restart needed). Renditions are made when the file
  arrives and cached until it changes. A mode switch appears only when there are two modes.
- **More formats:** archives (ZIP, tar family, and 7z / RAR / ISO through the OS's `bsdtar`) list their
  entries and Extract into a folder beside them (`library_archive.py`: tar's `data` filter, size and
  count checked first); email (.eml) shows headers, body in the sealed frame (remote pictures blocked)
  and attachments; ePub reads as one document; Jupyter notebooks as cells with outputs; fonts as a
  specimen (`previews/format-viewers.tsx`). Videos the window cannot play (avi, mkv, wmv…) get an MP4
  rendition when ffmpeg is installed, else Download ffmpeg / Check again. Pictures and scanned PDFs
  are read for text (tesseract, else macOS Vision via a helper compiled once) so search finds them.
- **Open in app:** a file's header offers Open in app (its default app — Word, Excel, Preview,
  LibreOffice) and, in ⋯, Show in folder; back in the window, an edit made there is taken in (new
  size and digest, reprocessed) and the viewer reloads. Pages have Full screen in their header.
- **Editor:** BlockNote (`@blocknote/shadcn`, lazy chunk) dressed through its `--bn-*` variables
  in `library.css` — no class restyling. Files embedded in a page are Library items stored as
  `library://<id>` and resolved per render through the media helpers (local disk or the remote
  media proxy). Pages save a moment after typing stops and when the view closes; importing a
  markdown-only page into blocks is not an edit. The "/" menu (also the block's "+") is BlockNote's,
  with Page and To-do list leading the basic blocks. Page works as in Notion: it makes a sub-page
  under this one on that line and opens it, title focused; the line (`page-block.tsx`) shows the
  sub-page's icon and live title and opens it; deleting the line trashes the sub-page, undo brings
  it back. A sub-page's back arrow and its breadcrumb lead to the page it sits in.
- **Tabs:** every page or file opened gets a tab (`library-tabs.tsx`, the shared `PaneTab` strip), placed
  after the one showing. In the main window the strip sits in the top band right after back / forward,
  where chat tabs go (`WorkspacePageHeaderControl bare`); in a split tile it heads the Library. Closing
  the showing tab opens its neighbour; a trashed item's tab closes itself.
- **Access levels** (per item, the owner's rule for Hermes): `private` (invisible to the agent),
  `ask` (read only after the owner approves), `open` (search and read freely). One glyph set
  everywhere — `ACCESS_META` / `AccessBadge` / `AccessMenu` (`access.tsx`, `access-menu.tsx`).
  New items default to `private`; pages Hermes creates default to `ask`.
- **Consent card:** every agent write, and every protected read, arrives as the `library.consent`
  server request and renders as `LibraryConsentStack` beside the approval stack in the
  transcript: action, target with its access badge, why, what changes, a preview, then
  Decline / Approve (destructive tone for delete). It is not the approval gate: the global
  approvals mode (off / smart / yolo) does not skip it, and no answer is a refusal.

## Surfaces & elevation

Floating panels (base `Dialog`, route overlays, boot/install/update surfaces,
model-picker, onboarding, prompt overlays, notifications) use:

```
shadow-nous           /* downward-weighted, layered contact→ambient falloff */
border-(--stroke-nous) /* currentColor hairline, theme-adaptive */
```

Both are CSS vars in `src/styles.css` — tune in one place, everything inherits.
Don't add per-overlay `shadow-[…]` or `border-(--ui-stroke-secondary)`
one-offs; if elevation needs to change, change the token.

Menus and popovers use their own shared `shadow-md` +
`--ui-stroke-secondary` primitive treatment. Every floating list —
`DropdownMenu`, `Select`, and Popover + cmdk pickers
(`<PopoverContent variant="menu">` + `<Command variant="menu">`) — paints
through `src/components/ui/menu.ts`, so a list reads the same wherever it
opens. Typed fields with suggestions use `ComboboxInput`, never
`<input list>` + `<datalist>` (Chromium paints that as its own OS popup).

Drag affordances may use tokenized
dashed targets and local blur. These are semantic surface classes, not licenses
for call-site shadow or border inventions.

**Queued cards:** `CardStack` (`src/components/ui/card-stack.tsx`) consumes a live,
keyed list, retaining the current item when more arrive. Inline and floating
approvals and both toast placements share its gesture handling and geometry.
The Cursor-reference treatment uses one 96%-scale silhouette 7px above the
front, 220ms promotion, and 180ms upward clearance; no rotation or lateral throw
on button/keyboard decisions. Consumers supply the existing surface tokens and
own the exact-request response. Gestures never grant approval. Departing cards
are immediately inert; toasts can expand to the full live list. One persistent
transcript-level host owns approvals, independent of tool rows and assistant
message boundaries. Prepared approvals can precede tool.start: execution must
not relocate or remount the stack. While approvals remain, a real activity line
above the cards changes from awaiting approval to current-turn command status;
represented execution rows appear only when explicitly expanded. Empty text
continuations must not introduce paragraph gaps. Keep inline approvals beside
the conversation and let genuine content scroll normally; do not inject padding
or write scroll offsets to pin the decision. Preview this order with delayed
start and completion events, not pre-created tool rows. Final approval removal
retires both the painted card and its measured layout footprint; restoring tool
rows must not insert their full height before the outgoing stack can settle.
No completion callback may clear the measurement of a newly arrived card.
Reduced motion settles immediately without retaining empty clearance.

## Window background behavior

Settings → Appearance → Window layout offers **Minimize to tray**, off by default and
local to this desktop installation. When enabled, minimizing ordinary windows
hides them without stopping their work. Close, Alt+F4, and Cmd+Q keep their
normal behavior. The tray's **Show Hermes** restores hidden windows;
**Quit Hermes** keeps the ordinary active-work confirmation and teardown.
On macOS the tray lives in the menu bar; the Dock icon hides only when no normal
window remains visible and returns on restore. If the tray is unavailable,
ordinary minimize/close behavior is retained rather than hiding an unreachable app.

## Window glass

Glass defaults to **29% Tint, Sidebar only** in both light and dark appearances.
Fade defaults to zero so the content column and text stay opaque. Native frost
keeps its platform/appearance defaults. Explicitly saved settings take precedence;
changing defaults must not overwrite a user's existing choices. The shared
`apps/shared/src/translucency.ts` resolver owns these defaults for both the
renderer and Electron's first window paint.

## Stroke & color tokens

| Token                                        | Use                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `--ui-stroke-primary…quaternary`             | hairlines, in descending strength                                                           |
| `--ui-stroke-tertiary`                       | the default in-panel divider / list hairline — and every bordered surface in the transcript |
| `--stroke-nous`                              | the overlay hairline (pairs with `shadow-nous`)                                             |
| `--ui-text-primary / -secondary / -tertiary` | text hierarchy                                                                              |
| `--ui-bg-quaternary`                         | soft control fill (secondary button)                                                        |
| `--ui-widget-surface-background`             | fill for inline chat widgets (`WIDGET_SHELL_CLASS`)                                         |
| `--chrome-action-hover`                      | hover fill for quiet controls                                                               |
| `--theme-primary`, `--ui-accent`             | brand/accent                                                                                |

Never hardcode `border-gray-*`, `bg-white`, `text-black`, etc. The two tiles in
`BrandMark` (white in light mode, `#0d1117` in dark) are the sanctioned literals
(the mark needs a fixed backdrop).

## Buttons — one component

`src/components/ui/button.tsx` is the single source. Pick a `variant` + `size`;
do **not** pass `h-*`, `px-*`, `py-*`, or icon-size overrides.

**Variants:** `default` (primary), `destructive`, `secondary` (soft fill —
the default non-primary look), `outline` (transparent + 1px inset ring, no
fill/shadow), `ghost`, `floating` (a control loose from any surface — opaque
popover fill + `shadow-md`, hover lifts the glyph only), `link`, `text`
(boxless quiet inline — "Cancel", "Clear"), `textStrong` (bold underlined
inline affordance — "Change", "Open logs").
`grip` is the quiet, fill-free drawer handle; pair it with size `grip` for a
48×16 hit area around a small horizontal ridge.

**Sizes:** `default`, `xs`, `sm`, `lg`, `inline` (flush, zero box — for buttons
that sit inside a heading/sentence; replaces `h-auto px-0 py-0`), `micro`
(status-stack/table-footers), and the icon family `icon` / `icon-xs` /
`icon-sm` / `icon-lg` / `icon-titlebar`.

**Tooltips only when hover teaches something new.** `<Tip>` is for discovery,
not a tax on every icon. Ask: does hover reveal something the user cannot
already see or infer? If not, skip the tip; keep an `aria-label` for a11y.

Tip unlabeled chrome when the job (or a keybind / truncated path / host /
other detail) is not already on screen — toolbar / titlebar / statusbar icons,
`TipKeybindLabel` shortcuts, ownership chips, unlabeled icon grids.

Do **not** tip:

- Menu triggers (kebabs / ⋯ / `ActionsMenu` / `DropdownMenuTrigger`) — the
  affordance is "open menu"; verbs live in the menu. Never tip
  `"Actions for ${row title}"` / `"Project actions"` / `"Actions"`.
- Close / dismiss X buttons — the glyph is the label (`aria-label` only).
- Controls whose visible label already says what the tip would ("click to…",
  paraphrases of the same words, timer labels restating "Running").

Never use native HTML `title=` on buttons — unstyled, ~500ms OS delay, clashes
with the themed `Tip`. `src/components/ui/__tests__/no-native-title.test.ts`
fails on any `<button>` / `<Button>` that still carries `title=`.

**Tooltip timing.** A hover is not a click — the cursor crosses triggers on
the way somewhere else. `Tip` waits 200ms before the first open so a sweep
does not flash a trail. After a tip has opened the page is warm: the next
trigger within 300ms opens instantly. The cooldown starts on close, so a
hover a second later waits again. Once triggered, entrance has no animation.
Exit fades over 100ms and moves 0.125rem toward the anchor; reduced motion
disables the exit animation. `OverflowTip` stays on its own longer delay
(list titles must not trail while scanning). Bubbles use a 0.25rem radius.

**Tooltip placement.** Choose intent through `placement`: `control` above (default), `toolbar` below, `row` to the right, and `left-rail` / `right-rail` inward. Explicit `side` and `align` override the preference. Radix flips and shifts for collisions, keeps the arrow attached, and hides detached triggers. Controls and toolbars use their owning pane as a boundary; row descriptions and rails may extend into the window. Use `boundary="viewport"` for an intentional escape. Short labels size to content; descriptions wrap within 24rem and the available space, in one rounded bubble.

**Slash descriptions.** Keep autocomplete rows single-line and ellipsized, but reveal the complete catalog description to the right of the hovered row. Use the shared bounded tooltip, collision padding, and word wrapping; it must not intercept row selection. Catalog and completion producers preserve the full author-supplied description.

**Model search.** Model filters and their highlighted labels treat hyphens, dots, underscores and spaces equivalently. Preserve original label spelling inside marks. The shared highlighter remains literal for other surfaces such as the command palette; model callers explicitly opt in. Model identifier search does not use dictionary spellcheck.

**Keybind hints in tooltips.** On a tipped button bound to a rebindable hotkey,
use `<TipKeybindLabel actionId="..." />` — it reads the i18n label and the
current combo from `$bindings`. Pass `text={...}` only when the label is
context-dependent (e.g. "Show" / "Hide"). Never hardcode combos; always use
`useKeybindHint` or `TipKeybindLabel`.

Notes:

- Text buttons are sized by padding + line-height (no fixed heights). Every
  button box, text or icon, takes the shared `rounded-md` step, so buttons
  follow `--radius-scalar` with the cards, menus and fields around them.
- SVGs inherit `size-3.5` (`size-3` at `xs`). Don't re-set icon size.
- Polymorph with `asChild` when the button must render as a link/Slot.

## Badges — one component

`src/components/ui/badge.tsx`. Variants: `default` (tinted primary), `muted`,
`warn`, `destructive`, `outline`, `solid` (primary fill — icon-corner counts).
Sizes: `default`, `xs`, `overlay` (titlebar glyph counts).

Badges are inert. A metadata chip that does something (filter by category or
tag, search a platform or tool) is a `Button` `size="xs"`: `chip` for facet
values (soft fill + a 0.5px inset shadow ring on hover, so no reflow), `ghost`
for quieter search values. Don't style a Badge to look clickable or add a
separate chip component.

## Reel

The profile rail keeps its create/import actions outside the scrolling squares.
The sidebar's foot is the account row, not the rail: the active profile's photo
(or initial on its colour), its name, and the Settings gear. The name opens the
one menu for who you are here (`profile-dropdown-switcher.tsx`: profiles, fleet
agents, new / import / manage, name and photo of the active profile, gateways, Settings; the row follows whichever profile is active). The rail is an opt-in
strip above it (`$profileRailVisible`, off by default, off in Simple); the
statusbar carries no profile picker. The sidebar's head is the project name,
large, with search behind a magnifier that takes the name's place while open.
The status bar's text rests invisible and returns on hover or focus.
Clipped horizontal edges reuse `edgeMask(edges, 'x')` from `fade-scroll.tsx`;
the default axis remains vertical for `FadeScroll`. Fitting content is unmasked,
and profile drag gestures temporarily remove the mask so the dragged square stays legible.

`src/components/ui/reel.tsx`: one horizontal, snap-scrolling row (catalog
category shelves, screenshot strips). Children keep their width and snap to
the start; set it once from the parent (`className="*:w-68"`). Use it instead of
hand-rolling `flex overflow-x-auto snap-x`.

## Context-sensitive dialogs

Sudo password dialogs keep the backdrop unblurred (`DialogContent`'s
`blurBackdrop={false}`) and show the complete, selectable command before the
password field. Long commands wrap and scroll; missing backend context is
explicit, never inferred from another tool row. Other dialogs retain the shared
blurred backdrop.

A dialog opened from inside another (an image lightbox over a catalog detail)
stacks above it automatically, so its backdrop dims the parent too. Media
viewers use a heavier scrim through `overlayClassName`. Controls that belong to
the dialog but mustn't scroll with its body (prev/next pagers) go in `chrome`,
which may sit past the dialog's edges.

## Form controls

- **`controlVariants`** (`src/components/ui/control.ts`) is the shared shape for
  `Input` / `Textarea` / `SelectTrigger`. New text-entry controls compose it.
- **`SearchField`** — borderless, underline-on-focus, auto-width. The only
  search input. Don't build boxed search bars; don't wrap it in a bordered tile.
  `variant="box"` is the one bordered form: a full-width rounded field for
  pages where search is the primary affordance (the Skills/Plugins catalogs).
  Empty lists hide their search field.
- **`SegmentedControl`** — the choice control for small mutually-exclusive sets
  (color mode, tool-call display, usage period). Replaces radio piles and
  pill rows. A two-state view switch (list/cards, list/tree) is not a segmented
  control: it's one ghost `icon-xs` `Button` showing the mode it switches to.
- **`Switch`** (`size="xs"`) — bare, with `aria-label`. No bordered text wrapper.
- **`FanMenu`** (`src/components/ui/fan-menu.tsx`) — one hub control that
  fans sibling toggles out on hover: `direction` `vertical` | `horizontal`
  (split around the hub) | `arc`. Discs are `Button` `floating` off /
  `default` on; tips face outside the fan according to its geometry. Use it where a row of rarely
  touched toggles is costing input width (the composer's voice controls).

## Layout

- **Roundness:** one knob, `--radius-scalar` (`styles.css`): every `rounded-*`
  step is the scalar × its rem base. Don't write px radii on a component; pick
  the step.
- **Reading column:** `--composer-width` is the width the thread content and the
  docked composer share, centred in the pane (`min(width, 100% - 2rem)` narrow).
  `--composer-radius` (0.75rem) is the bar's corner radius, shared by the docked composer and HUD
  mode's bar so the two never drift.
- **Gutters:** `PAGE_INSET_X` (`src/app/layout-constants.ts`) for page side
  padding; `PAGE_INSET_NEG_X` to bleed a child to the edge. Don't hardcode
  `px-6`/`px-8` on pages.
- **Master/detail overlays:** `OverlaySplitLayout` + `OverlaySidebar` /
  `OverlayMain`. Cron, profiles, etc. ride this — don't rebuild a titlebar
  shell.
- **Filter rails** reuse the same pieces: `SidebarPanelLabel` (its `meta` slot
  carries the result count), `SidebarDateDivider` group headings, and `nested`
  `OverlayNavItem` rows. Facets are multi-select: each row is `pressed`, with a
  `CheckboxMark` in `leading` (the row is the control; a real `Checkbox` would
  nest a button), and an "All" row clears the group. No radio glyphs. A text
  "Clear" sits on the label row while anything is filtered. Cap long facets
  (tags) to the top values plus the selection; search covers the tail.
- **Settings subpages:** `OverlayNav` keeps navigation and disclosure separate:
  labels navigate; the shared `DisclosureCaret` button opens a branch without
  changing the page. Active paths reveal automatically, inactive paths stay
  folded unless manually opened. General comes first wherever present; parent
  labels and parent URLs open the first ordered subpage, never an overview or
  the last visited child. Explicit child links retain their destination;
  every parent and child uses the same Settings breadcrumb, without a duplicate
  icon-and-title heading. Page-level `SectionHeading page` retains actions and
  counts under breadcrumb-owned chrome; embedded callers keep their headings.
  Narrow windows keep every destination available in the shared navigation dropdown.
  Search and saved field links resolve to the owning child before highlighting.
- **Rows:** `ListRow` (settings `primitives.tsx`) for label/description/action
  rows. Flat, flush-left; no per-row indentation that fights flush headers.
- **No dividers between rows** unless the list genuinely needs them; prefer
  spacing. When you do need one, it's a single `--ui-stroke-tertiary` hairline.

## Panel titlebars

Top-edge panels extend into the native titlebar band. Their tab strips remain
inside their own zones so tab drops, focus, and split boundaries use the same
geometry. Panels without room beside the measured window controls place their
tabs on a full-width row below the controls. Minimized row groups use vertical
restore rails, including groups with multiple tabs. Sidebar buttons and shortcuts
restore minimized or fully hidden side groups without changing the selected tab.
Lower panels keep local headers. Empty header space moves the window;
tabs and actions remain no-drag, with native-control space reserved from the
existing traffic-light and Window Controls Overlay measurements.

The left cluster shows sidebar and back / forward, plus the layout editor and HUD when App Actions is set
to Left. On the right, the right-sidebar toggle is always there and everything else on that edge belongs
to the open sidebar: while it is closed a single button remains (the one that opens it); while it is open
Layout, HUD and Swap sidebar sides stand beside it (`showsOnRightEdge`, reading `$rightSideOpen` — the
physical right column from the layout tree, the same one the toggle folds). Haptics remain in settings.
Settings has one door — the gear in the sidebar's footer (⌘, from anywhere) — and Swap sidebar sides is
also a row in Settings → Appearance → Window & layout (⌘\ still flips); Settings is not a titlebar button.
In Simple interface mode only sidebar and the layout editor render,
and the reserved cluster width shrinks with them (`TITLEBAR_FIXED_TOOLS` is the
one table both the buttons and the width reservation read).
Holding Cmd (Ctrl off macOS) reveals small slot numbers over the target strip's
status dots after 400ms, without changing tab widths. Hints follow the same
binding and hovered/focused-zone resolver as the number shortcuts.

Tab close buttons fade the label with a content mask, not a painted gradient.
The tab reads its surface token directly so glass tint is painted only once.
Tab labels are sentence case. A horizontal tab marks itself with a soft inset
pill (`::before`, `--ui-row-active-background`, the same band as a selected
sidebar row) — no underline, no seams between tabs; hover lights the pill with
`--ui-row-hover-background`. Vertical rails keep their edge line and wash.
Section headings in side panels (`SidebarPanelLabel`, `SidebarDateDivider`,
`PanelSectionLabel`, menu section labels) are sentence case in tertiary ink.

Settings is not page navigation: its visible door is the gear at the end of the
sidebar's profile area (beside the rail), opening the same route as ⌘, and the
titlebar tool. The titlebar keeps its gear as the way back in Simple mode.

Sticky user messages clip covered scrolling content, including the gap above
them. Their wrappers stay unpainted; only the rounded user bubble owns a fill.
Clipping follows the pinned prompt and its live height without changing layout,
so glass and message-bubble transparency do not reveal scrolling text.

## Feedback & empty/error/loading states

- **Loading:** `Loader` (`src/components/ui/loader.tsx`) — animated math/ascii
  curves (`lemniscate-bloom` for long ops). Never ship the literal text
  "Loading…".
- **Errors:** `ErrorState` + the canonical `ErrorIcon` (no bg chip). One look
  for the React boundary, in-dialog errors, and the boot-failure banner. Pass
  nodes for title/description so Radix `DialogTitle`/`Description` can flow
  through for a11y.
- **Logs:** `LogView` — no bg, hairline border, tight padding, small mono.
  Every place we surface raw logs uses it.
- **Empty:** `EmptyState` for plain page bodies; `PanelEmpty` for overlay
  master/detail empties with an icon and action. Don't hand-roll a third
  centered empty.
- **Confirmation:** `ConfirmDialog` is the only way we ask "are you sure". It
  opens focused on Confirm, so `Enter` confirms and `Esc` cancels, and it owns
  the pending → done → close beat and the inline error — a call site passes an
  async `onConfirm` and nothing else. A third way out (e.g. "Remove from
  sidebar" beside "Delete worktree") goes in the one `secondaryAction` slot.
  Never `window.confirm`: it's an unstyled blocking Chromium modal. A handler
  that wants the answer inline instead of a mounted dialog calls `confirm()`
  from `src/store/confirm.ts`, which renders this same primitive through the
  single `ConfirmHost` at the shell — the way `notify()` backs notifications.

## Chat, tools & boot surfaces

- The transcript and composer are built on `@assistant-ui/react`. Extend the
  existing components under `src/components/assistant-ui` and
  `src/app/chat/composer`; do not fork a second markdown, message, tool-call, or
  approval renderer for one feature.
- **Moment cards** (`components/assistant-ui/cards/`): a ```` ```card ```` fence is one of the fixed moments
  as JSON (`card-spec.ts`: place, map, itinerary, event, product, link — http(s) links and images only,
  real coordinates only; a spec that cannot be drawn shows as code). Each is drawn on the agent-card
  surface (`agent-card.tsx`): a place with a live map, rating, open status and Directions (OpenStreetMap);
  a map of places on the figure area with photo pins and a scrolling row of place cards that select each
  other; an itinerary as a timeline per day; an event with a date tile and Add to calendar (an .ics
  file); a product with price, was-price, badge and features; a link as a preview. Buttons only open the
  link the card names or put a sentence in the chat as the user (a product's Buy asks the agent to walk
  through it — nothing is ordered); in an imported conversation a card stays code. Maps are MapLibre GL
  6 (`place-map.tsx`, its own lazy chunk) on OpenFreeMap — Positron in light, Dark in dark, no key —
  with Ctrl/⌘-scroll zoom and the required credit kept small on the card's surface; the worker loads
  from the same release on jsDelivr, so it works from the dev server and the packaged file:// page alike.
- **Teaching the agent** (`skills/creative/inline-widgets/`): the skill opens with how to choose the form
  (text, Markdown table, ```chart, ```card, ```mermaid, ```widget, a ::preview page) and keeps a worked
  example per scenario in `references/examples.md`. `cards/skill-examples.test.ts` draws every ```chart
  and ```card block in the skill with the app's own parsers, so an example can never teach a block that
  falls back to code. The desktop platform hint names both fences and forbids inventing data to fill them.
- **Charts** (`components/assistant-ui/charts/`, ECharts 6 bundled in its own lazy chunk): a ```` ```chart ````
  fence is a chart described as JSON (`chart-spec.ts`: bar, line, area, donut, pie, scatter, KPI tiles,
  table; forgiving aliases, strict limits — a spec that cannot be drawn shows as code). The app draws it
  in its own design line (`chart-option.ts`): theme colours resolved to plain rgba once per theme, one
  accent with more hues only when series must be told apart, shades of one hue for parts of a whole,
  hairline grid, legend at the top left, tooltips that read like the app's cards, Ctrl/⌘-wheel zoom on
  long series (never the plain wheel — it scrolls the chat). The card sits on the figure area like a
  widget, its height follows its width, and on hover it offers full screen and Add to page — which saves
  a live ECharts page (CDN build, option as data) or, for KPIs and tables, a plain one.
- **Agent cards** (`components/ui/hermes-card.tsx`, tokens `--card-*` in `styles.css`): every moment the
  agent hands the user — an approval, a question, a Library consent, a network request — and every
  inline widget shell (`WIDGET_SHELL_CLASS`) sits on one raised surface: 24px radius, a hairline, an
  inner top light and a soft shadow that pools below (its own values in dark). The card reads top to
  bottom the same way each time: a tinted icon tile whose tone says what kind of moment it is (accent
  for a question or a Library action, warning for a command, danger for a delete), a small eyebrow and a
  semibold title, inset wells for details (the command, the target item, a preview), then a footer of
  pill buttons with an optional note on the left. Choices are soft rows with a round letter badge —
  a well at rest, an accent ring under the keyboard cursor, an accent tint once picked — and the
  "Other" answer is typed straight into its row. Approval, clarify, `::ask`, Library consent and the
  widget network banner are built from these parts; new card kinds (places, maps, products) are meant to
  be too.
- **Inline widgets** — a tool result that renders as a panel the user reads or
  acts on (clarify, artifact card) wears `WIDGET_SHELL_CLASS`
  (`src/components/chat/widget-shell.ts`): shared radius, the
  `--ui-widget-surface-background` fill, no border. Its actions sit _outside_
  the panel, below it. Don't give one widget its own radius or fill.
- Bordered surfaces in the transcript (tables, fences, callouts, attachments)
  use `--ui-stroke-tertiary`. Not `border-border` — that's the app-wide
  default and reads too hot against the thread.
- Interactive directive chips in the composer expose their action on hover.
  The action stays visible for a 500ms grace period while the pointer crosses
  from the chip to the floating pill; leaving both dismisses it.
- A tool result may expose an inline action that opens a preview. It must not
  open the rail automatically.
- Tool rows reserve destructive red for explicit failures. Missing read paths and
  ambiguous exit-1 results use neutral notices, with details still available.
  Errors described inside returned data are not tool failures. Expanded failures
  show the actual explanation; supporting output keeps its normal text color.
- Nested transcript scrollers keep their height caps and hand vertical scrolling
  back to the thread at either edge (`overscroll-behavior-y: auto`), even when
  their content fits. Only the outer thread contains vertical overscroll;
  horizontal code/output boundaries may remain contained. Thinking previews
  follow new tokens only while near the bottom, preserving the user's reading
  position until they scroll back down.
- Composer status groups start collapsed except todos. Progress updates and queue
  pause/resume preserve the user's disclosure choice. Error banners meet the
  stack's top edge without a blank padding strip. File and preview links remain
  visible at the bottom of the stack, below the queue and all status groups.
  A centered ridge on the composer's top edge hides/reveals the entire stack,
  including the git row, with a short downward/upward drawer slide. Its choice
  persists per conversation and owner, not globally. Hidden sections stay
  mounted but inert so their disclosure choices survive; reduced motion is instant.
- Popping out a composer makes it the window's only visible composer. It keeps
  its viewport placement while hover or keyboard focus selects a chat pane;
  moving back into the editor retains that recipient. Drafts, attachments and
  queues stay session-owned. Docking restores the individual pane composers.
  In either placement, moving into a chat pane gives its editor typing focus
  immediately and preserves its caret. Layout-only hover events and delayed
  focus callbacks cannot replace that choice, and a live transcript selection
  is never cleared by focus-follow. Movement within the same pane
  must not flush React; deliberate Tab navigation and clicked controls still work.
  An inline message edit is a typing target of its own: opening one keeps focus
  in the edit editor, and neither its mount-time focus nor mouse movement while
  it is open hands the caret back to the pane composer.
  Active dictation or voice conversation pins the recipient until capture ends,
  keeping the microphone's stop controls and shortcut attached to its owner.
- Status-stack rows use `StatusRow` with a leading `dismiss` action, a state
  icon and optional trailing actions. `StatusDismissButton` owns the Codicon
  close button for previews, background tasks and queued prompts; do not swap
  it for a trash icon or a CSS glyph. Icons and controls align to the first text
  line, including messages with attachment metadata.
- `status-stack.css` owns the shared columns and `0.25rem` nesting step. Rows
  own their padding and full-width hover fill. `StatusControlRow` uses the same
  columns for goal/loop/heartbeat details; `StatusPendingIcon` supplies the
  dashed marker for tasks and criteria. The first row keeps its normal padding;
  the stack adds no extra top inset.
- Keep the rounded status card stationary, with the bounded scroll viewport
  inside it. The outer scroll boundary uses `overscroll-behavior-y: contain`;
  nested rosters and transcripts use `auto` so wheel input can hand off at an
  edge without trapping it or scrolling the chat behind the stack.
- Install, onboarding, connecting, boot failure, and reauthentication are
  distinct states with shared visual primitives. Preserve their recovery
  semantics when unifying appearance.
- Guide startup has a dedicated landing screen with the shared long-operation
  Loader and a localized startup label. It remains active until the guide's
  saved conversation is loaded. No greeting, composer, Skip setup, or statusbar
  appears early. Reduced motion uses a static BrandMark and the same label.
  On readiness, reveal the real conversation and fade controls in over 100ms.
  Never fabricate progress, delay readiness for motion, or replace a resumed
  conversation with a new greeting.
- Respect `AppShell` overlay ownership. Persistent terminal/content layers,
  route overlays, dialogs, and boot surfaces must not compete through ad-hoc
  z-index literals. Pick a rung of the ladder in `styles.css` instead —
  `--z-modal-backdrop` / `--z-modal` / `--z-modal-popover`, `--z-over-modal`
  (toasts, tooltips, command surfaces) and `--z-over-modal-content`,
  `--z-switcher-backdrop` / `--z-switcher`, then the boot chain
  `--z-connecting` → `--z-onboarding` → `--z-setup` → `--z-crash`. Plain
  `z-10`/`z-20` are still right for stacking _within_ one component.

- **Video in the chat**: a YouTube URL the agent writes bare on its own line becomes the consent facade of `embeds/url-embed.tsx`; the click on Load (or on "Always allow") is the gesture that starts it, so the player is built with `autoplay=1` — one click, not two — while a provider already allowed plays only when pressed. The packaged app is a `file://` page whose frames send no Referer, and YouTube answers that with error 152/153; `electron/embed-referer.ts` gives the player's requests the project's own site on the window's session (it shares that session's single `onBeforeSendHeaders` listener with the remote-header rules). A Referer of YouTube itself is rejected as well, which is why it names another site. The desktop prompt tells the agent to write the real URL bare, never `[text](url)` and never a guessed id.

- **Video cards** (`cards/video-card.tsx`, ```card `video` / `videos`): a poster — the agent's, or the one YouTube keeps for the id (`hqdefault`, whose letterbox the 16:9 crop removes) — with a play button and the duration; the title, channel, views and date are only what the agent copied from its search result, never fetched. Pressing play swaps the poster for the same lazy player as the bare-link embed, with `autoplay`; that press is the consent, so the card needs no Load step. In a `videos` card the chosen one is the stage and the others a row of posters (the shape of the map card). Only YouTube links become videos (the provider matcher is the gate). With embeds switched off in Settings the posters are not fetched and play opens the browser. A video its owner has not allowed to be embedded shows YouTube's own "unavailable" screen with its Watch button; the card's "Open on YouTube" is the way out.

## Iconography & brand

- **Tabler** is the default component/chrome set. Import its curated aliases and
  `iconSize` scale from `src/lib/icons.ts`; do not import icon packages directly
  in feature code.
- **`Codicon`** is the compact editor/tool/status vocabulary. Use
  `src/components/ui/codicon.tsx`, including `codiconIcon()` where a
  Tabler-shaped component is required.
- Pick the vocabulary by semantic context and reuse the existing icon for an
  action. Do not introduce a third icon set or mix styles within one control
  group.
- **`BrandMark`** (`src/components/brand-mark.tsx`) is the brand glyph — the
  `nous-girl` mark on a fixed tile, theme-aware: black girl on white in light
  mode, white girl on the `#0d1117` dark tile in dark mode (keyed off
  `renderedMode` so bright surfaces in dark skins stay on the light mark).
  The marks are generated by `scripts/generate_icons.py` from the girl SVGs
  - squircle backgrounds (`assets/nous-girl-*.svg` × `assets/backgrounds/`).
    It replaced scattered Sparkles glyphs in updates / onboarding / about. Use it
    for hero/brand moments; don't reintroduce decorative star/sparkle icons.

## Motion

- The empty chat's hero (`components/chat/intro.tsx` + `intro.css`) is a
  constellation brain — no glow behind it, the page runs straight to its edge — a time-of-day greeting
  (`t.introGreeting`) and the rotating prompt. The artwork
  (`public/intro-brain.png`) is a luminance mask — white with its own alpha, the
  source's lettering removed and its cut-off foot dissolved — inked per theme in
  CSS in neutral tones: white-to-grey on dark pages, near-black on light ones. The greeting rides up
  over the figure's faded foot so the two read as one composition; the figure's
  size follows the window's height and gives way first when it is short, so the
  prompt line stays clear of the fade above the composer. It arrives once, then
  breathes slowly. Both loops pause with the hidden-window gate and still under
  reduced motion.
  When the splash gives way to a conversation, the transcript fades in where
  it stood (`useIntroHandoff`, opacity only — stick-to-bottom measures rects).

- Visible windows keep animating when another app takes focus. Hidden/minimized
  windows and inactive panes may pause; background polling stays focus-gated.
- Animated integer counts reuse `AnimatedInt` in `src/components/ui/diff-count.tsx`.
  Its spring updates the DOM directly without per-frame React renders.
- Quick, functional transitions (~100ms on controls). Respect
  `prefers-reduced-motion` for anything beyond a fade.
- Choreographed exits (e.g. onboarding's "matrix" fade-down) stagger per-element
  then settle the surface — the outer container's fade is _delayed_ so it
  doesn't swallow the inner animation. Don't let a global fade race the detail.
- Motion follows state; it never delays state. Selection, drag targets, cancel,
  and pressed feedback paint in the current frame.
- Do not animate layout geometry with `transition-all` on a hot interaction.
  Name the properties, avoid backdrop-filter repaints during movement, and
  remove animation before masking a performance problem.

## Direct manipulation & performance

`Masonry` (`components/ui/masonry.tsx`) packs natural-height cards into responsive
lanes, using CSS `display: grid-lanes` where supported. Older Electron versions
use one ResizeObserver and frame-batched placement; child DOM/source order stays
intact through resizing, media loading, and disclosure. It owns the shared gap;
`--masonry-min-width` optionally changes the minimum lane width. It knows nothing
about what it holds: catalog results and discovery shelves opt into their hover
treatment (sibling dimming, the pointer-following glow) from the catalog's own CSS.

The app should feel instant under real load — long transcripts, several panes,
live streams. Design toward that:

- Direct manipulation paints first; persistence reconciles after and rolls back
  visibly on failure.
- Keep interaction feedback cheap: hot-path state stays local or narrowly
  derived, not wired into heavy trees; pointer work coalesces per frame.
- One drop region has one visual owner, and drop targets speak one affordance
  language across files, sessions, tabs, and panes. Overlapping targets resolve
  to the active one instead of stacking overlays.
- Forgiving geometry beats pixel-perfect triggers; edge actions live near their
  edge, not clustered in the center.
- Expensive stateful surfaces stay mounted when hidden. Visibility is not
  lifecycle.

Prove speed with realistic content. A fast empty-state demo says nothing about a
long transcript or a busy terminal.

## Keyboard & cancellation

- Keyboard ownership follows focus. The focused surface wins its keys; shell
  shortcuts must not steal a terminal's or editor's bindings.
- Focusing the Sessions sidebar preserves the last active chat's visual emphasis.
  Dimming still distinguishes session panes; sidebar navigation must not desaturate
  the chat or transfer its active highlight to a hidden primary tab.
- Focused and hovered chat panes both retain full color and opacity. Only panes
  that are neither focused nor hovered recede, with 20% desaturation.
- Register global shortcuts through the shared layer, not ad-hoc listeners.
- One cancel gesture does one thing: cancel the active interaction, or close the
  topmost dismissable surface — never both, never the control underneath.
- Cancellation is synchronous in the UI even if cleanup is async: overlays,
  cursors, and pending gesture state clear at once.
- Flows that deliberately cannot be dismissed (install/onboarding, destructive
  confirmation) must make that explicit.

## i18n

- Every user-facing string goes through `useI18n()` (`src/i18n/context.tsx`).
  No literals in JSX.
- **Update all locales together** — every catalog registered in
  `src/i18n/catalog.ts`. A string change in `en.ts` that skips the others is a
  regression (drifted punctuation, stale labels). Keep trailing-punctuation and
  tone consistent across all of them. `fr`, `de`, and `es` are complete
  `Translations` objects, so a key missing there fails the type check; the
  `defineLocale()` overlays fall back to English instead.

## State (TypeScript)

The detailed state contract lives in the scoped
[`AGENTS.md`](./AGENTS.md). Visual code follows these essentials:

- Shared/cross-component state → small **nanostores**, not prop-drilling.
  Each feature owns its atoms; shared atoms live in `src/store`.
- Rendering components subscribe with `useStore`; non-render actions read with
  `$atom.get()`.
- Subscribe to derived coarse facts instead of high-frequency source atoms when
  the component does not render the full value.
- Colocated action modules over god hooks. A hook owns one narrow job.
- Keep persistence beside the atom that owns it. Route roots stay thin.
- Prefer `interface` for public props; extend React primitives
  (`React.ComponentProps<'button'>`, `Omit<…>`).

## Affordances

- `cursor-pointer` at the primitive level (Button, dropdown/select) — don't
  hardcode it per call site.
- Global focus-ring reset; titlebar actions have no active-background state.
- `Esc` closes every dismissable overlay/dialog (install/onboarding excluded);
  close is an x-icon, not the word "Close".

## Before you add something — checklist

- [ ] Reuse a primitive (`Button`, `SearchField`, `SegmentedControl`,
      `ListRow`, `Loader`, `ErrorState`, `LogView`, `ConfirmDialog`) instead of
      forking one?
- [ ] Tokens (`--ui-*`, `shadow-nous`, `--stroke-nous`) — zero raw colors /
      one-off shadows?
- [ ] No `className` overriding a primitive's padding / size / radius / chrome?
- [ ] Tips only where hover teaches something new (no kebab / menu-trigger
      tips; unlabeled chrome that needs discovery gets `<Tip>` + `aria-label`)?
- [ ] No native `title=` on buttons?
- [ ] Keybind hints on tipped buttons use `useKeybindHint` / `TipKeybindLabel`?
- [ ] Overlay uses `shadow-nous` + `border-(--stroke-nous)`, no hard border?
- [ ] Flat — no card-in-card, no gratuitous row dividers?
- [ ] No automatic navigation, focus steal, or pane opening from background
      events?
- [ ] Direct manipulation paints immediately and rolls back cleanly on failure?
- [ ] Hot interactions avoid broad subscriptions, layout thrash, and
      `transition-all`?
- [ ] Keyboard ownership and single-action `Esc` behavior are correct?
- [ ] All registered locales updated for any new/changed string?
- [ ] `cursor-pointer`, focus ring, and `Esc`-to-close behave?
- [ ] Touched a primitive, token, or variant? Its named-contract entry in this
      file is updated in the same change.


## Companion chat (Hermes beside an item)

A chat opened with the Library's "Brain" button is a *companion*: `$companionChats` (`store/side-chat.ts`)
marks it, the tile registers `bare`, and `resolveTabStripVisible` hides the strip while a bare pane is alone
in its zone — no title, no "+". The chat keeps two quiet handles in its own corner (open as full chat, close);
opening it as a full chat unmarks it and the strip returns. A second tab joining the zone also brings the strip back.

## Presentations without a text box

The slide canvas is the only editor. Hovering a block shows its tools (add after, move up/down, delete);
"/" in an empty block opens the same menu (heading, text, bullets, numbered, quote, code, image) and the
choice replaces the empty block. Block operations are pure functions in `deck-blocks.ts` (`insertBlock`,
`moveBlock`, `removeBlock`); the UI only calls them. ⌘Z / ⇧⌘Z walk a per-editor history (slides, blocks, themes).
Markdown is still the stored format — Hermes and exports read the same text.

## Hermes sees what you see, edits as you watch

- **View** — the desktop tells the backend what is open (`library.set_view`: item, slide, table selection) through
  `view-context.ts`; the `library` tool's `view` action reads it fresh from the item. Nothing is added to messages,
  so prompt caching is untouched.
- **Slide edits** — the tool's `edit` action takes a list of `set_slide / insert_slide / remove_slide / move_slide /
  set_theme` (`hermes_cli/library_deck.py`, mirror of `deck.ts`): one approval, applied together or not at all,
  the page snapshotted first (so Undo works). The deck opens on the first changed slide; changed thumbnails glow.
- **Both of you at once** — a presentation's save is a three-way merge (`merge3.ts`: base = what the server last
  had, mine, theirs) instead of last-writer-wins. Different slides/blocks merge silently; the same lines keep the
  owner's words and say so. Real multi-user collaboration (CRDT) is a separate stage.

- **Seeing the slide** — `view` with `look: true` asks the owner's window for a picture (`library.snapshot` server
  request, answered with a PNG data URL): the open presentation rasterizes its current slide (`rasterize.ts`, an SVG
  `foreignObject` painted on a canvas, editing tools left out) and the tool saves it under `library/snapshots/` and
  returns the path, which the agent gives to `vision_analyze` (native image input when the model can see, the auxiliary
  vision model otherwise). Presentations draw themselves (inline styles); tables and pages are drawn from the app's look by copying each element's computed style (`rasterizeElement(..., { styled: true })`; pseudo-elements and sandboxed block iframes are not captured). Files without a viewer of their own (PDF, HTML) answer "no picture" and keep the text.

## Export formats

Every item exports through one list per kind (`export-formats.ts`: `exportFormatsFor`), shown as "Export ▸" in the item's
⋮ menu and, for presentations, in the toolbar's Export menu. Pages: PDF, HTML, Markdown, ZIP (page + HTML + its pictures
under `assets/`). Presentations: PowerPoint, PDF, Markdown, slide images (ZIP of PNG), everything (ZIP). Tables (CSV/TSV):
CSV, TSV, JSON, Markdown, Excel (.xlsx, written by hand with fflate — not opened in Excel itself), ZIP. Images: PNG/JPEG/WebP
(canvas re-encode), original, ZIP. Folders: a ZIP of the whole tree from the folder's row menu (capped at 3000 items / 400 MB).
The file-making parts are pure and tested; `export-actions.tsx` reads, builds and downloads.

The row menu has one "Details" (⌘I, the info panel) in place of Quick Look + Get info; Space still opens Quick Look from the
keyboard. "New" has a Table entry that creates an empty CSV and opens it in the sheet editor.

- **One companion chat.** "Brain" on any Library item goes to the chat already docked beside the Library (`ensureCompanion` in
  `chat-bridge.ts`, with an in-flight guard so a double press cannot open two); a second item arrives as one more attachment
  in that chat's composer (`addTileAttachment`, `store/composer.ts`).
- **Details = Quick Look + facts.** "Details" in an item's menu opens the large preview with the facts column beside it
  (the "Details" button in the preview toggles it); Space opens the preview alone. ⌘I still toggles the side panel.
- **Pointing at the sidebar opens the sidebar.** Resting on the show-sidebar button, or on the window's left edge for
  0.8 s, docks THE sidebar exactly as pressing the button does, and moving away closes it (`store/sidebar-peek.ts`); pressing
  the button meanwhile keeps it open. There is no separate overlay look to drift: same icons for Sessions/Bots, no text tabs.
  (A narrow window keeps its own overlay reveal.)
- Presentations also export as Word (.docx, `deck-docx.ts`: paragraphs, headings, lists, quotes, code and pictures;
  read back with macOS `textutil`, not opened in Word itself).

- **The companion chat docks to the LEFT of the page** (`$sideChatOpener` in `wiring.tsx`), like a studio: chat beside, work
  in the middle. Its two handles (open as full chat, close) stand in the window's top strip on the chat's right edge, level
  with the back/forward arrows (`companion-frame.tsx`, drawn through a portal and placed from the chat's measured edge).
