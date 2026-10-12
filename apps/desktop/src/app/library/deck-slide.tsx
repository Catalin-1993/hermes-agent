import {
  createContext,
  type CSSProperties,
  Fragment,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'

import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'

import { type DeckTheme, replaceLines, slideLayout } from './deck'
import {
  type Align,
  type Block,
  EMPTY_PARAGRAPH,
  insertBlock,
  moveBlock,
  type NewBlock,
  orderedNumber,
  parseBlocks,
  removeBlock,
  type Span
} from './deck-blocks'
import { parseInline } from './deck-inline'
import { ImageDialog, InsertMenu, type SlideUi } from './deck-insert'
import { spanStyle } from './deck-look'
import { useCoverSource } from './page-look'

/** One slide, drawn in the theme's colours. Sizes are in `cqw` (a hundredth of the slide's own width),
 *  so the same slide reads right as a thumbnail, on the canvas, full screen and on a printed page.
 *  Styles are inline on purpose: the PDF export renders it outside the app's stylesheet. */

interface ThemeStyle {
  accent: string
  background: string
  color: string
  muted: string
  rule: string
}

export const DECK_THEME_STYLE: Record<DeckTheme, ThemeStyle> = {
  ink: {
    accent: '#8ab4ff',
    background: 'linear-gradient(155deg, #101114 0%, #1a1c22 100%)',
    color: '#f3f1ec',
    muted: '#9b978d',
    rule: 'rgba(255,255,255,0.14)'
  },
  ocean: {
    accent: '#ffd37a',
    background: 'linear-gradient(150deg, #13304f 0%, #1f5e86 100%)',
    color: '#f2f7fb',
    muted: '#a9c4d7',
    rule: 'rgba(255,255,255,0.2)'
  },
  paper: {
    accent: '#3b5bdb',
    background: '#fbfaf7',
    color: '#1c1b19',
    muted: '#6b675f',
    rule: 'rgba(0,0,0,0.12)'
  },
  sand: {
    accent: '#b3601d',
    background: 'linear-gradient(150deg, #f6eee1 0%, #e9d9bb 100%)',
    color: '#2b2218',
    muted: '#7b6b50',
    rule: 'rgba(60,40,10,0.18)'
  }
}

function inline(text: string, theme: ThemeStyle): ReactNode[] {
  return parseInline(text).map((span, index) => (
    <span key={index} style={spanStyle(span, theme.accent, theme.rule)}>
      {span.text}
    </span>
  ))
}

/** `library://<id>` is a Library image; anything else is used as written. */
const libraryId = (src: string) => /^library:\/\/([\w-]+)/.exec(src)?.[1] ?? null

function SlideImage({
  align,
  alt,
  images,
  src
}: {
  align?: Align
  alt: string
  images?: Record<string, string>
  src: string
}) {
  const id = libraryId(src)
  // Live slides read the Library image once; an export hands the pictures over already read.
  const live = useCoverSource(images ? null : id)
  const resolved = id ? (images?.[id] ?? live) : src

  return resolved ? (
    <img
      alt={alt}
      src={resolved}
      style={{
        borderRadius: '1cqw',
        maxHeight: '42cqw',
        maxWidth: '100%',
        alignSelf: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        objectFit: 'contain',
        objectPosition: align ?? 'left'
      }}
    />
  ) : (
    <div style={{ background: 'rgba(127,127,127,0.12)', borderRadius: '1cqw', height: '18cqw', width: '30cqw' }} />
  )
}

interface EditableProps {
  active: boolean
  children: ReactNode
  /** Enter adds a line instead of finishing (code). */
  multiline?: boolean
  /** The words as the slide's source has them (`**bold**` and all): what editing shows. */
  raw: string
  onActivate: () => void
  /** `enter`: the person pressed Enter (a list continues; an empty item ends it). */
  onDone: (raw: null | string, enter: boolean) => void
  placeholder?: string
}

/** Set by a block: "/" typed in one of its empty fields asks it to open its menu. */
const SlashContext = createContext<(() => void) | null>(null)

/** The words while they are being edited: their source, in a plain-text field that grows with them.
 *  Mounted per edit, so it settles exactly once — Enter or leaving keeps the change, Esc drops it. */
function Editing({
  multiline,
  onDone,
  placeholder,
  raw
}: Pick<EditableProps, 'multiline' | 'onDone' | 'placeholder' | 'raw'>) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const settled = useRef(false)
  const slash = useContext(SlashContext)

  useEffect(() => {
    const el = ref.current

    if (!el) {
      return
    }

    const take = () => {
      el.focus()

      const range = document.createRange()

      range.selectNodeContents(el)
      range.collapse(false)

      const selection = window.getSelection()

      selection?.removeAllRanges()
      selection?.addRange(range)
    }

    take()

    // A block inserted from a menu mounts while the menu still holds focus: take it again once it lets go.
    const timer = window.setTimeout(() => document.activeElement !== el && take(), 120)

    return () => window.clearTimeout(timer)
  }, [])

  const finish = (keep: boolean, enter = false) => {
    if (settled.current) {
      return
    }

    settled.current = true

    const words = (ref.current?.textContent ?? '').replaceAll(EMPTY_PARAGRAPH, '')

    onDone(keep ? (multiline ? words.replace(/^\n+|\n+$/g, '') : words.replace(/\s*\n\s*/g, ' ').trim()) : null, enter)
  }

  return (
    <span
      contentEditable="plaintext-only"
      data-editing=""
      data-placeholder={placeholder}
      onBlur={() => finish(true)}
      onKeyDown={event => {
        event.stopPropagation()

        if (event.key === '/' && slash && !(ref.current?.textContent ?? '').replaceAll(EMPTY_PARAGRAPH, '')) {
          // The block is still empty: hand it to the menu, and keep it while the menu is up.
          event.preventDefault()
          settled.current = true
          slash()
        } else if (event.key === 'Enter' && !multiline) {
          event.preventDefault()
          finish(true, true)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          finish(false)
        }
      }}
      ref={ref}
      style={{
        cursor: 'text',
        display: multiline ? 'block' : undefined,
        minWidth: '2ch',
        outline: 'none',
        whiteSpace: 'pre-wrap'
      }}
      suppressContentEditableWarning
    >
      {raw.replaceAll(EMPTY_PARAGRAPH, '')}
    </span>
  )
}

/** Text on the slide that can be clicked and typed over, in place. While it is being edited it shows its
 *  source, so formatting is never lost. */
function Editable({ active, children, multiline, onActivate, onDone, placeholder, raw }: EditableProps) {
  return active ? (
    <Editing multiline={multiline} onDone={onDone} placeholder={placeholder} raw={raw} />
  ) : (
    <span data-edit="" onClick={onActivate} style={{ cursor: 'text' }}>
      {children}
    </span>
  )
}

interface BlockFrameProps {
  children: ReactNode
  first: boolean
  last: boolean
  /** `replace`: the block was empty and opened the menu with "/", so the choice takes its place. */
  onInsert: (kind: NewBlock, replace: boolean) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  ui: SlideUi
}

const TOOL =
  'grid size-5 cursor-pointer place-items-center rounded text-white/90 transition-colors hover:bg-white/20 disabled:cursor-default disabled:opacity-30'

/** A block on the canvas with its tools — add after it, move, delete — which show on hover. */
function BlockFrame({ children, first, last, onInsert, onMove, onRemove, ui }: BlockFrameProps) {
  const [open, setOpen] = useState(false)
  const slashed = useRef(false)

  return (
    <SlashContext.Provider
      value={() => {
        slashed.current = true
        setOpen(true)
      }}
    >
      <div data-block="" style={{ position: 'relative' }}>
        <div
          className="absolute -top-3.5 right-0 z-10 flex items-center gap-px rounded-md bg-black/60 p-0.5 backdrop-blur-sm"
          data-block-tools=""
          data-open={open || undefined}
        >
          <InsertMenu
            onOpenChange={next => {
              setOpen(next)

              // Closed without a choice after "/": the empty block it left behind goes.
              if (!next && slashed.current) {
                slashed.current = false
                onRemove()
              }
            }}
            onPick={kind => {
              const replace = slashed.current

              slashed.current = false
              onInsert(kind, replace)
            }}
            open={open}
            ui={ui}
          >
            <button aria-label={ui.addBlock} className={TOOL} type="button">
              <Codicon name="add" size="0.75rem" />
            </button>
          </InsertMenu>
          <Tip label={ui.moveUp}>
            <button aria-label={ui.moveUp} className={TOOL} disabled={first} onClick={() => onMove(-1)} type="button">
              <Codicon name="arrow-up" size="0.75rem" />
            </button>
          </Tip>
          <Tip label={ui.moveDown}>
            <button aria-label={ui.moveDown} className={TOOL} disabled={last} onClick={() => onMove(1)} type="button">
              <Codicon name="arrow-down" size="0.75rem" />
            </button>
          </Tip>
          <Tip label={ui.removeBlock}>
            <button aria-label={ui.removeBlock} className={TOOL} onClick={onRemove} type="button">
              <Codicon name="trash" size="0.75rem" />
            </button>
          </Tip>
        </div>
        {children}
      </div>
    </SlashContext.Provider>
  )
}

interface SlideProps {
  images?: Record<string, string>
  /** The presentation this slide belongs to: where a picture added from the canvas is saved. */
  itemId?: string
  /** Words for the canvas's own controls; without them the slide edits its text only. */
  ui?: SlideUi
  /** Given: text on the slide can be edited in place, and the slide's new source comes back here. */
  onChange?: (slide: string) => void
  /** Shown on an empty slide that can be edited. */
  emptyHint?: string
  slide: string
  theme: DeckTheme
}

export function Slide({ emptyHint, images, itemId, onChange, slide, theme: themeId, ui }: SlideProps) {
  const theme = DECK_THEME_STYLE[themeId]
  const title = slideLayout(slide) === 'title'
  const parts = parseBlocks(slide)
  // The source line being edited (a block's first line, or a list item's own).
  const [editing, setEditing] = useState<null | number>(null)
  // Where a picture picked in the dialog goes, and whether it takes an empty block's place.
  const [imageAt, setImageAt] = useState<null | { after: number; replace: boolean }>(null)
  const [endMenu, setEndMenu] = useState(false)
  const imagePicked = useRef(false)

  const insertAt = (after: number, kind: NewBlock, replace = false) => {
    if (kind === 'image') {
      imagePicked.current = false
      setImageAt({ after, replace })

      return
    }

    const added = insertBlock(slide, after, kind, undefined, replace)

    onChange?.(added.slide)
    setEditing(added.line)
  }

  const heading = (level: 1 | 2 | 3): CSSProperties => ({
    color: theme.color,
    fontFamily: 'var(--dt-font-display, Georgia, serif)',
    fontSize: title && level === 1 ? '8.4cqw' : level === 1 ? '5.4cqw' : level === 2 ? '4.4cqw' : '3.2cqw',
    fontStyle: 'normal',
    fontWeight: title && level === 1 ? 500 : 600,
    letterSpacing: '-0.025em',
    lineHeight: 1.08,
    margin: 0
  })

  const body: CSSProperties = {
    color: theme.color,
    fontSize: title ? '2.8cqw' : '2.45cqw',
    lineHeight: 1.45,
    margin: 0
  }

  /** Words of a block, editable when the slide is. `write` turns the new words into the block's source lines. */
  const text = (
    span: Span,
    raw: string,
    shown: ReactNode,
    write: (words: string, enter: boolean) => string[],
    line = span.line,
    end = span.end,
    multiline = false
  ) =>
    onChange ? (
      <Editable
        active={editing === line}
        multiline={multiline}
        onActivate={() => setEditing(line)}
        onDone={(words, enter) => {
          if (words === null) {
            // Esc drops the change; a block that was only just started (still empty) goes with it.
            if (raw === '') {
              onChange(replaceLines(slide, line, end, []))
            }

            setEditing(null)

            return
          }

          const next = write(words, enter)

          onChange(replaceLines(slide, line, end, next))
          setEditing(enter && next.length > 1 ? line + 1 : null)
        }}
        placeholder={ui?.typeHere}
        raw={raw.replaceAll(EMPTY_PARAGRAPH, '')}
      >
        {shown}
      </Editable>
    ) : (
      shown
    )

  return (
    <div
      data-slide=""
      style={{
        background: theme.background,
        color: theme.color,
        containerType: 'inline-size',
        fontFamily: 'var(--dt-font-sans, ui-sans-serif, system-ui, sans-serif)',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        width: '100%'
      }}
    >
      <div
        style={{
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: title ? '2.4cqw' : '2cqw',
          height: '100%',
          justifyContent: 'center',
          padding: title ? '7cqw 8cqw' : '6cqw 7cqw',
          width: '100%'
        }}
      >
        {!title && parts[0]?.kind === 'heading' && (
          <span
            style={{
              background: theme.accent,
              borderRadius: '1cqw',
              display: 'block',
              height: '0.5cqw',
              width: '5cqw'
            }}
          />
        )}
        {parts.length === 0 && onChange && (
          <button
            onClick={() => {
              onChange('## ')
              setEditing(0)
            }}
            style={{
              background: 'none',
              border: 0,
              color: theme.muted,
              cursor: 'text',
              font: 'inherit',
              fontSize: '3cqw',
              padding: 0,
              textAlign: 'left'
            }}
            type="button"
          >
            {emptyHint}
          </button>
        )}
        {parts.map((part, index) => {
          const node = renderPart(part, index)

          return onChange && ui ? (
            <BlockFrame
              first={index === 0}
              key={index}
              last={index === parts.length - 1}
              onInsert={(kind, replace) => insertAt(index, kind, replace)}
              onMove={direction => onChange(moveBlock(slide, index, direction))}
              onRemove={() => onChange(removeBlock(slide, index))}
              ui={ui}
            >
              {node}
            </BlockFrame>
          ) : (
            node
          )
        })}
        {onChange && ui && parts.length > 0 && (
          <InsertMenu
            onOpenChange={setEndMenu}
            onPick={kind => insertAt(parts.length - 1, kind)}
            open={endMenu}
            ui={ui}
          >
            <button
              className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[color:inherit] opacity-0 transition-opacity hover:bg-black/5 [[data-slide]:hover_&]:opacity-60 hover:!opacity-100"
              data-add-block=""
              type="button"
            >
              <Codicon name="add" size="0.75rem" />
              {ui.addBlock}
            </button>
          </InsertMenu>
        )}
        {onChange && ui && (
          <ImageDialog
            itemId={itemId}
            onOpenChange={open => {
              if (!open) {
                if (imageAt?.replace && !imagePicked.current) {
                  onChange(removeBlock(slide, imageAt.after))
                }

                setImageAt(null)
              }
            }}
            onPick={id => {
              imagePicked.current = true

              if (imageAt) {
                onChange(
                  insertBlock(slide, imageAt.after, 'image', { alt: '', src: `library://${id}` }, imageAt.replace).slide
                )
              }
            }}
            open={imageAt !== null}
            title={ui.pickImage}
          />
        )}
      </div>
    </div>
  )

  function renderPart(part: Block, index: number): ReactNode {
    if (part.kind === 'heading') {
      const Tag = `h${part.level}` as 'h1'
      const prefix = `${'#'.repeat(part.level)} `

      return (
        <Tag key={index} style={{ ...heading(part.level), textAlign: part.align }}>
          {text(part, part.text, inline(part.text, theme), words => (words ? [prefix + words] : []))}
        </Tag>
      )
    }

    if (part.kind === 'paragraph') {
      return (
        <p key={index} style={{ ...body, color: title ? theme.muted : theme.color, textAlign: part.align }}>
          {text(part, part.text, inline(part.text, theme), words => (words ? [words] : []))}
        </p>
      )
    }

    if (part.kind === 'quote') {
      return (
        <blockquote
          key={index}
          style={{
            ...body,
            borderLeft: `0.5cqw solid ${theme.accent}`,
            fontSize: '3cqw',
            fontStyle: 'italic',
            margin: 0,
            padding: '0.4cqw 0 0.4cqw 2.4cqw',
            textAlign: part.align
          }}
        >
          {text(part, part.text, inline(part.text, theme), words => (words ? [`> ${words}`] : []))}
        </blockquote>
      )
    }

    if (part.kind === 'code') {
      return (
        <pre
          key={index}
          style={{
            background: theme.rule,
            borderRadius: '1cqw',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '1.9cqw',
            lineHeight: 1.5,
            margin: 0,
            overflow: 'hidden',
            padding: '1.8cqw 2.2cqw',
            whiteSpace: 'pre-wrap'
          }}
        >
          {text(
            part,
            part.text,
            part.text,
            words => (words ? ['```', ...words.split('\n'), '```'] : []),
            part.line,
            part.end,
            true
          )}
        </pre>
      )
    }

    if (part.kind === 'image') {
      return <SlideImage align={part.align} alt={part.alt} images={images} key={index} src={part.src} />
    }

    return (
      <ul
        key={index}
        style={{
          ...body,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.1cqw',
          listStyle: 'none',
          padding: 0
        }}
      >
        {part.items.map((item, itemIndex) => (
          <li
            key={itemIndex}
            style={{
              display: 'flex',
              gap: '1.4cqw',
              justifyContent: part.align === 'center' ? 'center' : part.align === 'right' ? 'flex-end' : undefined,
              marginLeft: `${item.depth * 3.2}cqw`
            }}
          >
            <span
              style={{
                color: theme.accent,
                flex: 'none',
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 600,
                minWidth: '1.4cqw'
              }}
            >
              {item.ordered ? `${orderedNumber(part.items, itemIndex)}.` : item.depth ? '–' : '•'}
            </span>
            <span style={{ fontSize: item.depth ? '2.15cqw' : undefined, minWidth: '1ch' }}>
              <Fragment>
                {text(
                  part,
                  item.text,
                  inline(item.text, theme),
                  // Enter on an empty item ends the list; on a filled one it starts the next item.
                  (words, enter) => (words ? (enter ? [item.prefix + words, item.prefix] : [item.prefix + words]) : []),
                  item.line,
                  item.line
                )}
              </Fragment>
            </span>
          </li>
        ))}
      </ul>
    )
  }
}
