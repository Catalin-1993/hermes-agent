import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import { notifyError } from '@/store/notifications'

import { type Delimited, serializeDelimited } from '../csv'
import { bumpLibraryRevision, type LibraryItem, writeLibraryText } from '../data'
import { rasterizeElement } from '../rasterize'
import { cellNumber, columnName, type TableSort, visibleRows } from '../table-view'
import { setLibraryView } from '../view-context'

import { PreviewSurface } from './preview-surface'

const SAVE_DEBOUNCE_MS = 800

interface Cell {
  col: number
  /** Index into the data rows (the header row, when there is one, is not counted). */
  row: number
}

type SaveState = 'error' | 'idle' | 'saved' | 'saving'

interface TableEditorProps {
  item: LibraryItem
  /** "Analyze with Hermes" and the file's ⋯ menu, beside the filter. */
  actions?: ReactNode
  initial: Delimited
  onSaved?: (item: LibraryItem) => void
}

/** A CSV / TSV as a sheet you work in: cells edited in place (Enter, Tab, arrows, typing), rows and
 *  columns added and removed, a view sorted and filtered without touching the file. Every change saves
 *  itself a moment later, in the file's own separator. */
export function TableEditor({ actions, initial, item, onSaved }: TableEditorProps) {
  const { t } = useI18n()
  const copy = t.library.table
  const [table, setTable] = useState(initial)
  const [selected, setSelected] = useState<Cell | null>(null)
  const [editing, setEditing] = useState<{ cell: Cell; draft: string; header: boolean } | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<null | TableSort>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const grid = useRef<HTMLDivElement | null>(null)
  const timer = useRef<number | null>(null)
  const latest = useRef(table)

  const header = useMemo(() => table.rows[0] ?? [], [table.rows])
  const data = useMemo(() => table.rows.slice(1), [table.rows])
  const width = Math.max(1, ...table.rows.map(row => row.length))
  const order = useMemo(() => visibleRows(data, query, sort), [data, query, sort])

  // Hermes can ask what the owner has selected ("this column", "that row") without being told.
  useEffect(() => {
    if (!selected) {
      setLibraryView({ selection: null })

      return
    }

    const row = data[selected.row] ?? []
    const named = (index: number) => header[index] || columnName(index)

    setLibraryView({
      selection:
        `Table cell: data row ${selected.row + 1}, column “${named(selected.col)}” = “${row[selected.col] ?? ''}”. ` +
        `Columns: ${Array.from({ length: width }, (_, i) => named(i)).join(' | ')}. ` +
        `That row: ${Array.from({ length: width }, (_, i) => `${named(i)}=${row[i] ?? ''}`).join(' | ')}`
    })

    return () => setLibraryView({ selection: null })
  }, [data, header, selected, width])

  // Hermes can ask for a picture of the sheet as it is on screen (the library tool's `view` with `look`).
  useEffect(() => {
    $librarySnapshot.set({
      itemId: item.id,
      take: async () => (grid.current ? rasterizeElement(grid.current, { styled: true }) : null)
    })

    return () => $librarySnapshot.set(null)
  }, [item.id])

  const save = useCallback(async () => {
    timer.current = null
    setSaveState('saving')

    try {
      const saved = await writeLibraryText(item.id, serializeDelimited(latest.current))

      setSaveState('saved')
      bumpLibraryRevision()
      onSaved?.(saved)
    } catch (error) {
      setSaveState('error')
      notifyError(error, t.library.errors.save)
    }
  }, [item.id, onSaved, t.library.errors.save])

  // Leaving with a change still waiting writes it now.
  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        void writeLibraryText(item.id, serializeDelimited(latest.current)).then(bumpLibraryRevision, () => undefined)
      }
    },
    [item.id]
  )

  // What the sheet was before each change, so ⌘Z walks back through them (and ⇧⌘Z forward again).
  const past = useRef<Delimited[]>([])
  const future = useRef<Delimited[]>([])
  const [depth, setDepth] = useState({ redo: 0, undo: 0 })

  const apply = (next: Delimited) => {
    latest.current = next
    setTable(next)
    setDepth({ redo: future.current.length, undo: past.current.length })

    if (timer.current !== null) {
      window.clearTimeout(timer.current)
    }

    timer.current = window.setTimeout(() => void save(), SAVE_DEBOUNCE_MS)
  }

  const change = (next: Delimited) => {
    past.current = [...past.current.slice(-199), latest.current]
    future.current = []
    apply(next)
  }

  const undo = () => {
    const previous = past.current.pop()

    if (previous) {
      future.current.push(latest.current)
      setEditing(null)
      apply(previous)
    }
  }

  const redo = () => {
    const next = future.current.pop()

    if (next) {
      past.current.push(latest.current)
      setEditing(null)
      apply(next)
    }
  }

  const setRows = (rows: string[][]) => change({ ...latest.current, rows })

  const pad = (row: readonly string[]) => [...row, ...Array<string>(Math.max(0, width - row.length)).fill('')]

  const writeCell = (cell: Cell, value: string, isHeader = false) => {
    // Read the sheet as it is now: a blur can arrive from a handler made before the last change.
    const rows = latest.current.rows.map(row => [...row])
    const target = isHeader ? 0 : cell.row + 1

    if ((rows[target]?.[cell.col] ?? '') === value) {
      return
    }

    while (rows.length <= target) {
      rows.push([])
    }

    rows[target] = pad(rows[target])
    rows[target][cell.col] = value
    setRows(rows)
  }

  const insertRow = (at: number) => {
    const rows = table.rows.map(row => [...row])

    // An empty file gets its header row first.
    if (rows.length === 0) {
      rows.push(Array<string>(width).fill(''))
    }

    // Data row `at` is file row `at + 1` (the header comes first): the new row goes right after it.
    rows.splice(at + 2, 0, Array<string>(width).fill(''))
    setRows(rows)
    setSelected({ col: selected?.col ?? 0, row: at + 1 })
  }

  const deleteRow = (at: number) => {
    setRows(table.rows.filter((_, index) => index !== at + 1))
    setSelected(null)
  }

  const insertColumn = (at: number) => {
    setRows(
      table.rows.map((row, index) => {
        const next = pad(row)

        next.splice(at, 0, index === 0 ? copy.newColumnName(columnName(at)) : '')

        return next
      })
    )
    setSort(null)
  }

  const deleteColumn = (at: number) => {
    if (width <= 1) {
      return
    }

    setRows(table.rows.map(row => row.filter((_, index) => index !== at)))
    setSort(current => (current?.col === at ? null : current))
    setSelected(null)
  }

  const commit = (move?: { col: number; row: number }) => {
    if (!editing) {
      return
    }

    const current = editing.header
      ? (header[editing.cell.col] ?? '')
      : (data[editing.cell.row]?.[editing.cell.col] ?? '')

    if (editing.draft !== current) {
      writeCell(editing.cell, editing.draft, editing.header)
    }

    setEditing(null)

    if (move && !editing.header) {
      const position = order.indexOf(editing.cell.row)
      const nextRow = order[Math.min(order.length - 1, Math.max(0, position + move.row))] ?? editing.cell.row

      setSelected({ col: Math.min(width - 1, Math.max(0, editing.cell.col + move.col)), row: nextRow })
    }

    grid.current?.focus()
  }

  const startEditing = (cell: Cell, draft?: string) =>
    setEditing({ cell, draft: draft ?? data[cell.row]?.[cell.col] ?? '', header: false })

  const onGridKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (editing) {
      return
    }

    if ((event.metaKey || event.ctrlKey) && !event.altKey && ['y', 'z'].includes(event.key.toLowerCase())) {
      event.preventDefault()

      if (event.key.toLowerCase() === 'y' || event.shiftKey) {
        redo()
      } else {
        undo()
      }

      return
    }

    if (!selected) {
      return
    }

    const position = order.indexOf(selected.row)

    const step = (rows: number, cols: number) => {
      event.preventDefault()
      setSelected({
        col: Math.min(width - 1, Math.max(0, selected.col + cols)),
        row: order[Math.min(order.length - 1, Math.max(0, position + rows))] ?? selected.row
      })
    }

    if (event.key === 'ArrowDown') {
      step(1, 0)
    } else if (event.key === 'ArrowUp') {
      step(-1, 0)
    } else if (event.key === 'ArrowRight' || (event.key === 'Tab' && !event.shiftKey)) {
      step(0, 1)
    } else if (event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey)) {
      step(0, -1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      startEditing(selected)
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      writeCell(selected, '')
    } else if (event.key === 'Escape') {
      setSelected(null)
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      startEditing(selected, event.key)
    }
  }

  const status = (
    <span className="flex items-center gap-2">
      {query.trim() ? copy.filtered(order.length, data.length) : copy.rows(data.length)}
      {saveState !== 'idle' && (
        <span className={cn(saveState === 'error' && 'text-(--ui-red)')}>
          · {saveState === 'saving' ? t.library.saving : saveState === 'error' ? copy.saveFailed : t.library.saved}
        </span>
      )}
    </span>
  )

  const tools = (
    <>
      <Tip label={copy.undo}>
        <Button aria-label={copy.undo} disabled={depth.undo === 0} onClick={undo} size="icon-xs" variant="ghost">
          <Codicon name="discard" size="0.8125rem" />
        </Button>
      </Tip>
      <Tip label={copy.redo}>
        <Button aria-label={copy.redo} disabled={depth.redo === 0} onClick={redo} size="icon-xs" variant="ghost">
          <Codicon className="-scale-x-100" name="discard" size="0.8125rem" />
        </Button>
      </Tip>
      <label className="mr-1 flex h-7 items-center gap-1.5 rounded-md px-2 text-(--ui-text-tertiary) focus-within:bg-(--ui-row-hover-background)">
        <Codicon name="filter" size="0.75rem" />
        <input
          aria-label={copy.filter}
          className="w-36 bg-transparent text-xs text-(--ui-text-primary) outline-none placeholder:text-(--ui-text-quaternary)"
          onChange={event => setQuery(event.target.value)}
          placeholder={copy.filter}
          value={query}
        />
      </label>
      {actions}
    </>
  )

  const cellEditor = (
    <input
      autoFocus
      className="absolute inset-0 z-10 w-full bg-(--ui-bg-elevated) px-3 text-xs text-(--ui-text-primary) shadow-[inset_0_0_0_2px_var(--ui-accent)] outline-none"
      onBlur={() => commit()}
      onChange={event => setEditing(current => (current ? { ...current, draft: event.target.value } : current))}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit({ col: 0, row: 1 })
        } else if (event.key === 'Tab') {
          event.preventDefault()
          commit({ col: event.shiftKey ? -1 : 1, row: 0 })
        } else if (event.key === 'Escape') {
          event.preventDefault()
          setEditing(null)
          grid.current?.focus()
        }
      }}
      value={editing?.draft ?? ''}
    />
  )

  return (
    <PreviewSurface status={status} tools={tools}>
      <div className="min-h-full outline-none" onKeyDown={onGridKey} ref={grid} tabIndex={0}>
        <table className="border-separate border-spacing-0 text-xs text-(--ui-text-primary)">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 w-11 border-r border-b border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary)" />
              {Array.from({ length: width }, (_, col) => {
                const sorted = sort?.col === col ? sort.dir : null
                const editingHeader = editing?.header && editing.cell.col === col

                return (
                  <th
                    className="group/col sticky top-0 z-20 min-w-32 border-r border-b border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) p-0 text-left font-medium"
                    key={col}
                  >
                    <div className="relative flex h-8 items-center gap-1 pr-1 pl-3">
                      {editingHeader ? (
                        cellEditor
                      ) : (
                        <button
                          className="min-w-0 flex-1 cursor-text truncate text-left text-xs text-(--ui-text-secondary)"
                          onDoubleClick={() =>
                            setEditing({ cell: { col, row: -1 }, draft: header[col] ?? '', header: true })
                          }
                          type="button"
                        >
                          {header[col] || <span className="text-(--ui-text-quaternary)">{columnName(col)}</span>}
                        </button>
                      )}
                      {sorted && (
                        <Codicon
                          className="shrink-0 text-(--ui-accent)"
                          name={sorted === 'asc' ? 'arrow-up' : 'arrow-down'}
                          size="0.6875rem"
                        />
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            aria-label={copy.columnMenu(header[col] || columnName(col))}
                            className="grid size-5 shrink-0 cursor-pointer place-items-center rounded text-(--ui-text-tertiary) opacity-0 transition-opacity group-hover/col:opacity-100 hover:bg-(--ui-row-hover-background) hover:text-(--ui-text-primary) data-[state=open]:opacity-100"
                            type="button"
                          >
                            <Codicon name="chevron-down" size="0.6875rem" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-48">
                          <DropdownMenuItem onSelect={() => setSort({ col, dir: 'asc' })}>
                            <Codicon name="arrow-up" size="0.8125rem" />
                            {copy.sortAsc}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setSort({ col, dir: 'desc' })}>
                            <Codicon name="arrow-down" size="0.8125rem" />
                            {copy.sortDesc}
                          </DropdownMenuItem>
                          {sorted && (
                            <DropdownMenuItem onSelect={() => setSort(null)}>
                              <Codicon name="close" size="0.8125rem" />
                              {copy.clearSort}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() =>
                              setEditing({ cell: { col, row: -1 }, draft: header[col] ?? '', header: true })
                            }
                          >
                            <Codicon name="edit" size="0.8125rem" />
                            {copy.rename}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => insertColumn(col)}>
                            <Codicon name="arrow-left" size="0.8125rem" />
                            {copy.insertLeft}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => insertColumn(col + 1)}>
                            <Codicon name="arrow-right" size="0.8125rem" />
                            {copy.insertRight}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={width <= 1}
                            onSelect={() => deleteColumn(col)}
                            variant="destructive"
                          >
                            <Codicon name="trash" size="0.8125rem" />
                            {copy.deleteColumn}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </th>
                )
              })}
              <th className="sticky top-0 z-20 border-b border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) p-0">
                <button
                  aria-label={copy.newColumn}
                  className="grid h-8 w-9 cursor-pointer place-items-center text-(--ui-text-tertiary) hover:bg-(--ui-row-hover-background) hover:text-(--ui-text-primary)"
                  onClick={() => insertColumn(width)}
                  type="button"
                >
                  <Codicon name="add" size="0.75rem" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {order.map(rowIndex => (
              <tr className="group/row" key={rowIndex}>
                <td className="sticky left-0 z-10 border-r border-b border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) p-0">
                  <div className="relative flex h-8 items-center justify-end pr-2">
                    <span className="text-[0.6875rem] text-(--ui-text-tertiary) tabular-nums group-hover/row:opacity-0">
                      {rowIndex + 1}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          aria-label={copy.rowMenu(rowIndex + 1)}
                          className="absolute inset-y-0 right-1 my-auto grid size-6 cursor-pointer place-items-center rounded text-(--ui-text-tertiary) opacity-0 group-hover/row:opacity-100 hover:bg-(--ui-row-hover-background) hover:text-(--ui-text-primary) data-[state=open]:opacity-100"
                          type="button"
                        >
                          <Codicon name="kebab-vertical" size="0.75rem" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-44">
                        <DropdownMenuItem onSelect={() => insertRow(rowIndex - 1)}>
                          <Codicon name="arrow-up" size="0.8125rem" />
                          {copy.insertAbove}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => insertRow(rowIndex)}>
                          <Codicon name="arrow-down" size="0.8125rem" />
                          {copy.insertBelow}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => deleteRow(rowIndex)} variant="destructive">
                          <Codicon name="trash" size="0.8125rem" />
                          {copy.deleteRow}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
                {Array.from({ length: width }, (_, col) => {
                  const value = data[rowIndex]?.[col] ?? ''
                  const isSelected = selected?.row === rowIndex && selected.col === col
                  const isEditing = !editing?.header && editing?.cell.row === rowIndex && editing.cell.col === col

                  return (
                    <td
                      className={cn(
                        'relative h-8 max-w-80 cursor-cell truncate border-r border-b border-(--ui-stroke-quaternary) px-3',
                        cellNumber(value) !== null && 'text-right tabular-nums',
                        isSelected && !isEditing && 'shadow-[inset_0_0_0_2px_var(--ui-accent)]'
                      )}
                      key={col}
                      onClick={() => {
                        setSelected({ col, row: rowIndex })
                        grid.current?.focus()
                      }}
                      onDoubleClick={() => startEditing({ col, row: rowIndex })}
                      title={value}
                    >
                      {isEditing ? cellEditor : value}
                    </td>
                  )
                })}
                <td className="border-b border-(--ui-stroke-quaternary)" />
              </tr>
            ))}
            <tr>
              <td className="sticky left-0 z-10 bg-(--ui-bg-editor) p-0" colSpan={1} />
              <td className="p-0" colSpan={width + 1}>
                <button
                  className="flex h-8 w-full cursor-pointer items-center gap-1.5 px-3 text-xs text-(--ui-text-tertiary) hover:bg-(--ui-row-hover-background) hover:text-(--ui-text-primary)"
                  onClick={() => {
                    insertRow(data.length - 1)
                    setQuery('')
                  }}
                  type="button"
                >
                  <Codicon name="add" size="0.75rem" />
                  {copy.newRow}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </PreviewSurface>
  )
}
