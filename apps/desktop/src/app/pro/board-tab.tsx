/**
 * Brain (Pro Mode): the Board tab — This chat (the conversation's whiteboard) or Project (the map of the whole
 * project), with Catch me up on top. Data and writing live in board-store.ts; this file only draws it.
 */

import { useStore } from '@nanostores/react'
import { type ReactNode, useEffect, useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { chatMessageText } from '@/lib/chat-messages/parts'
import { cn } from '@/lib/utils'
import { $busy, $currentCwd, $messages } from '@/store/session'
import { $activeSessionId } from '@/store/session'
import { $focusedStoredSessionId } from '@/store/session-focus'
import { $todosBySession } from '@/store/todos'

import type { CatchUp, CatchUpStatus, ChatBoard, NoteStatus, ProjectMap } from './board-model'
import {
  $boardErrors,
  $boardWriting,
  $catchUps,
  $chatBoards,
  $projectMaps,
  writeCatchUp,
  writeChatBoard,
  writeProjectMap
} from './board-store'
import { Card, Dot, Empty, Segmented, STATUS_TONE, useAgo } from './pro-ui'

const NOTE_ORDER: readonly NoteStatus[] = ['done', 'now', 'next', 'talked', 'failed']

function useChatSource() {
  const messages = useStore($messages)
  const runtimeId = useStore($activeSessionId)
  const storedId = useStore($focusedStoredSessionId)
  const todos = useStore($todosBySession)[runtimeId ?? ''] ?? []

  const lines = messages
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .map(message => ({ role: message.role, text: chatMessageText(message) }))
    .filter(line => line.text.trim())

  const steps = todos.map(todo => `[${todo.status}] ${todo.content}`)

  return { key: storedId ?? runtimeId ?? '', lines, steps, todos }
}

function Refresh({ busy, onClick, title }: { busy: boolean; onClick: () => void; title: string }) {
  return (
    <Tip label={title}>
      <button
        aria-label={title}
        className="grid size-6 place-items-center rounded-md text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground disabled:opacity-50"
        disabled={busy}
        onClick={onClick}
        type="button"
      >
        <Codicon name="refresh" size="0.75rem" spinning={busy} />
      </button>
    </Tip>
  )
}

function ChatView() {
  const { t } = useI18n()
  const copy = t.pro.board
  const { key, lines, steps, todos } = useChatSource()
  const busy = useStore($busy)
  const board: ChatBoard | undefined = useStore($chatBoards)[key]
  const writingNow = Boolean(useStore($boardWriting)[`chat:${key}`])
  const error = useStore($boardErrors)[`chat:${key}`]
  const ago = useAgo(board?.at)
  const stale = !board || board.basis < lines.length

  // Rewrite a stale board once the agent is idle — never mid-turn, never for an empty chat.
  useEffect(() => {
    if (!key || busy || lines.length === 0 || !stale || writingNow || error) {
      return
    }

    const timer = window.setTimeout(() => void writeChatBoard(key, lines, steps), 1200)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on what makes the board stale, not on array identity
  }, [key, busy, lines.length, stale, writingNow, error])

  if (!key || lines.length === 0) {
    return <Empty icon="comment-discussion" text={copy.chatEmpty} />
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Card
        label={copy.where}
        trailing={
          <span className="flex items-center gap-1">
            {ago && <span>{ago}</span>}
            <Refresh busy={writingNow} onClick={() => void writeChatBoard(key, lines, steps)} title={copy.refresh} />
          </span>
        }
      >
        <p className="text-[0.8125rem] leading-relaxed text-foreground">
          {board?.where || (writingNow ? copy.writing : copy.notYet)}
        </p>
        {error && <p className="text-xs text-(--ui-red,#f85149)">{error}</p>}
      </Card>

      {todos.length > 0 && (
        <Card label={copy.steps(todos.filter(todo => todo.status === 'completed').length, todos.length)}>
          <ul className="flex flex-col gap-1.5">
            {todos.map(todo => (
              <li className="flex items-baseline gap-2 text-[0.8125rem]" key={todo.id}>
                <Dot
                  tone={
                    todo.status === 'completed'
                      ? 'done'
                      : todo.status === 'in_progress'
                        ? 'now'
                        : todo.status === 'cancelled'
                          ? 'failed'
                          : 'next'
                  }
                />
                <span className={cn('min-w-0', todo.status === 'completed' && 'text-(--ui-text-secondary)')}>
                  {todo.content}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {board && <NotesBoard board={board} />}
    </div>
  )
}

function NotesBoard({ board }: { board: ChatBoard }) {
  const { t } = useI18n()
  const copy = t.pro.board
  const filled = NOTE_ORDER.filter(status => board.notes[status].length > 0)

  if (filled.length === 0) {
    return null
  }

  return (
    <section
      className="grid grid-cols-2 gap-2 rounded-xl p-2.5"
      data-slot="pro-whiteboard"
      style={{
        backgroundColor: 'var(--ui-bg-quaternary, var(--chrome-action-hover))',
        backgroundImage:
          'radial-gradient(color-mix(in oklab, var(--ui-text-tertiary) 30%, transparent) 1px, transparent 1px)',
        backgroundSize: '14px 14px'
      }}
    >
      {filled.map(status => (
        <div className="flex min-w-0 flex-col gap-1.5" key={status}>
          <h4 className="flex items-center gap-1.5 text-[0.6875rem] font-medium tracking-wide text-(--ui-text-tertiary) uppercase">
            <Dot tone={status} />
            {copy.status[status]}
          </h4>
          {board.notes[status].map(note => (
            <p
              className="rounded-md px-2 py-1.5 text-xs leading-snug text-foreground [overflow-wrap:anywhere]"
              key={note}
              style={{
                background: `color-mix(in oklab, ${STATUS_TONE[status]} 16%, var(--ui-bg-elevated, var(--ui-bg-editor)))`
              }}
            >
              {note}
            </p>
          ))}
        </div>
      ))}
    </section>
  )
}

function ProjectView({ boardWhere }: { boardWhere: string }) {
  const { t } = useI18n()
  const copy = t.pro.board
  const path = useStore($currentCwd) ?? ''
  const map: ProjectMap | undefined = useStore($projectMaps)[path]
  const writingNow = Boolean(useStore($boardWriting)[`map:${path}`])
  const error = useStore($boardErrors)[`map:${path}`]
  const ago = useAgo(map?.at)

  useEffect(() => {
    if (path && !map && !writingNow && !error) {
      void writeProjectMap(path, boardWhere)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first look at a project writes its map once
  }, [path])

  if (!path) {
    return <Empty icon="folder" text={copy.projectEmpty} />
  }

  const done = map?.milestones.filter(step => step.done).length ?? 0
  const total = map?.milestones.length ?? 0

  return (
    <div className="flex flex-col gap-2.5">
      <Card
        label={copy.idea}
        trailing={
          <span className="flex items-center gap-1">
            {ago && <span>{ago}</span>}
            <Refresh busy={writingNow} onClick={() => void writeProjectMap(path, boardWhere)} title={copy.refresh} />
          </span>
        }
      >
        <p className="text-[0.8125rem] leading-relaxed text-foreground">
          {map?.idea || (writingNow ? copy.mapping : copy.notYet)}
        </p>
        {error && <p className="text-xs text-(--ui-red,#f85149)">{error}</p>}
      </Card>
      {map && total > 0 && (
        <Card label={copy.milestones} trailing={<span className="tabular-nums">{copy.ofTotal(done, total)}</span>}>
          <div className="h-1.5 overflow-hidden rounded-full bg-(--ui-stroke-tertiary)">
            <div className="h-full rounded-full bg-(--ui-accent)" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {map.milestones.map(step => (
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs',
                  step.done
                    ? 'bg-(--chrome-action-hover) text-foreground'
                    : 'text-(--ui-text-tertiary) ring-1 ring-(--ui-stroke-tertiary) ring-inset'
                )}
                key={step.name}
              >
                {step.done && '✓ '}
                {step.name}
              </span>
            ))}
          </div>
        </Card>
      )}
      {map && map.decisions.length > 0 && (
        <Card label={copy.decisions}>
          <Rows rows={map.decisions.map(row => ({ meta: row.date, text: row.text, tone: 'done' }))} />
        </Card>
      )}
      {map && map.branches.length > 0 && (
        <Card label={copy.branches}>
          <Rows
            rows={map.branches.map(row => ({
              meta: copy.branchState[row.state],
              sub: row.note,
              text: row.name,
              tone:
                row.state === 'merged'
                  ? 'done'
                  : row.state === 'abandoned'
                    ? 'failed'
                    : row.state === 'active'
                      ? 'now'
                      : 'next'
            }))}
          />
        </Card>
      )}
      {map && map.parked.length > 0 && (
        <Card label={copy.parked}>
          <Rows rows={map.parked.map(text => ({ text, tone: 'talked' }))} />
        </Card>
      )}
      {map && map.failed.length > 0 && (
        <Card label={copy.failed}>
          <Rows rows={map.failed.map(text => ({ text, tone: 'failed' }))} />
        </Card>
      )}
    </div>
  )
}

function Rows({ rows }: { rows: { meta?: string; sub?: string; text: string; tone: NoteStatus }[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map(row => (
        <li className="grid grid-cols-[0.5rem_minmax(0,1fr)_auto] items-baseline gap-2 text-[0.8125rem]" key={row.text}>
          <Dot tone={row.tone} />
          <span className="min-w-0">
            <span className="text-foreground">{row.text}</span>
            {row.sub && <span className="block text-xs leading-snug text-(--ui-text-tertiary)">{row.sub}</span>}
          </span>
          {row.meta && <span className="text-[0.6875rem] whitespace-nowrap text-(--ui-text-tertiary)">{row.meta}</span>}
        </li>
      ))}
    </ul>
  )
}

const CATCH_UP_TONE: Record<CatchUpStatus, NoteStatus> = { done: 'done', next: 'next', now: 'now', waiting: 'talked' }

function CatchUpCard({ onClose, result }: { onClose: () => void; result: CatchUp }) {
  const { t } = useI18n()
  const copy = t.pro.board
  const away = useAgo(result.since)

  return (
    <section
      className="flex flex-col gap-2.5 rounded-xl p-3"
      data-slot="pro-catch-up"
      style={{
        background: 'color-mix(in oklab, var(--ui-accent) 10%, var(--ui-bg-quaternary, var(--chrome-action-hover)))'
      }}
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-[0.6875rem] font-medium tracking-wide text-(--ui-text-tertiary) uppercase">
          {copy.sinceAway(away ?? '')}
        </h3>
        <button
          aria-label={t.common.close}
          className="grid size-5 place-items-center rounded text-(--ui-text-tertiary) hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <Codicon name="close" size="0.75rem" />
        </button>
      </header>
      {result.summary && <p className="text-[0.8125rem] leading-relaxed text-foreground">{result.summary}</p>}
      <ul className="flex flex-col gap-2.5">
        {result.items.map(item => (
          <li className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5" key={item.title}>
            <Dot className="mt-1.5" tone={CATCH_UP_TONE[item.status]} />
            <span className="flex items-baseline justify-between gap-2 text-[0.8125rem] font-medium text-foreground">
              {item.title}
              <span className="text-[0.6875rem] font-normal whitespace-nowrap text-(--ui-text-tertiary)">
                {copy.catchUpStatus[item.status]}
              </span>
            </span>
            {item.detail && (
              <span className="col-start-2 text-xs leading-snug text-(--ui-text-secondary)">{item.detail}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function BoardTab() {
  const { t } = useI18n()
  const copy = t.pro.board
  const [view, setView] = useState<'chat' | 'project'>('chat')
  const [catchUpOpen, setCatchUpOpen] = useState(false)
  const path = useStore($currentCwd) ?? ''
  const { key } = useChatSource()
  const board = useStore($chatBoards)[key]
  const catchUp = useStore($catchUps)[path]
  const catchingUp = Boolean(useStore($boardWriting)[`catch:${path}`])
  const catchUpError = useStore($boardErrors)[`catch:${path}`]

  const startCatchUp = () => {
    setCatchUpOpen(true)
    void writeCatchUp(path, board)
  }

  let catchUpBody: ReactNode = null

  if (catchUpOpen) {
    catchUpBody = catchingUp ? (
      <Card label={copy.catchUp}>
        <p className="flex items-center gap-2 text-xs text-(--ui-text-secondary)">
          <Codicon name="loading" size="0.75rem" spinning />
          {copy.catchingUp}
        </p>
      </Card>
    ) : catchUp ? (
      <CatchUpCard onClose={() => setCatchUpOpen(false)} result={catchUp} />
    ) : catchUpError ? (
      <p className="text-xs text-(--ui-red,#f85149)">{catchUpError}</p>
    ) : null
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          onChange={value => setView(value as 'chat' | 'project')}
          options={[
            { label: copy.thisChat, value: 'chat' },
            { label: copy.project, value: 'project' }
          ]}
          value={view}
        />
        <Tip label={path ? copy.catchUpHint : copy.projectEmpty}>
          <button
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-(--ui-accent) transition-colors hover:bg-[color-mix(in_oklab,var(--ui-accent)_14%,transparent)] disabled:opacity-50"
            disabled={!path || catchingUp}
            onClick={startCatchUp}
            style={{ background: 'color-mix(in oklab, var(--ui-accent) 10%, transparent)' }}
            type="button"
          >
            <Codicon name="history" size="0.75rem" />
            {copy.catchUp}
          </button>
        </Tip>
      </div>
      {catchUpBody}
      {view === 'chat' ? <ChatView /> : <ProjectView boardWhere={board?.where ?? ''} />}
    </div>
  )
}
