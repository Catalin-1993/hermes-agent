import { createReactBlockSpec } from '@blocknote/react'
import { useStore } from '@nanostores/react'
import { createContext, useContext, useEffect, useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { Loader } from '@/components/ui/loader'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

import { $libraryRevision, getLibraryItem, type LibraryItem } from './data'
import { ITEM_TYPE_ICON } from './file-types'

/** How a page block opens the page it stands for (the Library's own navigation). */
export const OpenPageContext = createContext<(id: string) => void>(() => undefined)

/** The sub-page as it is now — its title and icon follow it, a trashed one says so. */
function useSubpage(id: string) {
  const revision = useStore($libraryRevision)
  const [state, setState] = useState<{ item: LibraryItem | null; missing: boolean }>({ item: null, missing: false })

  useEffect(() => {
    if (!id) {
      return
    }

    let live = true

    getLibraryItem(id).then(
      ({ item }) => live && setState({ item, missing: item.trashed_at != null }),
      () => live && setState({ item: null, missing: true })
    )

    return () => {
      live = false
    }
  }, [id, revision])

  return state
}

function PageLink({ onTitle, pageId }: { onTitle: (title: string) => void; pageId: string }) {
  const { t } = useI18n()
  const open = useContext(OpenPageContext)
  const { item, missing } = useSubpage(pageId)
  const title = missing ? t.library.editor.deletedPage : item?.title || t.library.untitled
  const current = item?.title

  // The block remembers the title too, so the page's markdown names the link without a lookup.
  useEffect(() => {
    if (current !== undefined) {
      onTitle(current)
    }
  }, [current, onTitle])

  return (
    <button
      className={cn(
        'library-page-link flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-0.5 py-[0.1875rem] text-left transition-colors hover:bg-(--ui-row-hover-background)',
        missing && 'cursor-default opacity-50'
      )}
      contentEditable={false}
      disabled={missing || !pageId}
      onClick={() => open(pageId)}
      type="button"
    >
      <span className="grid size-5 shrink-0 place-items-center text-[1.0625rem] leading-none text-(--ui-text-secondary)">
        {!pageId ? <Loader /> : item?.icon ? item.icon : <Codicon name={ITEM_TYPE_ICON.page} size="1rem" />}
      </span>
      <span
        className={cn(
          'min-w-0 truncate font-medium text-(--ui-text-primary)',
          !missing && 'underline decoration-(--ui-stroke-secondary) decoration-1 underline-offset-[0.2em]'
        )}
      >
        {title}
      </span>
    </button>
  )
}

/** A sub-page where it was made, as in Notion: one row — icon and title — that opens it. The page
 *  itself lives in the Library under this one; the block holds its id and last-known title. */
export const pageBlockSpec = createReactBlockSpec(
  { content: 'none', propSchema: { pageId: { default: '' }, title: { default: '' } }, type: 'page' },
  {
    render: ({ block, editor }) => (
      <PageLink
        onTitle={title => {
          if (title !== block.props.title) {
            editor.updateBlock(block, { props: { title } })
          }
        }}
        pageId={block.props.pageId}
      />
    ),
    // Markdown and copy-out keep the link: the agent and search read it as one.
    toExternalHTML: ({ block }) => <a href={`library://${block.props.pageId}`}>{block.props.title || 'Untitled'}</a>
  }
)
