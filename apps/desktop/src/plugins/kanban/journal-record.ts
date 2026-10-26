/** Filing a decision in the project's journal right after the owner acts on a card. The action itself already
 *  happened; a journal failure is told, not undone. */

import { host, queryClient } from '@hermes/plugin-sdk'

import { recordDecision } from './api'
import { errText } from './ui'

export type DecisionOutcome = 'answered' | 'approved' | 'changes_requested' | 'unblocked'

export async function journalDecision(taskId: string, outcome: DecisionOutcome, reason: string): Promise<void> {
  try {
    await recordDecision(taskId, outcome, reason.trim())
    void queryClient.invalidateQueries({ queryKey: ['kanban', 'journal'] })
  } catch (error) {
    host.notify({ kind: 'warning', message: `Done, but not saved in the journal: ${errText(error)}` })
  }
}
