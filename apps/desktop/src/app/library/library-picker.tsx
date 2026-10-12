import { useStore } from '@nanostores/react'
import { atom } from 'nanostores'
import { useEffect, useState } from 'react'

import { COMPOSER_AREAS } from '@/app/chat/composer/contrib'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { registry } from '@/contrib/registry'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

import { ACCESS_META } from './access'
import { attachLibraryItems } from './chat-bridge'
import { type LibraryItem, listLibrary } from './data'
import { LibraryThumb } from './library-thumb'
import { Loading } from './previews/preview-surface'

const $pickerOpen = atom(false)
const SEARCH_DEBOUNCE_MS = 160

function Picker({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const copy = t.library
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<LibraryItem[] | null>(null)
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    let live = true

    const timer = window.setTimeout(
      () =>
        listLibrary({ query: query.trim() || undefined, sort: 'updated' }).then(
          ({ items: found }) => live && setItems(found.filter(item => item.kind !== 'folder').slice(0, 200)),
          () => live && setItems([])
        ),
      query ? SEARCH_DEBOUNCE_MS : 0
    )

    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [query])

  const toggle = (id: string) =>
    setChosen(current => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })

  const attach = () => {
    void attachLibraryItems((items ?? []).filter(item => chosen.has(item.id)))
    onClose()
  }

  return (
    <DialogContent aria-describedby={undefined} className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{copy.chat.pickerTitle}</DialogTitle>
      </DialogHeader>
      <input
        aria-label={copy.chat.pickerSearch}
        autoFocus
        className="h-9 rounded-lg border border-(--ui-stroke-tertiary) bg-transparent px-3 text-sm outline-none focus:border-(--ui-accent)"
        onChange={event => setQuery(event.target.value)}
        placeholder={copy.chat.pickerSearch}
        value={query}
      />
      <div className="h-80 overflow-y-auto">
        {items === null ? (
          <Loading />
        ) : items.length === 0 ? (
          <p className="m-0 py-16 text-center text-sm text-(--ui-text-tertiary)">{copy.chat.noResults}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {items.map(item => (
              <li key={item.id}>
                <button
                  aria-pressed={chosen.has(item.id)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-(--ui-row-hover-background)',
                    chosen.has(item.id) && 'bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)]'
                  )}
                  onClick={() => toggle(item.id)}
                  onDoubleClick={() => {
                    void attachLibraryItems([item])
                    onClose()
                  }}
                  type="button"
                >
                  <LibraryThumb item={item} size="row" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-(--ui-text-primary)">{item.title || copy.untitled}</span>
                    <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">
                      {item.parent_title || copy.title}
                    </span>
                  </span>
                  <Codicon
                    className={ACCESS_META[item.visibility].tone}
                    name={ACCESS_META[item.visibility].icon}
                    size="0.75rem"
                  />
                  {chosen.has(item.id) && <Codicon className="text-(--ui-accent)" name="check" size="0.875rem" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <DialogFooter>
        <Button disabled={chosen.size === 0} onClick={attach}>
          <Codicon name="attach" size="0.8125rem" />
          {copy.chat.attach}
          {chosen.size > 1 && ` (${chosen.size})`}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/**
 * "From Library…" in the composer's + menu, and the picker it opens: search pages and files, pick
 * one or several, attach them as context. Mounted once with the shell; the menu row follows the
 * language.
 */
export function LibraryPickerHost() {
  const { t } = useI18n()
  const open = useStore($pickerOpen)
  const label = t.library.chat.fromLibrary

  useEffect(
    () =>
      registry.register({
        area: COMPOSER_AREAS.attachments,
        data: { icon: 'library', label, run: () => $pickerOpen.set(true) },
        id: 'library'
      }),
    [label]
  )

  return (
    <Dialog onOpenChange={next => $pickerOpen.set(next)} open={open}>
      {open && <Picker onClose={() => $pickerOpen.set(false)} />}
    </Dialog>
  )
}
