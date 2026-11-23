/**
 * Brain (Pro Mode): the Board's data — written on demand by `llm.oneshot` (board-model.ts), kept on this device.
 *
 * - Chat boards are keyed by the stored session id; a board written from fewer messages than the chat now holds
 *   is stale and the panel rewrites it once the agent is idle.
 * - Project maps and catch-ups are keyed by the project folder. Their material is read-only git and the top of the
 *   changelog / readme, fetched through the gateway's `shell.exec` (which refuses dangerous commands and redacts
 *   secrets), so a remote gateway reads its own repository.
 * - "Last seen" per project is when the person last opened Catch me up; the next one starts from there.
 */

import { atom } from 'nanostores'

import { requestOneShot } from '@/lib/oneshot'
import { Codecs, persistentAtom } from '@/lib/persisted'
import { requestGatewayForActiveRoute } from '@/store/active-route-request'
import { $activeGatewayProfile } from '@/store/profile'

import {
  CATCH_UP_INSTRUCTIONS,
  type CatchUp,
  catchUpOf,
  CHAT_BOARD_INSTRUCTIONS,
  type ChatBoard,
  chatBoardOf,
  PROJECT_MAP_INSTRUCTIONS,
  type ProjectMap,
  projectMapOf,
  sectionsInput,
  shellQuote,
  transcriptInput
} from './board-model'

const record = <T>() =>
  Codecs.json<Record<string, T>>(value =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {}
  )

export const $chatBoards = persistentAtom<Record<string, ChatBoard>>('hermes.desktop.pro-board.chat.v1', {}, record())
export const $projectMaps = persistentAtom<Record<string, ProjectMap>>('hermes.desktop.pro-board.map.v1', {}, record())
export const $catchUps = persistentAtom<Record<string, CatchUp>>('hermes.desktop.pro-board.catch-up.v1', {}, record())
export const $lastSeen = persistentAtom<Record<string, number>>('hermes.desktop.pro-board.last-seen.v1', {}, record())

/** Keys being written right now (`chat:<id>`, `map:<path>`, `catch:<path>`), for the panel's spinners. */
export const $boardWriting = atom<Record<string, true>>({})
/** The last failure per key, shown under the view until the next try. */
export const $boardErrors = atom<Record<string, string>>({})

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

async function writing<T>(key: string, run: () => Promise<T>): Promise<T | undefined> {
  if ($boardWriting.get()[key]) {
    return undefined
  }

  $boardWriting.set({ ...$boardWriting.get(), [key]: true })
  const { [key]: _cleared, ...errors } = $boardErrors.get()
  $boardErrors.set(errors)

  try {
    return await run()
  } catch (error) {
    $boardErrors.set({ ...$boardErrors.get(), [key]: error instanceof Error ? error.message : String(error) })

    return undefined
  } finally {
    const { [key]: _done, ...rest } = $boardWriting.get()
    $boardWriting.set(rest)
  }
}

const ask = (instructions: string, input: string) =>
  requestOneShot({ input, instructions, maxTokens: 1400, sessionId: null, task: 'title_generation', temperature: 0.2 })

/** Read-only shell output from the gateway, '' when the command fails. */
async function shell(command: string): Promise<string> {
  const result = await requestGatewayForActiveRoute<{ code?: number; stdout?: string }>(
    $activeGatewayProfile.get(),
    'shell.exec',
    { command }
  )

  return result?.code === 0 ? (result.stdout ?? '') : ''
}

const git = (path: string, args: string) => shell(`git -C ${shellQuote(path)} ${args}`)

/** Write the board for one chat from its transcript tail and the agent's steps. */
export function writeChatBoard(
  sessionKey: string,
  messages: readonly { role: string; text: string }[],
  steps: readonly string[]
): Promise<ChatBoard | undefined> {
  return writing(`chat:${sessionKey}`, async () => {
    const board = chatBoardOf(await ask(CHAT_BOARD_INSTRUCTIONS, transcriptInput(messages, steps)), messages.length)

    if (!board) {
      throw new Error('The board came back unreadable — try again.')
    }

    $chatBoards.set({ ...$chatBoards.get(), [sessionKey]: board })

    return board
  })
}

async function projectMaterial(path: string, boardWhere: string) {
  const [log, branches, merged, changelog, readme] = await Promise.all([
    git(path, "log --date=short --pretty=format:'%ad %s' -n 60"),
    git(
      path,
      "for-each-ref --sort=-committerdate --format='%(refname:short) | %(committerdate:short) | %(upstream:track)' refs/heads"
    ),
    git(path, "branch --merged HEAD --format='%(refname:short)'"),
    shell(`head -c 3500 ${shellQuote(`${path}/CHANGELOG.md`)}`),
    shell(`head -c 2000 ${shellQuote(`${path}/README.md`)}`)
  ])

  return sectionsInput({
    'Recent commits (newest first)': log,
    'Branches (name | last commit | ahead/behind)': branches,
    'Branches already merged into the current one': merged,
    'Changelog (top)': changelog,
    Readme: readme,
    'Where the current chat stands': boardWhere
  })
}

/** Write the project map for the folder at `path`. */
export function writeProjectMap(path: string, boardWhere = ''): Promise<ProjectMap | undefined> {
  return writing(`map:${path}`, async () => {
    const material = await projectMaterial(path, boardWhere)

    if (!material.trim()) {
      throw new Error('This folder has no git history or changelog to map yet.')
    }

    const map = projectMapOf(await ask(PROJECT_MAP_INSTRUCTIONS, material))

    if (!map) {
      throw new Error('The map came back unreadable — try again.')
    }

    $projectMaps.set({ ...$projectMaps.get(), [path]: map })

    return map
  })
}

const mapDigest = (map: ProjectMap | undefined) =>
  map
    ? [
        map.idea,
        map.milestones.map(step => `${step.done ? '[x]' : '[ ]'} ${step.name}`).join('\n'),
        map.parked.length ? `Parked: ${map.parked.join('; ')}` : ''
      ].join('\n')
    : ''

const boardDigest = (board: ChatBoard | undefined) =>
  board
    ? [board.where, ...Object.entries(board.notes).map(([status, notes]) => `${status}: ${notes.join('; ')}`)].join(
        '\n'
      )
    : ''

/** What happened at `path` since the person last caught up (a week, the first time); then mark them caught up. */
export function writeCatchUp(path: string, board?: ChatBoard): Promise<CatchUp | undefined> {
  return writing(`catch:${path}`, async () => {
    const now = Date.now()
    const since = $lastSeen.get()[path] ?? now - WEEK_MS

    const commits = await git(
      path,
      `log --since=@${Math.floor(since / 1000)} --date=short --pretty=format:'%ad %s' -n 40`
    )

    const input = sectionsInput({
      'Away since': new Date(since).toISOString().slice(0, 16).replace('T', ' '),
      'Commits since then (newest first)': commits || '(none)',
      'This chat now': boardDigest(board),
      'Project map': mapDigest($projectMaps.get()[path])
    })

    const result = catchUpOf(await ask(CATCH_UP_INSTRUCTIONS, input), since, now)

    if (!result) {
      throw new Error('The catch-up came back unreadable — try again.')
    }

    $catchUps.set({ ...$catchUps.get(), [path]: result })
    $lastSeen.set({ ...$lastSeen.get(), [path]: now })

    return result
  })
}
