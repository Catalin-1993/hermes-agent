/**
 * What settling a decision writes, shared by the Inbox and the Chat's inline cards so both do exactly the same:
 * answer an agent's question (comment + back to Ready), approve a review (Done), send it back with a comment, or
 * unblock a card — each said in a toast, filed in the project's journal, and followed by a refresh.
 */

import { host, useQueryClient, useValue } from '@hermes/plugin-sdk'

import { $boardSlug, activityKey, addComment, boardKeyPrefix, controlsKey, patchTask, useKanbanScope } from './api'
import { journalDecision } from './journal-record'
import { errText, useKanban } from './ui'

/** Run a write, say it worked (or why not), and refresh what it changed. True when it landed. */
export function useSettle() {
  const qc = useQueryClient()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  return async (write: () => Promise<unknown>, done: string) => {
    try {
      await write()
      host.notify({ kind: 'success', message: done })
    } catch (error) {
      host.notify({ kind: 'error', message: errText(error) })

      return false
    } finally {
      void qc.invalidateQueries({ queryKey: boardKeyPrefix(scope) })
      void qc.invalidateQueries({ queryKey: controlsKey(scope, slug) })
      void qc.invalidateQueries({ queryKey: activityKey(scope, slug) })
    }

    return true
  }
}

/** The four decisions on a card. Each resolves true when it landed (and was filed in the journal). */
export function useDecide() {
  const k = useKanban()
  const settle = useSettle()

  const decide = async (
    id: string,
    write: () => Promise<unknown>,
    done: string,
    outcome: Parameters<typeof journalDecision>[1],
    why: string
  ) => {
    const ok = await settle(write, done)

    if (ok) {
      await journalDecision(id, outcome, why)
    }

    return ok
  }

  return {
    answer: (id: string, text: string) =>
      decide(
        id,
        async () => {
          await addComment(id, text.trim())
          await patchTask(id, { status: 'ready' })
        },
        k.inbox.done.answered,
        'answered',
        text
      ),
    approve: (id: string, reason: string) =>
      decide(id, () => patchTask(id, { status: 'done' }), k.inbox.done.approved, 'approved', reason),
    sendBack: (id: string, text: string) =>
      decide(
        id,
        async () => {
          await addComment(id, text.trim())
          await patchTask(id, { status: 'ready' })
        },
        k.inbox.done.sentBack,
        'changes_requested',
        text
      ),
    unblock: (id: string, reason: string) =>
      decide(id, () => patchTask(id, { status: 'ready' }), k.inbox.done.unblocked, 'unblocked', reason)
  }
}
