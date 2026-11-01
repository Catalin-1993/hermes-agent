/**
 * Chat: the project's room, the way a team chat reads. On the left the channel (#general: the whole team) and a
 * direct line to each agent. In the middle the Room notes (objective, recent decisions, what is open) and every
 * conversation as one message — a task's first message — with its replies underneath; a conversation that waits on
 * you carries its card (approve, send back, answer, unblock — the Inbox's own actions). A click opens the thread on
 * the right with every message and a reply box. Above the composer, who is working right now. Asking in the channel
 * routes the question to the agent it fits (the one you @name, else the one whose role matches, else the lead).
 */

import { cn, Codicon, useQueries, useQuery, useQueryClient, useValue } from '@hermes/plugin-sdk'
import { type ReactNode, useEffect, useRef, useState } from 'react'

import {
  $boardSlug,
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
import { AUTO, Composer, lastText, Line, ListRow, SectionLabel, startsGroup, Waiting } from './chat-parts'
import { ChannelHeader, RoomNotesCard, RootMessage, ThreadPanel, WorkingLine } from './chat-room'
import { approvalKind, threadRoots, workingNames, workingText } from './chat-room-model'
import { useDecide } from './inbox-writes'
import type { KanbanBoard, KanbanTask } from './types'
import { Avatar } from './ui'

const TEAM = '__team__'
const AGENT = 'agent:'
const ACTIVE = new Set(['blocked', 'review', 'running'])
const WAITING = new Set(['blocked', 'review'])
const ROOM_LIMIT = 200
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

  const waiting = (name?: string) => tasks.some(task => WAITING.has(task.status) && (!name || task.assignee === name))

  return (
    <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-(--ui-stroke-tertiary) px-2 py-2 md:flex">
      <SectionLabel>{CHAT.channels}</SectionLabel>
      <ListRow
        active={selected === TEAM}
        dot={waiting()}
        lead={
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-(--ui-bg-tertiary) text-[0.8125rem] font-semibold text-(--ui-text-secondary)">
            #
          </span>
        }
        name={CHAT.channel}
        note={CHAT.teamHint}
        onSelect={() => setSelected(TEAM)}
        testId="channel"
      />
      {agents.length > 0 && <SectionLabel>{CHAT.direct}</SectionLabel>}
      {agents.map(agent => (
        <ListRow
          active={selected === AGENT + agent.name}
          dot={waiting(agent.name)}
          key={agent.name}
          lead={<Avatar name={agent.name} size="1.5rem" />}
          name={agent.display_name || agent.name}
          note={lastText(lastMessage(agentLines(agent.name)), agent.title || agent.description || '')}
          onSelect={() => setSelected(AGENT + agent.name)}
        />
      ))}
    </aside>
  )
}

/** A thread's messages, scrolled to the newest, with a waiting row while an answer is on its way. */
function Transcript({
  agents,
  lines,
  waiting
}: {
  agents: ChatAgent[]
  lines: ChatLine[]
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3" ref={box}>
      <div className="flex w-full flex-1 flex-col gap-1.5">
        {lines.map((line, index) => {
          const head = startsGroup(line, lines[index - 1])

          return (
            <Line
              head={head}
              key={`${line.taskId}:${line.id}`}
              line={line}
              role={line.kind === 'message' ? roles.get(line.author) : undefined}
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

/** The phase text for a waiting task. */
const phaseText = (phase: ReturnType<typeof waitingPhase>, agent: string) => CHAT.phase[phase](agent)

/** A thread's head in the room: the task's root, with what the owner just sent painted in until it echoes — and a
 *  question not on the board yet (the board refreshes more slowly) standing as its own thread meanwhile. */
function useRoots(tasks: KanbanTask[], threads: Map<string, ChatLine[]>, pending: Pending[]) {
  const known = new Set(tasks.map(task => task.id))

  const fresh = pending
    .filter(item => !known.has(item.taskId))
    .map(item => ({
      at: Math.floor(item.at / 1000),
      author: 'you',
      body: item.text,
      lastAt: Math.floor(item.at / 1000),
      mine: true,
      participants: [],
      replies: 0,
      task: { assignee: item.agent, id: item.taskId, status: 'ready', title: item.text } as KanbanTask
    }))

  const roots = threadRoots(tasks, threads).map(root => {
    const sent = pending.find(item => item.taskId === root.task.id)

    return sent && !(threads.get(root.task.id) ?? []).some(line => line.kind === 'message')
      ? { ...root, author: 'you', body: sent.text, mine: true }
      : root
  })

  return [...roots, ...fresh]
}

/** The middle: the channel or direct line, its notes, every thread's first message, who is working, the composer. */
function Room({
  agent,
  agents,
  composer,
  hidden,
  onThread,
  roots,
  tasks,
  thread,
  working
}: {
  agent: ChatAgent | null
  agents: ChatAgent[]
  composer: ReactNode
  hidden: boolean
  onThread: (id: string) => void
  roots: ReturnType<typeof useRoots>
  tasks: KanbanTask[]
  thread: null | string
  working: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const roles = new Map(agents.map(item => [item.name, item.title]))
  const newest = `${roots.length}:${roots.at(-1)?.task.id ?? ''}:${roots.at(-1)?.lastAt ?? 0}`

  // The newest thread at the bottom is the one in view, as in any chat. Block body: an effect returns its cleanup.
  useEffect(() => {
    const element = box.current

    if (element) {
      element.scrollTop = element.scrollHeight
    }
  }, [newest])

  return (
    <section className={cn('min-w-0 flex-1 flex-col', hidden ? 'hidden xl:flex' : 'flex')}>
      {agent ? (
        <ChannelHeader agents={[agent]} name={agent.display_name || agent.name} prefix="@" />
      ) : (
        <ChannelHeader agents={agents} name={CHAT.channel} />
      )}
      {!agent && (
        <div className="@container mx-auto w-full max-w-3xl shrink-0 px-4 pt-3">
          <RoomNotesCard tasks={tasks} />
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3" ref={box}>
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-1">
          <div className="flex-1" />
          {roots.length ? (
            roots.map(root => (
              <RootMessage
                active={thread === root.task.id}
                key={root.task.id}
                onOpen={() => onThread(root.task.id)}
                role={roles.get(root.author)}
                root={root}
              />
            ))
          ) : (
            <div className="grid place-items-center py-10 text-center">
              <div className="flex max-w-sm flex-col items-center gap-2">
                <span className="grid size-10 place-items-center rounded-full bg-(--ui-bg-tertiary) text-(--ui-text-tertiary)">
                  <Codicon name="comment-discussion" size="1.1rem" />
                </span>
                <p className="text-[0.8125rem] text-(--ui-text-tertiary)">
                  {agent ? CHAT.agentEmpty(agent.name) : CHAT.emptyBody}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-1 pb-4">
        <WorkingLine text={working} />
        {composer}
      </div>
    </section>
  )
}

/** What the "is working" line says: a slow or waiting-on-you answer first, else everyone on a task right now. */
function workingLine(open: Pending[], statuses: Map<string, string>, scopeTasks: KanbanTask[], now: number) {
  const latest = open.at(-1)
  const phase = latest ? waitingPhase(statuses.get(latest.taskId), now - latest.at) : null

  if (latest && (phase === 'slow' || phase === 'you')) {
    return phaseText(phase, latest.agent)
  }

  return workingText([...open.map(item => item.agent), ...workingNames(scopeTasks)])
}

export function BoardChat({ board, onOpen }: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const qc = useQueryClient()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const decide = useDecide()
  const [pending, setPending] = useState<Pending[]>([])
  const pinned = new Set(pending.map(item => item.taskId))
  const tasks = conversationTasks(board, pinned)
  const agents = useAgents(board)
  const threads = useThreads(tasks, pinned)
  const [selected, setSelected] = useState(TEAM)
  const [threadId, setThreadId] = useState<null | string>(null)
  const agentName = selected.startsWith(AGENT) ? selected.slice(AGENT.length) : null
  const agent = agents.find(item => item.name === agentName) ?? null
  const scopeTasks = agent ? tasks.filter(item => item.assignee === agent.name) : tasks

  const roots = useRoots(
    scopeTasks,
    threads,
    pending.filter(item => !agent || item.agent === agent.name)
  ).slice(-ROOM_LIMIT)

  const thread = tasks.find(item => item.id === threadId) ?? null
  const statuses = new Map(tasks.map(item => [item.id, item.status]))
  const now = Date.now()

  // What is still on its way: sent, not answered, not stale.
  const open = pending.filter(item => now - item.at < STALE_MS && !isAnswered(item, threads.get(item.taskId) ?? []))
  const inRoom = open.filter(item => !agent || item.agent === agent.name)
  const inThread = open.filter(item => item.taskId === thread?.id)

  // In the thread, the owner's own reply is painted at once, until the thread shows it.
  const painted: ChatLine[] = inThread
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

  const waiting = inThread.map(item => ({
    agent: item.agent,
    id: `${item.taskId}:${item.at}`,
    text: phaseText(waitingPhase(statuses.get(item.taskId), now - item.at), item.agent)
  }))

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

  /** A reply in the open thread: an answer to its question resumes the card (the Inbox's answer), else a comment. */
  const reply = async (text: string) => {
    if (!thread) {
      return
    }

    const sentAt = Date.now()
    const agentOf = thread.assignee ?? 'agent'
    wait({ agent: agentOf, at: sentAt, seen: answerCountOf(threads.get(thread.id) ?? []), taskId: thread.id, text })

    try {
      if (approvalKind(thread) === 'question') {
        await decide.answer(thread.id, text)
      } else {
        await addComment(thread.id, text)
      }
    } catch (error) {
      setPending(current => current.filter(item => item.at !== sentAt))
      throw error
    }

    void qc.invalidateQueries({ queryKey: taskKey(scope, slug, thread.id) })
  }

  /** A new message in the room: a question card for the agent it fits (or the one this direct line is with). */
  const ask = async (text: string, to: string) => {
    const who = agent?.name ?? (to === AUTO ? pickAgent(text, agents)?.agent : to)

    if (!who) {
      throw new Error(CHAT.emptyTitle)
    }

    const { task: created } = await createTask(questionTask(text, who))

    if (created) {
      wait({ agent: who, at: Date.now(), seen: 0, taskId: created.id, text })
      await addComment(created.id, text)
    }

    void qc.invalidateQueries({ queryKey: boardKeyPrefix(scope) })

    return CHAT.asked(who)
  }

  const pick = (id: string) => {
    setSelected(id)
    setThreadId(null)
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden" data-kanban-chat="">
      <Sidebar agents={agents} selected={selected} setSelected={pick} tasks={tasks} threads={threads} />
      <Room
        agent={agent}
        agents={agents}
        composer={
          <Composer
            agents={agents.map(item => item.name)}
            key={selected}
            onSend={ask}
            placeholder={agent ? CHAT.agentPlaceholder(agent.display_name || agent.name) : CHAT.teamPlaceholder}
            route={text => pickAgent(text, agents)}
            team={!agent}
          />
        }
        hidden={Boolean(thread)}
        onThread={setThreadId}
        roots={roots}
        tasks={tasks}
        thread={threadId}
        working={workingLine(inRoom, statuses, scopeTasks, now)}
      />
      {thread && (
        <ThreadPanel
          composer={
            <Composer
              agents={[]}
              key={thread.id}
              onSend={async text => reply(text)}
              placeholder={approvalKind(thread) === 'question' ? CHAT.answerPlaceholder : CHAT.threadPlaceholder}
              route={() => null}
              team={false}
            />
          }
          onClose={() => setThreadId(null)}
          onOpenTask={() => onOpen(thread.id)}
          task={thread}
        >
          <Transcript agents={agents} lines={[...(threads.get(thread.id) ?? []), ...painted]} waiting={waiting} />
        </ThreadPanel>
      )}
    </div>
  )
}
