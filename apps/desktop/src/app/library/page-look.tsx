import { type ReactNode, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { FullEmojiPicker } from '@/components/ui/emoji-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'

import { importLibraryFile, type LibraryItem, listLibrary, readLibraryBlob } from './data'
import { itemTypeOf } from './file-types'
import { LibraryThumb } from './library-thumb'

/** A page's look, Notion-style: a cover band across the top and an emoji over its title.
 *
 *  The cover is one string on the page (`gradient:<name>` or `image:<item id>`, an image with
 *  `@<0-100>` for its vertical focus). Images are Library items — chosen from it, or uploaded into
 *  the page itself — so they follow the page's access, copies and trash like anything else. */

// Quiet, paper-and-ink tones first, then a few deep ones: covers frame a page, they do not shout.
export const COVER_GRADIENTS: Record<string, string> = {
  paper: 'linear-gradient(135deg, #faf8f3 0%, #ece5d8 100%)',
  mist: 'linear-gradient(135deg, #eef2f6 0%, #cdd9e5 55%, #a9bdd0 100%)',
  sage: 'linear-gradient(135deg, #e6ebdf 0%, #bccdb5 55%, #8fa88f 100%)',
  sand: 'linear-gradient(135deg, #f4ecdf 0%, #e2cfae 55%, #c6a77c 100%)',
  dawn: 'linear-gradient(135deg, #f7dccb 0%, #ebbfcd 50%, #c8bce6 100%)',
  lilac: 'linear-gradient(135deg, #ece7f6 0%, #cdc2ea 55%, #a796d6 100%)',
  peach: 'linear-gradient(135deg, #ffe6d3 0%, #ffc7a6 55%, #ef9f86 100%)',
  ocean: 'linear-gradient(135deg, #1d3557 0%, #2f6690 55%, #84b6d8 100%)',
  forest: 'linear-gradient(135deg, #10241d 0%, #1f4a3c 50%, #3f7d63 100%)',
  ember: 'linear-gradient(135deg, #34191f 0%, #873b37 55%, #df8d47 100%)',
  graphite: 'linear-gradient(135deg, #232326 0%, #45454b 55%, #75757c 100%)',
  night: 'linear-gradient(160deg, #0b0d17 0%, #1b1f3a 55%, #3d3160 100%)'
}

const GRADIENT_NAMES = Object.keys(COVER_GRADIENTS)

export type PageCover = { kind: 'gradient'; name: string } | { focus: number; id: string; kind: 'image' }

export function parseCover(cover: null | string | undefined): null | PageCover {
  if (!cover) {
    return null
  }

  if (cover.startsWith('gradient:')) {
    const name = cover.slice('gradient:'.length)

    return name in COVER_GRADIENTS ? { kind: 'gradient', name } : null
  }

  if (cover.startsWith('image:')) {
    const [id, focus] = cover.slice('image:'.length).split('@')
    const y = Number(focus)

    return id ? { focus: Number.isFinite(y) && focus ? Math.min(100, Math.max(0, y)) : 50, id, kind: 'image' } : null
  }

  return null
}

export const imageCover = (id: string, focus = 50) => `image:${id}@${Math.round(focus)}`

const randomGradient = () => `gradient:${GRADIENT_NAMES[Math.floor(Math.random() * GRADIENT_NAMES.length)]}`

// One read per image for the window's life — local and remote backends alike.
const coverSources = new Map<string, Promise<string>>()

function coverSource(id: string): Promise<string> {
  let pending = coverSources.get(id)

  if (!pending) {
    pending = readLibraryBlob(id).then(blob => URL.createObjectURL(blob))
    pending.catch(() => coverSources.delete(id))
    coverSources.set(id, pending)
  }

  return pending
}

export function useCoverSource(id: null | string) {
  const [src, setSrc] = useState<null | string>(null)

  useEffect(() => {
    setSrc(null)

    if (!id) {
      return
    }

    let live = true

    coverSource(id).then(
      next => live && setSrc(next),
      () => undefined
    )

    return () => {
      live = false
    }
  }, [id])

  return src
}

const CHIP =
  'h-7 gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--ui-bg-elevated)_88%,transparent)] px-2.5 text-xs font-normal text-(--ui-text-secondary) shadow-[0_0_0_0.0625rem_var(--ui-stroke-tertiary)] backdrop-blur-md hover:bg-(--ui-bg-elevated) hover:text-(--ui-text-primary)'

interface PageLookProps {
  item: LibraryItem
  onChange: (patch: { cover?: string; icon?: string }) => void
}

/** The band across the top of a page, with its controls on hover; nothing when the page has none. */
export function PageCoverBand({ item, onChange }: PageLookProps) {
  const copy = useI18n().t.library.pageLook
  const cover = parseCover(item.cover)
  const src = useCoverSource(cover?.kind === 'image' ? cover.id : null)
  const [focus, setFocus] = useState<null | number>(null)
  const band = useRef<HTMLDivElement | null>(null)
  const picture = useRef<HTMLImageElement | null>(null)

  if (!cover) {
    return null
  }

  const repositioning = focus !== null && cover.kind === 'image'
  const shownFocus = repositioning ? focus : cover.kind === 'image' ? cover.focus : 50

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!repositioning || !band.current || !picture.current) {
      return
    }

    const box = band.current.getBoundingClientRect()
    const { naturalHeight, naturalWidth } = picture.current
    // How far the picture overflows the band: dragging that far moves the focus end to end.
    const overflow = naturalWidth ? (box.width * naturalHeight) / naturalWidth - box.height : 0

    if (overflow <= 0) {
      return
    }

    const startY = event.clientY
    const startFocus = focus
    const target = event.currentTarget

    target.setPointerCapture(event.pointerId)

    const move = (next: PointerEvent) =>
      setFocus(Math.min(100, Math.max(0, startFocus - ((next.clientY - startY) / overflow) * 100)))

    const stop = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', stop)
    }

    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', stop)
  }

  return (
    <div
      className={cn(
        'group/cover relative h-[clamp(8.5rem,24vh,13.5rem)] w-full overflow-hidden',
        repositioning && 'cursor-ns-resize'
      )}
      data-slot="library-page-cover"
      onPointerDown={drag}
      ref={band}
      style={
        cover.kind === 'gradient'
          ? { background: COVER_GRADIENTS[cover.name] }
          : { background: 'var(--ui-bg-tertiary)' }
      }
    >
      {cover.kind === 'image' && src && (
        <img
          alt=""
          className="size-full select-none object-cover"
          draggable={false}
          ref={picture}
          src={src}
          style={{ objectPosition: `center ${shownFocus}%` }}
        />
      )}
      {repositioning && (
        <span className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-md bg-black/45 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
          {copy.dragHint}
        </span>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto flex max-w-3xl justify-end px-6 pb-3">
        <div
          className={cn(
            'pointer-events-auto flex gap-1.5 transition-opacity duration-150',
            repositioning ? 'opacity-100' : 'opacity-0 group-hover/cover:opacity-100 has-data-[state=open]:opacity-100'
          )}
          onPointerDown={event => event.stopPropagation()}
        >
          {repositioning ? (
            <>
              <Button className={CHIP} onClick={() => setFocus(null)} variant="ghost">
                {copy.cancel}
              </Button>
              <Button
                className={CHIP}
                onClick={() => {
                  onChange({ cover: imageCover(cover.id, focus) })
                  setFocus(null)
                }}
                variant="ghost"
              >
                {copy.savePosition}
              </Button>
            </>
          ) : (
            <>
              <CoverPicker item={item} onPick={next => onChange({ cover: next })}>
                <Button className={CHIP} variant="ghost">
                  <Codicon name="symbol-color" size="0.8125rem" />
                  {copy.changeCover}
                </Button>
              </CoverPicker>
              {cover.kind === 'image' && (
                <Button className={CHIP} onClick={() => setFocus(cover.focus)} variant="ghost">
                  <Codicon className="rotate-90" name="arrow-both" size="0.8125rem" />
                  {copy.reposition}
                </Button>
              )}
              <Button className={CHIP} onClick={() => onChange({ cover: '' })} variant="ghost">
                {copy.removeCover}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

type PickerTab = 'gallery' | 'library' | 'upload'

function CoverPicker({
  children,
  item,
  onPick
}: {
  children: ReactNode
  item: LibraryItem
  onPick: (cover: string) => void
}) {
  const copy = useI18n().t.library.pageLook
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<PickerTab>('gallery')
  const current = item.cover ?? ''

  const pick = (cover: string) => {
    onPick(cover)
    setOpen(false)
  }

  const tabs: [PickerTab, string][] = [
    ['gallery', copy.gallery],
    ['library', copy.fromLibrary],
    ['upload', copy.upload]
  ]

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-[25rem] p-0" sideOffset={8}>
        <div className="flex gap-1 border-b border-(--ui-stroke-tertiary) px-2 pt-2" role="tablist">
          {tabs.map(([id, label]) => (
            <button
              aria-selected={tab === id}
              className={cn(
                '-mb-px cursor-pointer border-b-2 px-2 pb-2 text-xs transition-colors',
                tab === id
                  ? 'border-(--ui-text-primary) text-(--ui-text-primary)'
                  : 'border-transparent text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
              )}
              key={id}
              onClick={() => setTab(id)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-h-80 overflow-y-auto p-3">
          {tab === 'gallery' && (
            <div className="grid grid-cols-4 gap-2">
              {GRADIENT_NAMES.map(name => (
                <button
                  aria-label={name}
                  className={cn(
                    'h-14 cursor-pointer rounded-md shadow-[inset_0_0_0_0.0625rem_rgb(0_0_0/0.06)] transition-transform hover:scale-[1.03]',
                    current === `gradient:${name}` &&
                      'ring-2 ring-(--ui-accent) ring-offset-2 ring-offset-(--ui-bg-elevated)'
                  )}
                  key={name}
                  onClick={() => pick(`gradient:${name}`)}
                  style={{ background: COVER_GRADIENTS[name] }}
                  type="button"
                />
              ))}
            </div>
          )}
          {tab === 'library' && <LibraryImages current={current} onPick={id => pick(imageCover(id))} />}
          {tab === 'upload' && <UploadCover onPick={pick} pageId={item.id} />}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function LibraryImages({ current, onPick }: { current: string; onPick: (id: string) => void }) {
  const copy = useI18n().t.library.pageLook
  const [images, setImages] = useState<LibraryItem[] | null>(null)

  useEffect(() => {
    let live = true

    listLibrary({ kind: 'file', order: 'desc', sort: 'updated' }).then(
      ({ items }) => live && setImages(items.filter(item => itemTypeOf(item) === 'image')),
      () => live && setImages([])
    )

    return () => {
      live = false
    }
  }, [])

  if (images === null) {
    return <div className="h-24" />
  }

  if (images.length === 0) {
    return <p className="py-8 text-center text-xs text-(--ui-text-tertiary)">{copy.noImages}</p>
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map(image => (
        <button
          aria-label={image.title || image.file_name || ''}
          className={cn(
            'cursor-pointer overflow-hidden rounded-md transition-transform hover:scale-[1.03]',
            current.startsWith(`image:${image.id}`) &&
              'ring-2 ring-(--ui-accent) ring-offset-2 ring-offset-(--ui-bg-elevated)'
          )}
          key={image.id}
          onClick={() => onPick(image.id)}
          type="button"
        >
          <LibraryThumb className="h-16" item={image} size="card" />
        </button>
      ))}
    </div>
  )
}

export function UploadCover({ onPick, pageId }: { onPick: (cover: string) => void; pageId: string }) {
  const { t } = useI18n()
  const copy = t.library.pageLook
  const field = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

  const upload = async (file: File) => {
    setBusy(true)

    try {
      const saved = await importLibraryFile(file, pageId)

      onPick(imageCover(saved.id))
    } catch (error) {
      notifyError(error, t.library.errors.save)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 py-5">
      <Button disabled={busy} onClick={() => field.current?.click()} size="sm" variant="outline">
        {busy ? <Codicon name="loading" size="0.8125rem" spinning /> : <Codicon name="cloud-upload" size="0.8125rem" />}
        {copy.uploadAction}
      </Button>
      <p className="text-center text-[0.6875rem] text-(--ui-text-tertiary)">{copy.uploadHint}</p>
      <input
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0]

          event.target.value = ''

          if (file) {
            void upload(file)
          }
        }}
        ref={field}
        type="file"
      />
    </div>
  )
}

/** The emoji over the title, and — on hover over the page's head — "Add icon" / "Add cover". */
export function PageHeadLook({ item, onChange }: PageLookProps) {
  const copy = useI18n().t.library.pageLook
  const [picking, setPicking] = useState(false)
  const covered = Boolean(parseCover(item.cover))

  const choose = (icon: string) => {
    onChange({ icon })
    setPicking(false)
  }

  const picker = (trigger: ReactNode) => (
    <Popover onOpenChange={setPicking} open={picking}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1" sideOffset={6}>
        {item.icon && (
          <div className="flex justify-end px-1 pb-1">
            <Button
              className="h-6 px-2 text-xs font-normal text-(--ui-text-tertiary)"
              onClick={() => choose('')}
              variant="ghost"
            >
              {copy.removeIcon}
            </Button>
          </div>
        )}
        <FullEmojiPicker onSelect={choose} />
      </PopoverContent>
    </Popover>
  )

  return (
    <>
      {item.icon &&
        picker(
          <button
            aria-label={copy.changeIcon}
            className={cn(
              'relative z-10 mb-1 grid size-[4.75rem] cursor-pointer place-items-center rounded-lg text-[3.75rem] leading-none transition-colors hover:bg-(--chrome-action-hover)',
              covered && '-mt-[4.75rem]'
            )}
            type="button"
          >
            {item.icon}
          </button>
        )}
      <div
        className={cn(
          'flex h-7 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/head:opacity-100 focus-within:opacity-100 has-data-[state=open]:opacity-100',
          !item.icon && covered && 'mt-4'
        )}
      >
        {!item.icon &&
          picker(
            <Button className="h-7 gap-1.5 px-2 text-xs font-normal text-(--ui-text-tertiary)" variant="ghost">
              <Codicon name="smiley" size="0.875rem" />
              {copy.addIcon}
            </Button>
          )}
        {!covered && (
          <Button
            className="h-7 gap-1.5 px-2 text-xs font-normal text-(--ui-text-tertiary)"
            onClick={() => onChange({ cover: randomGradient() })}
            variant="ghost"
          >
            <Codicon name="symbol-color" size="0.875rem" />
            {copy.addCover}
          </Button>
        )}
      </div>
    </>
  )
}
