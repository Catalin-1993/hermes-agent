import './library.css'

import { useStore } from '@nanostores/react'
import type * as React from 'react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Loader } from '@/components/ui/loader'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'

import { firstLine, startHermesBeside } from './chat-bridge'
import { ChatsView } from './chats-view'
import { type CreateRequest, CreateWithHermesButton, CreateWithHermesDialog } from './create-with-hermes'
import {
  $libraryRevision,
  bumpLibraryRevision,
  createLibraryPage,
  deleteSavedSearch,
  importLibraryFile,
  type LibraryItem
} from './data'
import { starterDeck } from './deck'
import { LibraryBrowser, LibraryHeader, type LibrarySection } from './library-browser'
import { LibraryItemView } from './library-item'
import { LibraryTabs, openLibraryTab } from './library-tabs'
import { $activeSavedSearch, $savedSearches, refreshLibraryTags, refreshSavedSearches } from './organize'
import { OrganizeDialogs } from './organize-ui'
import { LIBRARY_TEMPLATES, type LibraryTemplateId } from './templates'
import { LibraryUploadPanel } from './upload-panel'

// What sessions produced (images, files, links) — the former Artifacts page, now a Library section.
const ArtifactsView = lazy(async () => ({ default: (await import('../artifacts')).ArtifactsView }))

type Section = 'chats' | 'generated' | LibrarySection

// Views read as a row of pills under the title: the everyday few, then the rest behind "N more…" (a
// kind of item is also a filter, in Sort & filter).
const TABS: readonly Section[] = ['all', 'recents', 'favorites', 'chats']
const MORE_TABS: readonly Section[] = ['pages', 'images', 'files', 'generated', 'trash']
const SECTIONS: readonly Section[] = [...TABS, ...MORE_TABS]

const TAB =
  'flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[0.8125rem] text-(--ui-text-secondary) transition-colors hover:bg-(--ui-row-hover-background) hover:text-(--ui-text-primary)'

const TAB_ACTIVE = 'bg-(--ui-row-active-background) font-medium text-(--ui-text-primary)'

const SECTION_ICON: Record<Section, string> = {
  all: 'library',
  chats: 'comment-discussion',
  favorites: 'star-empty',
  files: 'file',
  generated: 'output',
  images: 'file-media',
  pages: 'note',
  recents: 'history',
  trash: 'trash'
}

interface LibraryTarget {
  /** The folder browsed in All (`null` = the root). */
  folder?: null | string
  item?: null | string
  section?: Section
}

interface LibraryNav {
  folder: null | string
  item: null | string
  open: (next: LibraryTarget) => void
  section: Section
}

const isSection = (value: null | string): value is Section =>
  value !== null && (SECTIONS as readonly string[]).includes(value)

/** Section, folder and open item: in the URL on the routed page (back / forward walk them), in local
 *  state in a split tile (which does not own the window's URL). */
function useLibraryNav(routed: boolean): LibraryNav {
  const [params, setParams] = useSearchParams()

  const [local, setLocal] = useState<{ folder: null | string; item: null | string; section: Section }>({
    folder: null,
    item: null,
    section: 'all'
  })

  const section = routed
    ? isSection(params.get('section'))
      ? (params.get('section') as Section)
      : 'all'
    : local.section

  const folder = routed ? params.get('folder') : local.folder
  const item = routed ? params.get('item') : local.item

  const open = useCallback(
    (next: LibraryTarget) => {
      const nextSection = next.section ?? section
      // A section change leaves the folder; staying in All keeps it unless one is given.
      const nextFolder = next.folder !== undefined ? next.folder : nextSection === section ? folder : null

      const target = {
        folder: nextSection === 'all' ? nextFolder : null,
        item: next.item ?? null,
        section: nextSection
      }

      if (!routed) {
        setLocal(target)

        return
      }

      const search = new URLSearchParams()

      if (target.section !== 'all') {
        search.set('section', target.section)
      }

      if (target.folder) {
        search.set('folder', target.folder)
      }

      if (target.item) {
        search.set('item', target.item)
      }

      setParams(search)
    },
    [folder, routed, section, setParams]
  )

  return { folder, item, open, section }
}

interface LibraryViewProps extends React.ComponentProps<'section'> {
  /** False inside a split tile: navigation stays local instead of writing the window URL. */
  routed?: boolean
  setStatusbarItemGroup?: unknown
}

/** The Library: folders, Notion-style pages and saved files — its views as tabs under the title, the
 *  page editor, and the uploads in flight. */
export function LibraryView({
  className,
  routed = true,
  setStatusbarItemGroup: _statusbar,
  ...props
}: LibraryViewProps) {
  const { t } = useI18n()
  const copy = t.library
  const nav = useLibraryNav(routed)
  const revision = useStore($libraryRevision)
  const savedSearches = useStore($savedSearches)
  const activeSavedId = useStore($activeSavedSearch)
  const activeSaved = savedSearches.find(search => search.id === activeSavedId)

  // Tags and saved searches are backend truth: looked up again whenever the Library changes.
  useEffect(() => {
    void refreshLibraryTags()
    void refreshSavedSearches()
  }, [revision])

  /** Leave a saved search for a section or folder. */
  const go = (target: Parameters<typeof nav.open>[0]) => {
    $activeSavedSearch.set(null)
    nav.open(target)
  }

  // Every item opened gets a tab.
  useEffect(() => {
    if (nav.item) {
      openLibraryTab(nav.item)
    }
  }, [nav.item])

  const openItem = (item: LibraryItem) => nav.open({ item: item.id })

  const createPage = async (templateId: LibraryTemplateId, parentId: null | string = null) => {
    const template = LIBRARY_TEMPLATES.find(entry => entry.id === templateId) ?? LIBRARY_TEMPLATES[0]

    try {
      const page = await createLibraryPage({
        icon: template.emoji,
        markdown: template.markdown(),
        parent_id: parentId || undefined,
        title: templateId === 'blank' ? '' : copy.templates[templateId]
      })

      bumpLibraryRevision()
      nav.open({ item: page.id })
    } catch (error) {
      notifyError(error, copy.errors.save)
    }
  }

  // A new table is an empty CSV — header row and three rows to type into — opened straight in the sheet editor.
  const createTable = async (parentId: null | string = null) => {
    try {
      const file = new File([',,\n,,\n,,\n,,\n'], `${copy.untitledTable}.csv`, { type: 'text/csv' })
      const saved = await importLibraryFile(file, parentId || undefined)

      bumpLibraryRevision()
      nav.open({ item: saved.id })
    } catch (error) {
      notifyError(error, copy.errors.save)
    }
  }

  const createDeck = async (parentId: null | string = null) => {
    try {
      const title = copy.deck.untitled

      const page = await createLibraryPage({
        icon: '🎞️',
        markdown: starterDeck(title, copy.deck.starter),
        parent_id: parentId || undefined,
        title
      })

      bumpLibraryRevision()
      nav.open({ item: page.id })
    } catch (error) {
      notifyError(error, copy.errors.save)
    }
  }

  // "Create with Hermes": the page is made first (open to Hermes — it still asks before every write)
  // and opened, then Hermes is handed the request in a chat beside it.
  const [creatingIn, setCreatingIn] = useState<null | { parentId: null | string }>(null)

  const createWithHermes = async ({ kind, text }: CreateRequest) => {
    try {
      const page = await createLibraryPage({
        parent_id: creatingIn?.parentId || undefined,
        title: firstLine(text) ?? '',
        visibility: 'open'
      })

      bumpLibraryRevision()
      setCreatingIn(null)
      nav.open({ item: page.id })

      const ask = [text, copy.create.kindHints[kind], copy.create.instruction(page.title || copy.untitled, page.id)]

      await startHermesBeside(page.id, ask.filter(Boolean).join('\n\n'))
    } catch (error) {
      notifyError(error, copy.errors.save)
    }
  }

  const tab = (section: Section) => (
    <button
      aria-current={nav.section === section && !activeSaved ? 'page' : undefined}
      className={cn(TAB, nav.section === section && !activeSaved && TAB_ACTIVE)}
      data-library-nav={section}
      key={section}
      onClick={() => go({ folder: null, section })}
      type="button"
    >
      <Codicon className="opacity-80" name={SECTION_ICON[section]} size="0.875rem" />
      {copy.nav[section]}
    </button>
  )

  const moreActive = MORE_TABS.includes(nav.section) || Boolean(activeSaved)

  const tabs = (
    <nav aria-label={copy.title} className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {TABS.map(tab)}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(TAB, moreActive && TAB_ACTIVE)} data-library-nav="more" type="button">
            {activeSaved ? (
              <>
                <Codicon className="opacity-80" name="search" size="0.875rem" />
                {activeSaved.title}
              </>
            ) : moreActive ? (
              <>
                <Codicon className="opacity-80" name={SECTION_ICON[nav.section]} size="0.875rem" />
                {copy.nav[nav.section]}
              </>
            ) : (
              copy.moreViews(MORE_TABS.length)
            )}
            <Codicon className="opacity-60" name="chevron-down" size="0.625rem" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          {MORE_TABS.map(section => (
            <DropdownMenuItem key={section} onSelect={() => go({ folder: null, section })}>
              <Codicon name={SECTION_ICON[section]} size="0.875rem" />
              <span className="flex-1">{copy.nav[section]}</span>
              {nav.section === section && !activeSaved && (
                <Codicon className="text-(--ui-accent)" name="check" size="0.8125rem" />
              )}
            </DropdownMenuItem>
          ))}
          {savedSearches.length > 0 && <DropdownMenuSeparator />}
          {savedSearches.map(search => (
            <DropdownMenuItem
              className="group/saved"
              key={search.id}
              onSelect={() => {
                nav.open({ folder: null, item: null, section: 'all' })
                $activeSavedSearch.set(search.id)
              }}
            >
              <Codicon name="search" size="0.875rem" />
              <span className="flex-1 truncate">{search.title}</span>
              <button
                aria-label={copy.organize.removeSearch}
                className="grid size-5 cursor-pointer place-items-center rounded text-(--ui-text-tertiary) opacity-0 hover:text-(--ui-text-primary) group-hover/saved:opacity-100"
                onClick={event => {
                  event.preventDefault()
                  event.stopPropagation()

                  if (activeSaved?.id === search.id) {
                    $activeSavedSearch.set(null)
                  }

                  void deleteSavedSearch(search.id).then(refreshSavedSearches)
                }}
                onPointerDown={event => event.stopPropagation()}
                type="button"
              >
                <Codicon name="close" size="0.6875rem" />
              </button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )

  const newPage = (
    <Button onClick={() => void createPage('blank')} size="sm">
      <Codicon name="add" size="0.8125rem" />
      {copy.newPage}
    </Button>
  )

  return (
    <section
      className={cn('library relative flex h-full min-h-0 min-w-0 flex-col', className)}
      data-slot="library"
      {...props}
    >
      <LibraryTabs activeId={nav.item} onActivate={id => nav.open({ item: id })} />
      {nav.item ? (
        <LibraryItemView
          itemId={nav.item}
          onBack={() => nav.open({ item: null })}
          onNavigate={folderId => go({ folder: folderId, item: null, section: 'all' })}
          onOpenItem={id => nav.open({ item: id })}
        />
      ) : nav.section === 'chats' ? (
        <ChatsView
          actions={<CreateWithHermesButton onClick={() => setCreatingIn({ parentId: null })} />}
          onCreateWithHermes={() => setCreatingIn({ parentId: null })}
          onOpen={openItem}
          tabs={tabs}
        />
      ) : nav.section === 'generated' ? (
        <>
          <LibraryHeader actions={newPage} tabs={tabs} />
          <div className="min-h-0 flex-1">
            <Suspense
              fallback={
                <div className="grid h-full place-items-center">
                  <Loader />
                </div>
              }
            >
              <ArtifactsView />
            </Suspense>
          </div>
        </>
      ) : (
        <LibraryBrowser
          folderId={nav.section === 'all' ? nav.folder : null}
          onCreateDeck={parentId => void createDeck(parentId)}
          onCreatePage={(id, parentId) => void createPage(id, parentId)}
          onCreateTable={parentId => void createTable(parentId)}
          onCreateWithHermes={parentId => setCreatingIn({ parentId })}
          onOpen={openItem}
          onOpenFolder={folderId => go({ folder: folderId, item: null, section: 'all' })}
          section={nav.section}
          tabs={tabs}
        />
      )}
      <LibraryUploadPanel />
      <OrganizeDialogs />
      <CreateWithHermesDialog
        onCreate={createWithHermes}
        onOpenChange={open => !open && setCreatingIn(null)}
        open={creatingIn !== null}
      />
    </section>
  )
}
