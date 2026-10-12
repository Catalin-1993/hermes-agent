import { useStore } from '@nanostores/react'
import {
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  dropdownMenuSectionLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Loader } from '@/components/ui/loader'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { isDesktopFsRemoteMode, selectDesktopPaths } from '@/lib/desktop-fs'
import { confirm } from '@/store/confirm'
import { notifyError } from '@/store/notifications'

import { ACCESS_META, ACCESS_ORDER } from './access'
import { $libraryClipboard } from './clipboard'
import { CreateWithHermesButton } from './create-with-hermes'
import {
  $libraryRevision,
  bumpLibraryRevision,
  copyLibraryItems,
  createLibraryFolder,
  emptyLibraryTrash,
  type LibraryItem,
  type LibrarySort,
  listLibrary,
  localPathOf,
  moveLibraryItems,
  purgeLibraryItem,
  trashLibraryItem,
  updateLibraryItem
} from './data'
import { fileCategoryOf, ITEM_TYPE_TINT, itemTypeOf } from './file-types'
import { LibraryInspector } from './inspector'
import { gridColumns, type LibraryKeyAction, libraryKeyAction } from './library-keys'
import {
  $libraryViewPrefs,
  activeFilterCount,
  type LibraryFilters,
  type LibraryViewPrefs,
  naturalOrder,
  NO_FILTERS,
  setLibraryViewPrefs
} from './library-prefs'
import { SearchTool, ViewToggle } from './library-tools'
import { LibraryGridView, LibraryListView, type LibraryViewModel } from './library-views'
import { useMarquee } from './marquee'
import { MoveDialog } from './move-dialog'
import { $activeSavedSearch, $libraryTags, $organizeDialog, $savedSearches } from './organize'
import { TagMenuItems } from './organize-ui'
import { QuickLook } from './quick-look'
import { nextSelection, selectionGesture } from './selection'
import { SortFilterMenu } from './sort-filter-menu'
import { LIBRARY_TEMPLATES, type LibraryTemplateId } from './templates'
import { enqueueLibraryFiles, enqueueLibraryFolder } from './upload-queue'

export type LibrarySection = 'all' | 'favorites' | 'files' | 'images' | 'pages' | 'recents' | 'trash'

const QUERY_DEBOUNCE_MS = 180
/** Recent: the most recently edited pages and files. */
const RECENTS_LIMIT = 30
const PROCESSING_POLL_MS = 1500
/** The drag payload for Library items moving inside the Library. */
const LIBRARY_DND = 'application/x-hermes-library-items'

interface LibraryListing {
  failed: boolean
  items: LibraryItem[] | null
  trail: LibraryItem[]
}

/** `flat` lists across the whole tree (a tag or a saved search), even with no text query. */
function useLibraryListing(
  section: LibrarySection,
  folderId: null | string,
  query: string,
  tag: null | string,
  flat: boolean
): LibraryListing {
  const revision = useStore($libraryRevision)
  const { order, sort } = useStore($libraryViewPrefs)
  const [state, setState] = useState<LibraryListing>({ failed: false, items: null, trail: [] })
  // While files are being processed the listing looks again, until every card has its final face.
  const [poll, setPoll] = useState(0)
  const processing = state.items?.some(item => item.status === 'pending') ?? false

  useEffect(() => {
    if (!processing) {
      return
    }

    const timer = window.setTimeout(() => setPoll(n => n + 1), PROCESSING_POLL_MS)

    return () => window.clearTimeout(timer)
  }, [processing, state.items])

  useEffect(() => {
    let live = true
    const q = query.trim()
    const browsing = section === 'all' && !q && !flat

    const timer = window.setTimeout(
      () => {
        listLibrary({
          kind: section === 'pages' ? 'page' : section === 'files' || section === 'images' ? 'file' : undefined,
          order: section === 'recents' ? 'desc' : (order ?? undefined),
          parentId: browsing ? (folderId ?? '') : undefined,
          query: q || undefined,
          scope: section === 'trash' ? 'trash' : section === 'favorites' ? 'favorites' : 'all',
          sort: section === 'recents' ? 'updated' : sort,
          tag: tag ?? undefined
        }).then(
          ({ items, trail }) => {
            if (!live) {
              return
            }

            const shown =
              section === 'images'
                ? items.filter(i => fileCategoryOf(i) === 'image')
                : section === 'files'
                  ? items.filter(i => fileCategoryOf(i) !== 'image')
                  : section === 'recents'
                    ? items.filter(i => i.kind !== 'folder').slice(0, RECENTS_LIMIT)
                    : items

            setState({ failed: false, items: shown, trail: browsing ? (trail ?? []) : [] })
          },
          () => live && setState(current => ({ ...current, failed: true }))
        )
      },
      q ? QUERY_DEBOUNCE_MS : 0
    )

    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [flat, folderId, order, poll, query, revision, section, sort, tag])

  return state
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

const dragIds = (event: DragEvent): string[] => {
  try {
    const parsed = JSON.parse(event.dataTransfer.getData(LIBRARY_DND) || '[]') as unknown

    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

const carries = (event: DragEvent, type: string) => event.dataTransfer.types.includes(type)

const NOTHING_CUT: ReadonlySet<string> = new Set()

interface LibraryHeaderProps {
  /** Beside the title: New, Empty trash. */
  actions?: ReactNode
  /** The containers above the current folder, as drop-ready links; empty at the root. */
  crumbs?: ReactNode
  heading?: ReactNode
  /** The view tabs. */
  tabs: ReactNode
  /** End of the tabs row: search, sort, filter, list/grid. */
  tools?: ReactNode
}

/** Breadcrumb + title + actions, then the view tabs with their tools — the Library's one header shape. */
export function LibraryHeader({ actions, crumbs, heading, tabs, tools }: LibraryHeaderProps) {
  const { t } = useI18n()

  return (
    <header className="shrink-0 px-8 pt-7">
      {crumbs}
      <div className="flex items-center gap-2">
        <h1 className="m-0 mr-auto flex min-w-0 items-center gap-2.5 text-[1.625rem] font-semibold tracking-tight text-(--ui-text-primary)">
          {heading ?? t.library.title}
        </h1>
        {actions}
      </div>
      <div className="mt-4 flex items-center gap-2 pb-4">
        {tabs}
        <div className="ml-auto flex shrink-0 items-center gap-1">{tools}</div>
      </div>
    </header>
  )
}

interface LibraryBrowserProps {
  /** The folder being browsed in All (`null` = the root). */
  folderId: null | string
  onCreatePage: (template: LibraryTemplateId, parentId: null | string) => void
  /** A blank presentation, into `parentId`. */
  onCreateDeck: (parentId: null | string) => void
  /** A blank table (an empty CSV), into `parentId`. */
  onCreateTable: (parentId: null | string) => void
  /** Describe-it-and-Hermes-makes-it, into `parentId`. */
  onCreateWithHermes: (parentId: null | string) => void
  onOpen: (item: LibraryItem) => void
  onOpenFolder: (folderId: null | string) => void
  section: LibrarySection
  tabs: ReactNode
}

/** The Library's index: folders, pages and files as a list or a gallery, organized in place. */
export function LibraryBrowser({
  folderId,
  onCreateDeck,
  onCreateTable,
  onCreatePage,
  onCreateWithHermes,
  onOpen,
  onOpenFolder,
  section,
  tabs
}: LibraryBrowserProps) {
  const { t } = useI18n()
  const copy = t.library
  const ws = copy.workspace
  const prefs = useStore($libraryViewPrefs)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [filters, setFilters] = useState<LibraryFilters>(NO_FILTERS)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [anchor, setAnchor] = useState<null | string>(null)
  // Where the keyboard is: the last item clicked or stepped to (a Shift range runs anchor → cursor).
  const [cursor, setCursor] = useState<null | string>(null)
  const [quickLook, setQuickLook] = useState<null | string>(null)
  const [quickLookInfo, setQuickLookInfo] = useState(false)
  const clipboard = useStore($libraryClipboard)
  const root = useRef<HTMLDivElement | null>(null)
  const scroller = useRef<HTMLDivElement | null>(null)
  const [renamingId, setRenamingId] = useState<null | string>(null)
  const [moving, setMoving] = useState<LibraryItem[] | null>(null)
  const [dropTarget, setDropTarget] = useState<null | string>(null)
  const [filesOver, setFilesOver] = useState(false)
  const searchInput = useRef<HTMLInputElement | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const savedSearches = useStore($savedSearches)
  const activeSavedId = useStore($activeSavedSearch)
  const tags = useStore($libraryTags)
  const flat = Boolean(activeSavedId) || Boolean(filters.tag)
  const listing = useLibraryListing(section, folderId, query, filters.tag, flat)
  const trash = section === 'trash'
  const browsing = section === 'all' && !query.trim() && !flat
  const here = browsing ? folderId : null
  const order = prefs.order ?? naturalOrder(prefs.sort)
  const filtering = activeFilterCount(filters) > 0

  const items = useMemo(
    () =>
      (listing.items ?? []).filter(
        item =>
          (!filters.types.length || filters.types.includes(itemTypeOf(item))) &&
          (!filters.access.length || filters.access.includes(item.visibility)) &&
          (!filters.createdBy.length || filters.createdBy.includes(item.created_by === 'agent' ? 'agent' : 'user'))
      ),
    [filters, listing.items]
  )

  const ids = useMemo(() => items.map(item => item.id), [items])
  const selectedItems = items.filter(item => selected.has(item.id))
  const current = listing.trail.at(-1)

  // A new place starts with nothing selected and nothing being renamed.
  useEffect(() => {
    setSelected(new Set())
    setAnchor(null)
    setCursor(null)
    setRenamingId(null)
  }, [folderId, section])

  const marquee = useMarquee({ onSelect: setSelected, selected })

  // Opening a saved search puts its query and filters back; leaving it (another section, a folder)
  // clears them again.
  const savedQuery = savedSearches.find(search => search.id === activeSavedId)?.query

  useEffect(() => {
    if (!savedQuery) {
      setQuery('')
      setFilters(NO_FILTERS)

      return
    }

    setQuery(savedQuery.query ?? '')
    setSearchOpen(Boolean(savedQuery.query))
    setFilters({
      access: (savedQuery.access ?? []) as LibraryFilters['access'],
      createdBy: (savedQuery.createdBy ?? []) as LibraryFilters['createdBy'],
      tag: savedQuery.tag ?? null,
      types: (savedQuery.types ?? []) as LibraryFilters['types']
    })

    if (savedQuery.sort) {
      setLibraryViewPrefs({
        order: (savedQuery.order as LibraryViewPrefs['order']) ?? null,
        sort: savedQuery.sort as LibrarySort
      })
    }
  }, [savedQuery])

  useEffect(() => {
    if (searchOpen) {
      searchInput.current?.focus()
    }
  }, [searchOpen])

  const run = async (work: () => Promise<unknown>) => {
    try {
      await work()
      bumpLibraryRevision()
    } catch (error) {
      notifyError(error, copy.errors.save)
    }
  }

  const open = (item: LibraryItem) => (item.kind === 'folder' ? onOpenFolder(item.id) : onOpen(item))

  const toggleSelect = (item: LibraryItem, event: MouseEvent) => {
    const gesture = selectionGesture(event)

    setSelected(nextSelection(selected, ids, item.id, gesture === 'single' ? 'toggle' : gesture, anchor))
    setAnchor(item.id)
    setCursor(item.id)
  }

  const activate = (item: LibraryItem, event: MouseEvent) => {
    if (trash) {
      return toggleSelect(item, event)
    }

    const gesture = selectionGesture(event)

    // With a selection going, a plain click keeps selecting; ⌘ / Shift always select.
    if (gesture !== 'single' || selected.size > 0) {
      setSelected(nextSelection(selected, ids, item.id, gesture === 'single' ? 'toggle' : gesture, anchor))
      setAnchor(item.id)
      setCursor(item.id)

      return
    }

    open(item)
  }

  const rename = (item: LibraryItem, title: null | string) => {
    setRenamingId(null)

    const next = title?.trim()

    if (next && next !== item.title) {
      void run(() => updateLibraryItem(item.id, { title: next }))
    }
  }

  const newFolder = async () => {
    try {
      const folder = await createLibraryFolder(ws.untitledFolder, here)

      bumpLibraryRevision()
      setRenamingId(folder.id)
    } catch (error) {
      notifyError(error, ws.errors.folder)
    }
  }

  const uploadFolder = async () => {
    const [path] = await selectDesktopPaths({ directories: true, multiple: false })

    if (path) {
      enqueueLibraryFolder(
        path,
        path
          .replace(/[/\\]+$/, '')
          .split(/[/\\]/)
          .pop() || path,
        here
      )
    }
  }

  /** Files dropped from the OS: a local folder imports as a tree, files queue as uploads. */
  const acceptFiles = (event: DragEvent, parentId: null | string) => {
    const entries = Array.from(event.dataTransfer.items)
    const loose: File[] = []

    entries.forEach((entry, index) => {
      const file = event.dataTransfer.files[index]

      if (!file) {
        return
      }

      const path = localPathOf(file)

      if (entry.webkitGetAsEntry?.()?.isDirectory) {
        if (path) {
          enqueueLibraryFolder(path, file.name, parentId)
        }

        return
      }

      loose.push(file)
    })

    if (loose.length) {
      enqueueLibraryFiles(loose, parentId)
    }
  }

  const moveInto = (target: null | string, moved: string[]) => {
    const list = moved.filter(id => id !== target)

    if (list.length) {
      void run(() => moveLibraryItems(list, target)).then(() => setSelected(new Set()))
    }
  }

  const dropProps = (target: null | string) => ({
    'data-drop-target': dropTarget === (target ?? 'root') || undefined,
    onDragLeave: () => setDropTarget(value => (value === (target ?? 'root') ? null : value)),
    onDragOver: (event: DragEvent) => {
      if (carries(event, LIBRARY_DND) || carries(event, 'Files')) {
        event.preventDefault()
        event.stopPropagation()
        setDropTarget(target ?? 'root')
      }
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setDropTarget(null)
      setFilesOver(false)

      if (carries(event, LIBRARY_DND)) {
        moveInto(target, dragIds(event))
      } else {
        acceptFiles(event, target)
      }
    }
  })

  const reveal = (id: string) =>
    scroller.current
      ?.querySelector<HTMLElement>(`[data-library-row="${CSS.escape(id)}"],[data-library-card="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: 'nearest' })

  /** Step the keyboard cursor; with Shift the selection runs from the anchor to it. */
  const step = (delta: number, extend: boolean) => {
    if (!ids.length) {
      return false
    }

    const from = ids.indexOf(cursor ?? anchor ?? '')
    const id = ids[from < 0 ? (delta > 0 ? 0 : ids.length - 1) : Math.min(ids.length - 1, Math.max(0, from + delta))]

    if (extend && anchor) {
      setSelected(nextSelection(new Set(), ids, id, 'range', anchor))
    } else {
      setSelected(new Set([id]))
      setAnchor(id)
    }

    setCursor(id)
    reveal(id)
  }

  const duplicate = (list: readonly LibraryItem[]) =>
    void run(() =>
      copyLibraryItems(
        list.map(item => item.id),
        { inPlace: true }
      )
    )

  const paste = () => {
    if (!clipboard) {
      return
    }

    if (clipboard.mode === 'cut') {
      moveInto(here, [...clipboard.ids])
      $libraryClipboard.set(null)
    } else {
      void run(() => copyLibraryItems(clipboard.ids, { parentId: here }))
    }
  }

  const model: LibraryViewModel = {
    cut: clipboard?.mode === 'cut' ? new Set(clipboard.ids) : NOTHING_CUT,
    dropTarget,
    flat: !browsing,
    items,
    order,
    renamingId,
    selected,
    sort: prefs.sort,
    trash,
    onActivate: activate,
    onClipboard: (list, mode) => $libraryClipboard.set({ ids: list.map(item => item.id), mode }),
    onDuplicate: duplicate,
    // Details: the item as Quick Look shows it, with its facts beside it.
    onInfo: item => {
      setSelected(new Set([item.id]))
      setQuickLookInfo(true)
      setQuickLook(item.id)
    },
    onDragEnd: () => setDropTarget(null),
    onDragStart: (item, event) => {
      const moved = selected.has(item.id) && selected.size > 1 ? [...selected] : [item.id]
      // ⌥-drag takes copies of the files out to Finder or another app (a native drag).
      const outgoing = items.filter(entry => moved.includes(entry.id) && entry.kind === 'file' && entry.path)

      if (event.altKey && outgoing.length && window.hermesDesktop?.startFileDrag && !isDesktopFsRemoteMode()) {
        event.preventDefault()
        window.hermesDesktop.startFileDrag(
          outgoing.map(entry => ({ name: entry.file_name || entry.title, path: entry.path! }))
        )

        return
      }

      event.dataTransfer.setData(LIBRARY_DND, JSON.stringify(moved))
      event.dataTransfer.setData('text/plain', item.title)
      event.dataTransfer.effectAllowed = 'move'
    },
    onFolderDragLeave: item => setDropTarget(value => (value === item.id ? null : value)),
    onFolderDragOver: (item, event) => dropProps(item.id).onDragOver(event),
    onFolderDrop: (item, event) => dropProps(item.id).onDrop(event),
    onMove: list => setMoving(list),
    onRename: rename,
    onRun: run,
    onSort: (sort: LibrarySort) =>
      setLibraryViewPrefs(prefs.sort === sort ? { order: order === 'asc' ? 'desc' : 'asc' } : { order: null, sort }),
    onStartRename: item => setRenamingId(item.id),
    onToggleSelect: toggleSelect
  }

  const single = selectedItems.length === 1 ? selectedItems[0] : null
  const acting = !trash && selectedItems.length > 0
  const grid = prefs.view === 'grid'

  // Each key's verb; `false` means "not here", so the key keeps its default.
  const keyActions: Record<LibraryKeyAction, (shift: boolean) => false | void> = {
    clearSelection: () => (selected.size ? setSelected(new Set()) : false),
    copy: () => (acting ? $libraryClipboard.set({ ids: [...selected], mode: 'copy' }) : false),
    cut: () => (acting ? $libraryClipboard.set({ ids: [...selected], mode: 'cut' }) : false),
    duplicate: () => (acting ? duplicate(selectedItems) : false),
    info: () => setLibraryViewPrefs({ inspector: !prefs.inspector }),
    moveDown: shift => step(grid ? gridColumns(scroller.current) : 1, shift),
    moveLeft: shift => (grid ? step(-1, shift) : false),
    moveRight: shift => (grid ? step(1, shift) : false),
    moveUp: shift => step(grid ? -gridColumns(scroller.current) : -1, shift),
    open: () => (single && !trash ? open(single) : false),
    parent: () => (browsing && folderId ? onOpenFolder(listing.trail.at(-2)?.id ?? null) : false),
    paste: () => (clipboard && browsing && !trash ? paste() : false),
    quickLook: () => {
      const id = single?.id ?? cursor

      setQuickLookInfo(false)

      return id ? setQuickLook(id) : false
    },
    rename: () => (single && !trash ? setRenamingId(single.id) : false),
    selectAll: () => setSelected(new Set(ids)),
    trash: () =>
      acting
        ? void run(() => Promise.all(selectedItems.map(item => trashLibraryItem(item.id)))).then(() =>
            setSelected(new Set())
          )
        : false
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Dialogs (Quick Look, Move to…) render in portals: React still bubbles their keys up to here,
    // but they are not the listing's.
    const mine = event.currentTarget.contains(event.target as Node)
    const action = mine && !isTyping(event.target) ? libraryKeyAction(event) : null

    if (action && keyActions[action](event.shiftKey) !== false) {
      event.preventDefault()
    }
  }

  const emptyCopy = trash
    ? { body: copy.empty.trashBody, icon: 'trash', title: copy.empty.trashTitle }
    : query
      ? { body: '', icon: 'search', title: copy.empty.search(query) }
      : browsing && folderId
        ? { body: ws.folderEmptyBody, icon: 'folder-opened', title: ws.folderEmptyTitle }
        : { body: copy.empty.allBody, icon: 'library', title: copy.empty.allTitle }

  const crumbs =
    browsing && folderId ? (
      <nav
        aria-label={copy.title}
        className="-ml-1.5 mb-1 flex min-w-0 items-center gap-0.5 text-xs text-(--ui-text-tertiary)"
      >
        {[null, ...listing.trail.slice(0, -1)].map(crumb => (
          <span className="flex min-w-0 items-center gap-0.5" key={crumb?.id ?? 'root'}>
            <button
              className="max-w-40 cursor-pointer truncate rounded-md px-1.5 py-0.5 transition-colors hover:bg-(--ui-row-hover-background) hover:text-(--ui-text-primary) data-[drop-target]:bg-[color-mix(in_srgb,var(--ui-accent)_14%,transparent)] data-[drop-target]:text-(--ui-accent)"
              onClick={() => onOpenFolder(crumb?.id ?? null)}
              type="button"
              {...dropProps(crumb?.id ?? null)}
            >
              {crumb ? crumb.title || ws.untitledFolder : copy.title}
            </button>
            <Codicon className="shrink-0 opacity-60" name="chevron-right" size="0.625rem" />
          </span>
        ))}
      </nav>
    ) : null

  const heading =
    browsing && folderId ? (
      <>
        <Codicon className="shrink-0" name="folder-opened" size="1.375rem" style={{ color: ITEM_TYPE_TINT.folder }} />
        <span className="truncate">{current?.title || ws.untitledFolder}</span>
      </>
    ) : undefined

  const createButton = <CreateWithHermesButton onClick={() => onCreateWithHermes(here)} />

  const newMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Codicon name="add" size="0.8125rem" />
          {ws.new}
          <Codicon className="opacity-70" name="chevron-down" size="0.625rem" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onSelect={() => onCreatePage('blank', here)}>
          <Codicon name="note" size="0.875rem" />
          {copy.newPage}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCreateDeck(here)}>
          <Codicon name="play-circle" size="0.875rem" />
          {copy.deck.new}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCreateTable(here)}>
          <Codicon name="table" size="0.875rem" />
          {copy.newTable}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Codicon name="layout" size="0.875rem" />
            {copy.create.fromTemplate}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-80 p-1.5">
            {LIBRARY_TEMPLATES.map(template => (
              <DropdownMenuItem
                className="items-start gap-2.5 px-2 py-1.5"
                key={template.id}
                onSelect={() => onCreatePage(template.id, here)}
              >
                <span
                  className="mt-px grid size-7 shrink-0 place-items-center rounded-md"
                  style={{ background: `color-mix(in srgb, ${template.tint} 14%, transparent)`, color: template.tint }}
                >
                  <Codicon name={template.icon} size="0.875rem" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[0.8125rem] font-medium text-(--ui-text-primary)">
                    {copy.templates[template.id]}
                  </span>
                  <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">
                    {copy.templates.hints[template.id]}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => void newFolder()}>
          <Codicon name="new-folder" size="0.875rem" />
          {ws.newFolder}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
          <Codicon name="cloud-upload" size="0.875rem" />
          {ws.uploadFiles}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void uploadFolder()}>
          <Codicon name="folder-opened" size="0.875rem" />
          {ws.uploadFolder}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const tools = (
    <>
      {(query.trim() || filtering) && !activeSavedId && !trash && (
        <Tip label={copy.organize.saveSearchTitle}>
          <Button
            onClick={() =>
              $organizeDialog.set({
                kind: 'saveSearch',
                query: {
                  access: [...filters.access],
                  createdBy: [...filters.createdBy],
                  order: prefs.order,
                  query: query.trim() || null,
                  sort: prefs.sort,
                  tag: filters.tag,
                  types: [...filters.types]
                }
              })
            }
            size="sm"
            variant="ghost"
          >
            <Codicon name="save" size="0.8125rem" />
            {copy.organize.saveSearch}
          </Button>
        </Tip>
      )}
      <SearchTool
        inputRef={searchInput}
        onOpenChange={setSearchOpen}
        onQueryChange={setQuery}
        open={searchOpen}
        query={query}
      />
      <SortFilterMenu
        filters={filters}
        order={order}
        prefs={prefs}
        setFilters={setFilters}
        sortable={section !== 'recents'}
      />
      <ViewToggle view={prefs.view} />
    </>
  )

  return (
    <div
      className="relative flex h-full min-h-0 flex-col outline-none"
      data-library-section={section}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFilesOver(false)
        }
      }}
      onDragOver={event => {
        if (!trash && carries(event, 'Files') && !carries(event, LIBRARY_DND)) {
          event.preventDefault()
          setFilesOver(true)
        }
      }}
      onDrop={event => {
        event.preventDefault()
        setFilesOver(false)

        if (!trash && carries(event, 'Files') && !carries(event, LIBRARY_DND)) {
          acceptFiles(event, here)
        }
      }}
      onKeyDown={onKeyDown}
      ref={root}
      tabIndex={-1}
    >
      <LibraryHeader
        actions={
          trash ? (
            <Button
              disabled={!items.length}
              onClick={() =>
                void confirm({
                  confirmLabel: copy.emptyTrashConfirm.confirm,
                  description: copy.emptyTrashConfirm.description,
                  destructive: true,
                  onConfirm: () => run(emptyLibraryTrash),
                  title: copy.emptyTrashConfirm.title
                })
              }
              size="sm"
              variant="secondary"
            >
              {copy.actions.emptyTrash}
            </Button>
          ) : (
            <>
              {createButton}
              {newMenu}
            </>
          )
        }
        crumbs={crumbs}
        heading={heading}
        tabs={tabs}
        tools={tools}
      />
      <input
        className="hidden"
        multiple
        onChange={event => {
          enqueueLibraryFiles(Array.from(event.target.files ?? []), here)
          event.target.value = ''
        }}
        ref={fileInput}
        type="file"
      />

      <div className="flex min-h-0 flex-1">
        <div
          className="relative min-h-0 flex-1 overflow-y-auto px-8 pb-24"
          onPointerDown={marquee.onPointerDown}
          ref={scroller}
        >
          {marquee.overlay}
          {listing.failed && <p className="py-16 text-center text-sm text-(--ui-text-tertiary)">{copy.errors.load}</p>}
          {!listing.failed && listing.items === null && (
            <div className="grid place-items-center py-16">
              <Loader />
            </div>
          )}
          {!listing.failed && listing.items !== null && items.length === 0 && (
            <div className="flex flex-col items-center gap-1 py-20 text-center">
              <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-(--ui-bg-quaternary) text-(--ui-text-tertiary)">
                <Codicon name={filtering ? 'list-filter' : emptyCopy.icon} size="1.375rem" />
              </span>
              <p className="m-0 text-sm font-medium text-(--ui-text-primary)">{emptyCopy.title}</p>
              {emptyCopy.body && <p className="m-0 max-w-xs text-xs text-(--ui-text-tertiary)">{emptyCopy.body}</p>}
              {filtering && (
                <Button className="mt-3" onClick={() => setFilters(NO_FILTERS)} size="sm" variant="secondary">
                  {ws.filter.clear}
                </Button>
              )}
            </div>
          )}

          {!listing.failed && items.length > 0 && prefs.view === 'list' && <LibraryListView model={model} />}
          {!listing.failed && items.length > 0 && prefs.view === 'grid' && <LibraryGridView model={model} />}
        </div>
        {prefs.inspector && (
          <LibraryInspector
            folderTitle={(browsing && current?.title) || copy.title}
            onClose={() => setLibraryViewPrefs({ inspector: false })}
            onRun={run}
            selected={selectedItems}
          />
        )}
      </div>

      <QuickLook
        folderTitle={(browsing && current?.title) || copy.title}
        id={quickLook}
        info={quickLookInfo}
        items={items}
        onClose={() => setQuickLook(null)}
        onInfoChange={setQuickLookInfo}
        onNavigate={id => {
          setQuickLook(id)
          setSelected(new Set([id]))
          setAnchor(id)
          setCursor(id)
          reveal(id)
        }}
        onOpen={item => {
          setQuickLook(null)
          open(item)
        }}
        onRun={run}
        restoreFocus={() => root.current?.focus({ preventScroll: true })}
      />

      {selectedItems.length > 0 && (
        <div
          className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-(--ui-stroke-tertiary) bg-(--ui-bg-editor) py-1 pl-4 pr-1.5 shadow-[0_0.75rem_2rem_-0.5rem_color-mix(in_srgb,#000_25%,transparent)]"
          data-slot="library-selection"
        >
          <span className="mr-2 text-xs font-medium tabular-nums text-(--ui-text-primary)">
            {ws.selection.count(selectedItems.length)}
          </span>
          {trash ? (
            <>
              <Button
                onClick={() =>
                  void run(() => Promise.all(selectedItems.map(item => trashLibraryItem(item.id, true)))).then(() =>
                    setSelected(new Set())
                  )
                }
                size="sm"
                variant="ghost"
              >
                <Codicon name="discard" size="0.8125rem" />
                {copy.actions.restore}
              </Button>
              <Button
                className="text-(--ui-red)"
                onClick={() =>
                  void confirm({
                    confirmLabel: copy.purgeConfirm.confirm,
                    description: copy.emptyTrashConfirm.description,
                    destructive: true,
                    onConfirm: () =>
                      run(() => Promise.all(selectedItems.map(item => purgeLibraryItem(item.id)))).then(() =>
                        setSelected(new Set())
                      ),
                    title: copy.purgeConfirm.title
                  })
                }
                size="sm"
                variant="ghost"
              >
                <Codicon name="trash" size="0.8125rem" />
                {copy.actions.purge}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setMoving(selectedItems)} size="sm" variant="ghost">
                <Codicon name="arrow-swap" size="0.8125rem" />
                {ws.moveTo}
              </Button>
              <Tip label={copy.actions.favorite}>
                <Button
                  aria-label={copy.actions.favorite}
                  onClick={() => {
                    const favorite = !selectedItems.every(item => item.favorite)

                    void run(() => Promise.all(selectedItems.map(item => updateLibraryItem(item.id, { favorite }))))
                  }}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Codicon
                    name={selectedItems.every(item => item.favorite) ? 'star-full' : 'star-empty'}
                    size="0.875rem"
                  />
                </Button>
              </Tip>
              <DropdownMenu>
                <Tip label={copy.access.label}>
                  <DropdownMenuTrigger asChild>
                    <Button aria-label={copy.access.label} size="icon-sm" variant="ghost">
                      <Codicon name="shield" size="0.875rem" />
                    </Button>
                  </DropdownMenuTrigger>
                </Tip>
                <DropdownMenuContent align="center" className="min-w-52" side="top">
                  <DropdownMenuLabel className={dropdownMenuSectionLabel}>{copy.access.label}</DropdownMenuLabel>
                  {ACCESS_ORDER.map(level => (
                    <DropdownMenuItem
                      key={level}
                      onSelect={() =>
                        void run(() =>
                          Promise.all(selectedItems.map(item => updateLibraryItem(item.id, { visibility: level })))
                        )
                      }
                    >
                      <Codicon className={ACCESS_META[level].tone} name={ACCESS_META[level].icon} size="0.8125rem" />
                      {copy.access[level]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <Tip label={copy.organize.tags}>
                  <DropdownMenuTrigger asChild>
                    <Button aria-label={copy.organize.tags} size="icon-sm" variant="ghost">
                      <Codicon name="tag" size="0.875rem" />
                    </Button>
                  </DropdownMenuTrigger>
                </Tip>
                <DropdownMenuContent align="center" className="min-w-48" side="top">
                  <TagMenuItems items={selectedItems} />
                </DropdownMenuContent>
              </DropdownMenu>
              <Tip label={copy.actions.trash}>
                <Button
                  aria-label={copy.actions.trash}
                  onClick={() =>
                    void run(() => Promise.all(selectedItems.map(item => trashLibraryItem(item.id)))).then(() =>
                      setSelected(new Set())
                    )
                  }
                  size="icon-sm"
                  variant="ghost"
                >
                  <Codicon name="trash" size="0.875rem" />
                </Button>
              </Tip>
            </>
          )}
          <span className="mx-1 h-4 w-px bg-(--ui-stroke-tertiary)" />
          <Tip label={ws.selection.clear}>
            <Button
              aria-label={ws.selection.clear}
              onClick={() => setSelected(new Set())}
              size="icon-sm"
              variant="ghost"
            >
              <Codicon name="close" size="0.8125rem" />
            </Button>
          </Tip>
        </div>
      )}

      {filesOver && (
        <div className="pointer-events-none absolute inset-3 grid place-items-center rounded-2xl border-2 border-dashed border-(--ui-accent) bg-[color-mix(in_srgb,var(--ui-accent)_6%,transparent)]">
          <span className="flex items-center gap-2 text-sm font-medium text-(--ui-accent)">
            <Codicon name="cloud-upload" size="1rem" />
            {here && current ? ws.dropInto(current.title || ws.untitledFolder) : ws.dropUpload}
          </span>
        </div>
      )}

      <MoveDialog
        items={moving ?? []}
        onClose={() => {
          setMoving(null)
          setSelected(new Set())
        }}
        open={moving !== null}
      />
    </div>
  )
}
