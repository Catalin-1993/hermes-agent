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
  answerLine,
  type ChatAgent,
  type ChatLine,
  feedLines,
  lastMessage,
  pickAgent,
  questionTask,
  teamFeed,
  threadLines
} from './chat-model'
import { AUTO, Composer, lastText, Line, ListRow, SectionLabel, startsGroup, TaskLead } from './chat-parts'
import { $inboxFocus } from './inbox-card'
import { columnMeta, type KanbanBoard, type KanbanTask } from './types'
import { Avatar, columnLabel, useKanban } from './ui'

const TEAM = '__team__'
const AGENT = 'agent:'
const ACTIVE = new Set(['blocked', 'review', 'running'])
const WAITING = new Set(['blocked', 'review'])
const MAX_THREADS = 30

/** The tasks that are conversations: any with comments, any being worked on or waiting on you, and questions. */
function conversationTasks(board: KanbanBoard): KanbanTask[] {
  const rank = (task: KanbanTask) => (WAITING.has(task.status) ? 0 : task.status === 'running' ? 1 : 2)

  return board.columns
    .flatMap(column => column.tasks)
    .filter(task => (task.comment_count ?? 0) > 0 || ACTIVE.has(task.status))
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
function useThreads(tasks: KanbanTask[]) {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  const details = useQueries({
    queries: tasks.map(task => ({
      queryFn: () => fetchTask(task.id),
      queryKey: taskKey(scope, slug, task.id),
      refetchInterval: 30_000
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
  titles
}: {
  agents: ChatAgent[]
  lines: ChatLine[]
  setSelected: (id: string) => void
  showTitles: boolean
  titles: Map<string, string>
}) {
  const bottom = useRef<HTMLDivElement>(null)
  const roles = new Map(agents.map(agent => [agent.name, agent.title]))

  // New lines scroll into view, as a chat does.
  useEffect(() => bottom.current?.scrollIntoView?.({ block: 'end' }), [lines.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-3">
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
        <div ref={bottom} />
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

export function BoardChat({ board, onOpen }: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const qc = useQueryClient()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const tasks = conversationTasks(board)
  const agents = useAgents(board)
  const threads = useThreads(tasks)
  const [selected, setSelected] = useState(TEAM)
  const { agent, lines, task } = scopeOf(selected, tasks, agents, threads)
  const titles = new Map(tasks.map(item => [item.id, item.title || item.id]))

  const send = async (text: string, to: string) => {
    if (task) {
      await addComment(task.id, text)
      void qc.invalidateQueries({ queryKey: taskKey(scope, slug, task.id) })

      return
    }

    const who = agent?.name ?? (to === AUTO ? pickAgent(text, agents)?.agent : to)

    if (!who) {
      throw new Error(CHAT.emptyTitle)
    }

    const { task: created } = await createTask(questionTask(text, who))

    if (created) {
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
        {lines.length ? (
          <Transcript agents={agents} lines={lines} setSelected={setSelected} showTitles={!task} titles={titles} />
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
