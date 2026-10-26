/** The Org chart's hierarchy words (English). */
export const ORG = {
  ceo: {
    name: 'You',
    level: 'CEO',
    waiting: (n: number) =>
      n === 0 ? 'Nothing waiting on you' : n === 1 ? '1 decision waiting' : `${n} decisions waiting`
  },
  level: { lead: 'Project Lead', team: 'Team Lead', executor: 'Executor' },
  workingOn: 'Working on',
  lastFinished: 'Last finished',
  nothingRunning: 'Not running anything',
  nothingYet: 'Nothing finished yet'
}
