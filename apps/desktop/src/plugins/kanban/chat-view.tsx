/**
 * Chat: talk with the team the way you talk with Hermes. "Team" is one room — ask anything and the agent it fits
 * answers (the one you @name, else the one whose role matches the question, else the lead). Each agent has a
 * direct line, and each task is its own conversation: the agent's updates and questions (its comments), what
 * happened to the task (quiet lines), and what you wrote back. A question becomes a small card for that agent;
 * its answer is the card's result, shown here as the agent's reply. A reply on a task goes to it as a comment,
 * which the agent reads before it carries on.
 */

import { Button, Codicon, useQueries, useQuery, useQueryClient, useValue } from '@hermes/plugin-sdk'
import { useEffect, useRef, useState } from 'react'

import {
  $boardSlug,
  $boardView,
  addComment,
  boardKeyPrefix,
  createTask,
  fetchProfiles,
  fetchTask,
  profilesKey,
  taskKey,
  useKanbanScope
} from './api'
import { CHAT } from './chat-copy'
import {
  answerCount as answerCountOf,
  answerLine,
  type ChatAgent,
  type ChatLine,
  feedLines,
  isAnswered,
  isEchoed,
  lastMessage,
  type Pending,
  pickAgent,
  questionTask,
  STALE_MS,
  teamFeed,
  threadLines,
  waitingPhase
} from './chat-model'
import { AUTO, Composer, lastText, Line, ListRow, SectionLabel, startsGroup, TaskLead, Waiting } from './chat-parts'
import { $inboxFocus } from './inbox-card'
import { columnMeta, type KanbanBoard, type KanbanTask } from './types'
import { Avatar, columnLabel, useKanban } from './ui'

const TEAM = '__team__'
const AGENT = 'agent:'
const ACTIVE = new Set(['blocked', 'review', 'running'])
const WAITING = new Set(['blocked', 'review'])
const MAX_THREADS = 30

/** The tasks that are conversations: any with comments, any being worked on or waiting on you, and questions. */
function conversationTasks(board: KanbanBoard, pinned: ReadonlySet<string>): KanbanTask[] {
  const rank = (task: KanbanTask) =>
    pinned.has(task.id) ? -1 : WAITING.has(task.status) ? 0 : task.status === 'running' ? 1 : 2

  return board.columns
    .flatMap(column => column.tasks)
    .filter(task => pinned.has(task.id) || (task.comment_count ?? 0) > 0 || ACTIVE.has(task.status))
    .sort((a, b) => rank(a) - rank(b) || (b.created_at ?? 0) - (a.created_at ?? 0))
    .slice(0, MAX_THREADS)
}

/** The team, from the profiles; the board's assignees while those load (or on a backend without them). */
function useAgents(board: KanbanBoard): ChatAgent[] {
  const scope = useKanbanScope()
  const { data } = useQuery({ queryFn: fetchProfiles, queryKey: profilesKey(scope), staleTime: 60_000 })

  return data?.profiles.length ? data.profiles : board.assignees.map(name => ({ name }))
}

/** Every task's lines: its comments and events, and its answer once it is done. */
function useThreads(tasks: KanbanTask[], fast: ReadonlySet<string>) {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  const details = useQueries({
    queries: tasks.map(task => ({
      queryFn: () => fetchTask(task.id),
      queryKey: taskKey(scope, slug, task.id),
      refetchInterval: fast.has(task.id) ? 3000 : 30_000
    }))
  })

  return new Map(
    tasks.map((task, index) => {
      const detail = details[index]?.data

      if (!detail) {
        return [task.id, [] as ChatLine[]]
      }

      const answer = answerLine(task.id, detail.task)
      const lines = threadLines(task.id, detail.comments ?? [], detail.events ?? [])

      return [task.id, answer ? [...lines, answer].sort((a, b) => a.at - b.at) : lines]
    })
  )
}

function Header({
  agent,
  onOpen,
  task
}: {
  agent: ChatAgent | null
  onOpen: (id: string) => void
  task: KanbanTask | null
}) {
  const k = useKanban()
  const name = task?.assignee ?? agent?.name

  return (
    <header className="flex shrink-0 items-center gap-2.5 px-5 pt-3 pb-2">
      {name ? (
        <Avatar name={name} size="1.75rem" />
      ) : (
        <span className="grid size-7 place-items-center rounded-full bg-(--ui-bg-tertiary) text-foreground">
          <Codicon name="organization" size="0.85rem" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[0.9375rem] font-semibold text-foreground">
          {task ? task.title : (agent?.display_name ?? agent?.name ?? CHAT.team)}
        </h2>
        <p className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">
          {task ? (
            <>
              {task.assignee ?? '—'} ·{' '}
              <span style={{ color: columnMeta(task.status).tone }}>{columnLabel(k, task.status)}</span>
            </>
          ) : (
            (agent?.title ?? CHAT.teamHint)
          )}
        </p>
      </div>
      {task && (
        <Button onClick={() => onOpen(task.id)} size="sm" variant="ghost">
          <Codicon name="link-external" size="0.8rem" />
          {CHAT.openTask}
        </Button>
      )}
    </header>
  )
}

function WaitingBanner({ task }: { task: KanbanTask }) {
  return (
    <div className="mx-auto mb-1 flex w-full max-w-3xl items-center gap-2.5 rounded-xl border border-[color-mix(in_srgb,#fbbf24_30%,transparent)] bg-[color-mix(in_srgb,#fbbf24_8%,transparent)] px-3 py-2 text-[0.8125rem] text-foreground">
      <Codicon className="text-[#fbbf24]" name="bell-dot" size="0.9rem" />
      <span className="flex-1">{CHAT.waiting}</span>
      <Button
        onClick={() => {
          $inboxFocus.set(task.id)
          $boardView.set('inbox')
        }}
        size="sm"
      >
        {CHAT.openInbox}
      </Button>
    </div>
  )
}

function Sidebar({
  agents,
  selected,
  setSelected,
  tasks,
  threads
}: {
  agents: ChatAgent[]
  selected: string
  setSelected: (id: string) => void
  tasks: KanbanTask[]
  threads: Map<string, ChatLine[]>
}) {
  const agentLines = (name: string) =>
    teamFeed(
      tasks.filter(task => task.assignee === name).map(task => threads.get(task.id) ?? []),
      50
    )

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-(--ui-stroke-tertiary) px-2 py-2.5">
      <ListRow
        active={selected === TEAM}
        lead={
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-(--ui-bg-tertiary) text-foreground">
            <Codicon name="organization" size="0.8rem" />
          </span>
        }
        name={CHAT.team}
        note={CHAT.teamHint}
        onSelect={() => setSelected(TEAM)}
      />
      {agents.length > 0 && <SectionLabel>{CHAT.agents}</SectionLabel>}
      {agents.map(agent => (
        <ListRow
          active={selected === AGENT + agent.name}
          key={agent.name}
          lead={<Avatar name={agent.name} size="1.5rem" />}
          name={agent.display_name || agent.name}
          note={lastText(lastMessage(agentLines(agent.name)), agent.title || agent.description || '')}
          onSelect={() => setSelected(AGENT + agent.name)}
        />
      ))}
      {tasks.length > 0 && <SectionLabel>{CHAT.conversations}</SectionLabel>}
      {tasks.map(task => (
        <ListRow
          active={selected === task.id}
          dot={WAITING.has(task.status)}
          key={task.id}
          lead={<TaskLead task={task} />}
          name={task.title || task.id}
          note={lastText(lastMessage(threads.get(task.id) ?? []), task.assignee ?? '—')}
          onSelect={() => setSelected(task.id)}
          testId={task.id}
        />
      ))}
    </aside>
  )
}

function Transcript({
  agents,
  lines,
  setSelected,
  showTitles,
  titles,
  waiting
}: {
  agents: ChatAgent[]
  lines: ChatLine[]
  setSelected: (id: string) => void
  showTitles: boolean
  titles: Map<string, string>
  waiting: { agent: string; id: string; text: string }[]
}) {
  const box = useRef<HTMLDivElement>(null)
  const roles = new Map(agents.map(agent => [agent.name, agent.title]))

  // New lines (and a waiting row) scroll into view, as a chat does: the container itself goes to its end, once
  // the new rows are laid out. A block body on purpose — an effect's return value is its cleanup.
  useEffect(() => {
    const element = box.current

    const toEnd = () => {
      if (element) {
        element.scrollTop = element.scrollHeight
      }
    }

    toEnd()
    // Once more after the browser has laid out the new rows (fonts, avatars): the first reading can be short.
    const frame = requestAnimationFrame(toEnd)

    return () => cancelAnimationFrame(frame)
  }, [lines.length, waiting.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-3" ref={box}>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-1.5">
        {lines.map((line, index) => {
          const head = startsGroup(line, lines[index - 1])

          return (
            <Line
              head={head}
              key={`${line.taskId}:${line.id}`}
              line={line}
              onThread={() => setSelected(line.taskId)}
              role={line.kind === 'message' ? roles.get(line.author) : undefined}
              title={showTitles && head ? titles.get(line.taskId) : undefined}
            />
          )
        })}
        {waiting.map(item => (
          <Waiting agent={item.agent} key={item.id} text={item.text} />
        ))}
      </div>
    </div>
  )
}

/** What the open conversation shows: one task, one agent's tasks, or the whole team. */
function scopeOf(selected: string, tasks: KanbanTask[], agents: ChatAgent[], threads: Map<string, ChatLine[]>) {
  const task = tasks.find(item => item.id === selected) ?? null
  const agentName = selected.startsWith(AGENT) ? selected.slice(AGENT.length) : null
  const agent = agents.find(item => item.name === agentName) ?? null

  if (task) {
    return { agent: null, lines: threads.get(task.id) ?? [], task }
  }

  const mine = agent ? tasks.filter(item => item.assignee === agent.name) : tasks

  return {
    agent,
    lines: feedLines(
      teamFeed(
        mine.map(item => threads.get(item.id) ?? []),
        200
      )
    ),
    task: null
  }
}

/** The phase text for a waiting task. */
const phaseText = (phase: ReturnType<typeof waitingPhase>, agent: string) => CHAT.phase[phase](agent)

export function BoardChat({ board, onOpen }: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const qc = useQueryClient()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const [pending, setPending] = useState<Pending[]>([])
  const pinned = new Set(pending.map(item => item.taskId))
  const tasks = conversationTasks(board, pinned)
  const agents = useAgents(board)
  const threads = useThreads(tasks, pinned)
  const [selected, setSelected] = useState(TEAM)
  const { agent, lines, task } = scopeOf(selected, tasks, agents, threads)
  const titles = new Map(tasks.map(item => [item.id, item.title || item.id]))
  const statuses = new Map(tasks.map(item => [item.id, item.status]))
  const now = Date.now()

  // What is still on its way: sent, not answered, not stale — and in view for this conversation.
  const open = pending.filter(item => now - item.at < STALE_MS && !isAnswered(item, threads.get(item.taskId) ?? []))

  const here = open.filter(item => (task ? item.taskId === task.id : agent ? item.agent === agent.name : true))

  // The owner's own message is painted at once, until the thread shows it.
  const painted: ChatLine[] = here
    .filter(item => !isEchoed(item, threads.get(item.taskId) ?? []))
    .map(item => ({
      at: Math.floor(item.at / 1000),
      author: 'you',
      body: item.text,
      id: `pending:${item.at}`,
      kind: 'message' as const,
      mine: true,
      taskId: item.taskId
    }))

  const waiting = here.map(item => ({
    agent: item.agent,
    id: `${item.taskId}:${item.at}`,
    text: phaseText(waitingPhase(statuses.get(item.taskId), now - item.at), item.agent)
  }))

  const shown = [...lines, ...painted]

  // While an answer is awaited, look again every few seconds (the board's own poll is slower) and forget what
  // has been answered or has gone stale. Block body: the cleanup is returned on purpose.
  const waitingOn = open.map(item => item.taskId).join(',')

  useEffect(() => {
    if (!waitingOn) {
      return
    }

    const timer = setInterval(() => {
      void qc.invalidateQueries({ queryKey: boardKeyPrefix(scope) })
      setPending(current => current.filter(item => Date.now() - item.at < STALE_MS))
    }, 3000)

    return () => clearInterval(timer)
  }, [qc, scope, waitingOn])

  const wait = (item: Pending) => setPending(current => [...current, item])

  const send = async (text: string, to: string) => {
    const sentAt = Date.now()

    if (task) {
      wait({
        agent: task.assignee ?? 'agent',
        at: sentAt,
        seen: answerCountOf(threads.get(task.id) ?? []),
        taskId: task.id,
        text
      })

      try {
        await addComment(task.id, text)
      } catch (error) {
        setPending(current => current.filter(item => item.at !== sentAt))
        throw error
      }

      void qc.invalidateQueries({ queryKey: taskKey(scope, slug, task.id) })

      return
    }

    const who = agent?.name ?? (to === AUTO ? pickAgent(text, agents)?.agent : to)

    if (!who) {
      throw new Error(CHAT.emptyTitle)
    }

    const { task: created } = await createTask(questionTask(text, who))

    if (created) {
      wait({ agent: who, at: sentAt, seen: 0, taskId: created.id, text })
      await addComment(created.id, text)
    }

    void qc.invalidateQueries({ queryKey: boardKeyPrefix(scope) })

    return CHAT.asked(who)
  }

  const empty = task ? CHAT.noMessages : agent ? CHAT.agentEmpty(agent.name) : CHAT.emptyBody

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden" data-kanban-chat="">
      <Sidebar agents={agents} selected={selected} setSelected={setSelected} tasks={tasks} threads={threads} />
      <section className="flex min-w-0 flex-1 flex-col">
        <Header agent={agent} onOpen={onOpen} task={task} />
        {task && WAITING.has(task.status) && (
          <div className="px-5">
            <WaitingBanner task={task} />
          </div>
        )}
        {shown.length ? (
          <Transcript
            agents={agents}
            lines={shown}
            setSelected={setSelected}
            showTitles={!task}
            titles={titles}
            waiting={waiting}
          />
        ) : (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div className="flex max-w-sm flex-col items-center gap-2">
              <span className="grid size-10 place-items-center rounded-full bg-(--ui-bg-tertiary) text-(--ui-text-tertiary)">
                <Codicon name="comment-discussion" size="1.1rem" />
              </span>
              <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{empty}</p>
            </div>
          </div>
        )}
        <div className="mx-auto w-full max-w-3xl shrink-0 px-5 pb-4">
          <Composer
            agents={agents.map(item => item.name)}
            key={selected}
            onSend={send}
            placeholder={
              task
                ? CHAT.placeholder
                : agent
                  ? CHAT.agentPlaceholder(agent.display_name || agent.name)
                  : CHAT.teamPlaceholder
            }
            route={text => pickAgent(text, agents)}
            team={!task && !agent}
          />
        </div>
      </section>
    </div>
  )
}
