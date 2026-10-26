/** The Brain Dashboard and Projects pages' words (English, like the rest of the Kanban views). */
export const BRAIN = {
  dashboard: {
    nav: 'Dashboard',
    open: 'Dashboard: open',
    title: 'Dashboard',
    summary: {
      activeProjects: 'Active projects',
      activeProjectsHint: (total: number) => `of ${total} in all`,
      agents: 'Agents at work',
      agentsHint: 'running a task right now',
      inProgress: 'Tasks in progress',
      inProgressHint: 'running on agents',
      attention: 'Needs your attention',
      attentionHint: 'blocked or waiting for review',
      finished: 'Finished runs · 14 days',
      finishedHint: (failed: number, rate: null | number) =>
        `${failed} failed${rate === null ? '' : ` · ${rate}% success`}`,
      unavailable: 'not available'
    },
    attention: { empty: 'Nothing is waiting on you.', title: 'Needs Your Attention' },
    projects: { empty: 'No projects yet.', title: 'Projects Overview' },
    agents: { empty: 'No agent is running a task right now.', title: 'Agents at Work' },
    recent: { empty: 'No activity yet.', title: 'Recent Activity' },
    loadFailed: 'Could not load the projects.'
  },
  projects: {
    nav: 'Projects',
    open: 'Projects: open',
    title: 'Projects',
    newProject: 'New Project',
    empty: 'No projects yet. Create the first one.',
    back: 'All projects',
    tasks: (n: number) => (n === 1 ? '1 task' : `${n} tasks`),
    done: (n: number) => `${n} done`,
    running: (n: number) => `${n} running`,
    needs: (n: number) => `${n} need you`,
    state: {
      blocked: 'Blocked',
      done: 'Done',
      empty: 'No tasks yet',
      idle: 'Waiting',
      running: 'In progress'
    },
    overview: {
      state: 'Current state',
      objective: 'Objective',
      noObjective: 'No objective set yet.',
      setObjective: 'Set one in Goals',
      progress: 'Progress',
      recent: 'Recent activity',
      inProgress: 'Tasks in progress',
      inProgressEmpty: 'No task is running.',
      attention: 'Needs your attention',
      access: 'Open in Kanban',
      goalProgress: (percent: number) => `${percent}% of the objective`
    },
    access: {
      board: 'Board',
      inbox: 'Inbox',
      agents: 'Agents',
      org: 'Org chart',
      goals: 'Goals',
      rules: 'Rules'
    }
  },
  settings: {
    title: 'Brain workspace',
    description: 'Turning a page off only hides it from the sidebar. Its data and the agents keep working as before.',
    dashboard: 'Dashboard',
    dashboardHint: 'The global view of projects, agents and what needs you.',
    projects: 'Projects',
    projectsHint: 'The list of projects and the Overview of each.'
  }
}
