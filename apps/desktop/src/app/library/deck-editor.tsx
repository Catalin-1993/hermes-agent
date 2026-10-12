import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $librarySnapshot } from '@/store/library-snapshot'

import type { LibraryItem } from './data'
import {
  type Deck,
  DECK_THEMES,
  insertSlide,
  moveSlide,
  parseDeck,
  removeSlide,
  replaceSlide,
  serializeDeck
} from './deck'
import { exportDeckPdf, exportDeckPptx } from './deck-export'
import { type SlideUi } from './deck-insert'
import { DECK_THEME_STYLE, Slide } from './deck-slide'
import { exportItem } from './export-actions'
import { rasterizeElement } from './rasterize'
import { setLibraryView } from './view-context'

interface DeckEditorProps {
  /** Runs before the exports that read the saved deck, so what was just typed is in it. */
  beforeExport?: () => Promise<void>
  /** Slides Hermes just changed: the editor opens on the first and lets the others glow for a moment. */
  changed?: number[]
  /** The presentation's item: pictures added on the canvas are saved beside it. */
  itemId?: string
  markdown: string
  onChange: (markdown: string) => void
  title: string
}

/** A presentation, worked on the way you read it: slide rail, one big canvas, the slide's text beneath
 *  it. Every change writes the deck's Markdown back; Present takes it full screen. */
export function DeckEditor({ beforeExport, changed = [], itemId, markdown, onChange, title }: DeckEditorProps) {
  const { t } = useI18n()
  const copy = t.library.deck
  const [deck, setDeck] = useState<Deck>(() => parseDeck(markdown))
  const [active, setActive] = useState(changed[0] ?? 0)
  const [glowing, setGlowing] = useState(changed)
  const [dragFrom, setDragFrom] = useState<null | number>(null)
  const [presenting, setPresenting] = useState(false)
  // Every change keeps the deck it replaced, so ⌘Z walks back through slides, blocks and themes alike.
  const past = useRef<{ active: number; deck: Deck }[]>([])
  const future = useRef<{ active: number; deck: Deck }[]>([])
  const [, bump] = useState(0)
  const canvas = useRef<HTMLDivElement | null>(null)
  const index = Math.min(active, deck.slides.length - 1)

  const show = (next: Deck, nextActive: number) => {
    setDeck(next)
    setActive(Math.min(nextActive, next.slides.length - 1))
    onChange(serializeDeck(next))
  }

  const update = (next: Deck, nextActive = index) => {
    if (serializeDeck(next) === serializeDeck(deck)) {
      return
    }

    past.current = [...past.current.slice(-99), { active: index, deck }]
    future.current = []
    show(next, nextActive)
    bump(n => n + 1)
  }

  const step = (from: typeof past, to: typeof future) => {
    const target = from.current.pop()

    if (target) {
      to.current.push({ active: index, deck })
      show(target.deck, target.active)
      bump(n => n + 1)
    }
  }

  const undo = () => step(past, future)
  const redo = () => step(future, past)

  useEffect(() => {
    const timer = window.setTimeout(() => setGlowing([]), 2600)

    return () => window.clearTimeout(timer)
  }, [])

  // Hermes can ask for a picture of the slide on screen (the library tool's `view` with `look`).
  useEffect(() => {
    if (!itemId) {
      return
    }

    $librarySnapshot.set({
      itemId,
      take: async () => {
        const slide = canvas.current?.querySelector<HTMLElement>('[data-slide]')

        return slide ? rasterizeElement(slide, { without: '[data-block-tools],[data-add-block]' }) : null
      }
    })

    return () => $librarySnapshot.set(null)
  }, [itemId])

  // Hermes can ask which slide the owner is on.
  useEffect(() => {
    setLibraryView({ slide: index + 1 })

    return () => setLibraryView({ slide: null })
  }, [index])

  const ui: SlideUi = {
    addBlock: copy.addBlock,
    blocks: {
      bullets: copy.blockBullets,
      code: copy.blockCode,
      heading: copy.blockHeading,
      image: copy.blockImage,
      numbered: copy.blockNumbered,
      paragraph: copy.blockText,
      quote: copy.blockQuote
    },
    moveDown: copy.moveDown,
    moveUp: copy.moveUp,
    pickImage: copy.pickImage,
    removeBlock: copy.removeBlock,
    typeHere: copy.typeHere
  }

  const add = () => update(insertSlide(deck, index + 1, `## ${copy.newSlideTitle}\n\n- `), index + 1)

  return (
    <div
      className="flex flex-col gap-3"
      data-slot="library-deck"
      onKeyDown={event => {
        const key = event.key.toLowerCase()

        if ((event.metaKey || event.ctrlKey) && (key === 'z' || key === 'y')) {
          event.preventDefault()

          if (key === 'y' || event.shiftKey) {
            redo()
          } else {
            undo()
          }
        }
      }}
    >
      <div className="flex items-center gap-2">
        <div
          aria-label={copy.theme}
          className="flex items-center gap-1.5 rounded-full border border-(--ui-stroke-tertiary) px-2 py-1.5"
          role="radiogroup"
        >
          {DECK_THEMES.map(theme => (
            <Tip key={theme} label={copy.themes[theme]}>
              <button
                aria-checked={deck.theme === theme}
                aria-label={copy.themes[theme]}
                className={cn(
                  'size-4 cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14)] transition-transform hover:scale-110',
                  deck.theme === theme && 'ring-2 ring-(--ui-accent) ring-offset-2 ring-offset-(--ui-bg-editor)'
                )}
                onClick={() => update({ ...deck, theme })}
                role="radio"
                style={{ background: DECK_THEME_STYLE[theme].background }}
                type="button"
              />
            </Tip>
          ))}
        </div>
        <span className="ml-1 text-xs text-(--ui-text-tertiary)">{copy.count(deck.slides.length)}</span>
        <div className="flex items-center">
          <Tip label={t.library.table.undo}>
            <Button
              aria-label={t.library.table.undo}
              className="size-7"
              disabled={past.current.length === 0}
              onClick={undo}
              size="icon"
              variant="ghost"
            >
              <Codicon name="discard" size="0.8125rem" />
            </Button>
          </Tip>
          <Tip label={t.library.table.redo}>
            <Button
              aria-label={t.library.table.redo}
              className="size-7"
              disabled={future.current.length === 0}
              onClick={redo}
              size="icon"
              variant="ghost"
            >
              <Codicon name="redo" size="0.8125rem" />
            </Button>
          </Tip>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-8 gap-1.5 px-3 text-xs" variant="ghost">
                <Codicon name="cloud-download" size="0.8125rem" />
                {copy.export}
                <Codicon className="opacity-60" name="chevron-down" size="0.625rem" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onSelect={() => void exportDeckPptx(deck, title)}>
                <Codicon name="play-circle" size="0.8125rem" />
                {t.library.export.formats.pptx}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportDeckPdf(deck, title)}>
                <Codicon name="file-pdf" size="0.8125rem" />
                {t.library.export.formats.pdf}
              </DropdownMenuItem>
              {itemId &&
                (['docx', 'markdown', 'images', 'bundle'] as const).map(format => (
                  <span key={format}>
                    {format === 'bundle' && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onSelect={() =>
                        void (beforeExport?.() ?? Promise.resolve()).then(() =>
                          exportItem({ id: itemId, kind: 'page', title } as LibraryItem, format)
                        )
                      }
                    >
                      <Codicon
                        name={
                          format === 'docx'
                            ? 'file'
                            : format === 'markdown'
                              ? 'markdown'
                              : format === 'images'
                                ? 'file-media'
                                : 'file-zip'
                        }
                        size="0.8125rem"
                      />
                      {t.library.export.formats[format]}
                    </DropdownMenuItem>
                  </span>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="h-8 gap-1.5 rounded-full px-3.5 text-xs" onClick={() => setPresenting(true)} size="sm">
            <Codicon name="play" size="0.75rem" />
            {copy.present}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-4">
        <div className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto pr-1" role="listbox">
          {deck.slides.map((slide, i) => (
            <div
              className="group/thumb relative"
              draggable
              key={i}
              onDragOver={event => dragFrom !== null && event.preventDefault()}
              onDragStart={() => setDragFrom(i)}
              onDrop={() => {
                if (dragFrom !== null && dragFrom !== i) {
                  update(moveSlide(deck, dragFrom, i), i)
                }

                setDragFrom(null)
              }}
            >
              <button
                aria-label={copy.slide(i + 1)}
                aria-selected={i === index}
                className={cn(
                  'flex w-full cursor-pointer items-start gap-1.5 rounded-lg p-1 text-left transition-colors',
                  i === index
                    ? 'bg-[color-mix(in_srgb,var(--ui-accent)_9%,transparent)]'
                    : 'hover:bg-(--ui-row-hover-background)'
                )}
                onClick={() => setActive(i)}
                role="option"
                type="button"
              >
                <span className="w-3.5 shrink-0 pt-1 text-right text-[0.625rem] text-(--ui-text-tertiary) tabular-nums">
                  {i + 1}
                </span>
                <span
                  className={cn(
                    'block aspect-video min-w-0 flex-1 overflow-hidden rounded-md shadow-[0_0_0_1px_rgb(0_0_0/0.1)] transition-shadow duration-700',
                    i === index && 'shadow-[0_0_0_2px_var(--ui-accent)]',
                    glowing.includes(i) &&
                      'shadow-[0_0_0_2px_var(--ui-accent),0_0_16px_2px_color-mix(in_srgb,var(--ui-accent)_55%,transparent)]'
                  )}
                >
                  <Slide slide={slide} theme={deck.theme} />
                </span>
              </button>
              <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 transition-opacity group-hover/thumb:opacity-100">
                <Tip label={copy.duplicate}>
                  <button
                    aria-label={copy.duplicate}
                    className="grid size-5 cursor-pointer place-items-center rounded bg-black/55 text-white backdrop-blur-sm hover:bg-black/70"
                    onClick={() => update(insertSlide(deck, i + 1, slide), i + 1)}
                    type="button"
                  >
                    <Codicon name="copy" size="0.6875rem" />
                  </button>
                </Tip>
                <Tip label={copy.remove}>
                  <button
                    aria-label={copy.remove}
                    className="grid size-5 cursor-pointer place-items-center rounded bg-black/55 text-white backdrop-blur-sm hover:bg-black/70"
                    onClick={() => update(removeSlide(deck, i), i)}
                    type="button"
                  >
                    <Codicon name="trash" size="0.6875rem" />
                  </button>
                </Tip>
              </div>
            </div>
          ))}
          <button
            className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-(--ui-stroke-secondary) text-xs text-(--ui-text-tertiary) transition-colors hover:border-(--ui-stroke-primary) hover:text-(--ui-text-primary)"
            onClick={add}
            type="button"
          >
            <Codicon name="add" size="0.75rem" />
            {copy.addSlide}
          </button>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div
            className="aspect-video w-full overflow-hidden rounded-xl shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_18px_40px_-24px_rgb(0_0_0/0.35)]"
            data-slot="library-deck-canvas"
            ref={canvas}
          >
            <Slide
              emptyHint={copy.canvasEmpty}
              itemId={itemId}
              key={index}
              onChange={text => update(replaceSlide(deck, index, text))}
              slide={deck.slides[index] ?? ''}
              theme={deck.theme}
              ui={ui}
            />
          </div>
          <p className="text-[0.6875rem] text-(--ui-text-tertiary)">{copy.hint}</p>
        </div>
      </div>

      {presenting && <Presenter deck={deck} onClose={() => setPresenting(false)} start={index} />}
    </div>
  )
}

/** Full screen, one slide at a time: → ↓ Space PageDown next, ← ↑ PageUp back, Esc leaves. */
function Presenter({ deck, onClose, start }: { deck: Deck; onClose: () => void; start: number }) {
  const [at, setAt] = useState(start)
  const stage = useRef<HTMLDivElement | null>(null)
  const last = deck.slides.length - 1
  const copy = useI18n().t.library.deck

  useEffect(() => {
    const el = stage.current

    void el?.requestFullscreen?.().catch(() => undefined)
    el?.focus()

    const left = () => {
      if (!document.fullscreenElement) {
        onClose()
      }
    }

    document.addEventListener('fullscreenchange', left)

    return () => {
      document.removeEventListener('fullscreenchange', left)

      if (document.fullscreenElement === el) {
        void document.exitFullscreen()
      }
    }
  }, [onClose])

  const go = (to: number) => setAt(Math.min(last, Math.max(0, to)))

  const slide = useMemo(() => deck.slides[at] ?? '', [deck.slides, at])

  return (
    <div
      aria-label={copy.present}
      aria-modal
      className="fixed inset-0 z-[100] grid cursor-none place-items-center bg-black outline-none"
      onClick={() => (at === last ? onClose() : go(at + 1))}
      onKeyDown={event => {
        if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(event.key)) {
          event.preventDefault()
          go(at + 1)
        } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(event.key)) {
          event.preventDefault()
          go(at - 1)
        } else if (event.key === 'Escape') {
          onClose()
        }
      }}
      ref={stage}
      role="dialog"
      tabIndex={0}
    >
      <div className="aspect-video" style={{ width: 'min(100vw, 177.78vh)' }}>
        <Slide slide={slide} theme={deck.theme} />
      </div>
      <span className="pointer-events-none absolute right-5 bottom-4 text-xs text-white/40 tabular-nums">
        {at + 1} / {deck.slides.length}
      </span>
    </div>
  )
}
