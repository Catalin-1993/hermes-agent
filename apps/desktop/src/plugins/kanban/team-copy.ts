/** The merged Agents page's words: the team on one page (English). */
export const TEAM = {
  agents: (n: number) => (n === 1 ? '1 agent' : `${n} agents`),
  working: (n: number) => `${n} working`,
  paused: (n: number) => `${n} paused`,
  spent: (amount: string) => `${amount} spent this month`,
  view: { label: 'View', chart: 'Hierarchy', list: 'Cards' },
  detail: { show: 'Show details on cards (load, runs, budget)', hide: 'Hide details on cards' },
  zoom: {
    fit: 'Fit the whole team on screen',
    fitting: 'Fitted to the screen — Ctrl/⌘ + mouse wheel zooms',
    fitShort: 'Fit',
    in: 'Zoom in',
    out: 'Zoom out'
  },
  menu: {
    more: 'More',
    open: 'Open agent file',
    moveHeading: 'Reports to',
    top: 'Nobody (top of the team)',
    none: 'No other agent can be its manager'
  },
  noTitle: 'No title yet',
  workingOn: 'Working on',
  lastFinished: 'Last finished',
  nothingRunning: 'Not running anything',
  nothingYet: 'Nothing finished yet',
  hint: 'Drag a card onto another one to change who it reports to, or use ⋯ on a card.',
  loose: {
    title: 'Not placed yet',
    hint: 'These agents have no manager and nobody under them. Drag one onto a manager, or use ⋯.'
  }
}
