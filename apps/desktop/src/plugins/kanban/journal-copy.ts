/** The Journal view's words (English, like the rest of the Kanban views). */
export const JOURNAL = {
  tab: 'Journal',
  title: 'Journal',
  subtitle: 'Every decision, report and conversation of this project, kept on this computer.',
  showFolder: 'Show folder',
  search: 'Search the journal…',
  filters: { all: 'All', decision: 'Decisions', report: 'Reports', conversation: 'Conversations' },
  types: { decision: 'Decision', report: 'Report', conversation: 'Conversation' },
  outcomes: {
    approved: 'Approved',
    changes_requested: 'Changes requested',
    answered: 'Answered',
    unblocked: 'Unblocked'
  },
  emptyTitle: 'Nothing in the journal yet',
  emptyBody: 'Decisions you take, finished reports and agent conversations are filed here as they happen.',
  noMatch: 'Nothing matches.',
  loadFailed: 'Could not load the journal.',
  by: (agent: string) => `by ${agent}`,
  weekOf: (day: string) => `Week of ${day}`,
  pick: 'Pick an entry on the left to read it.',
  summary: {
    weeks: 'Last 8 weeks',
    outcomes: 'How decisions went',
    byAgent: 'Most active',
    mostActive: 'Most active agent',
    noDecisions: 'No decisions yet.',
    approvedOf: (approved: number, total: number) => (total ? `${approved} of ${total} approved` : 'None yet'),
    reportsHint: 'Finished work, filed as reports',
    talksHint: 'Agent conversations kept',
    entries: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
    weekCounts: (counts: { conversation: number; decision: number; report: number }) =>
      `${counts.decision} decisions, ${counts.report} reports, ${counts.conversation} conversations`
  }
}
