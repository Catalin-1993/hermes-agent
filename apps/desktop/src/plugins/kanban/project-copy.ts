/** The Overview's project header and actions: their words (English, like the rest of the Kanban views). */
export const PROJECT = {
  label: 'Project',
  untitled: 'Untitled project',
  state: {
    done: 'Done',
    empty: 'No tasks yet',
    idle: 'Waiting',
    needs: 'Needs you',
    running: 'In progress'
  },
  tasksDone: (done: number, total: number) => `${done} of ${total} tasks done`,
  objective: 'Objective',
  noObjective: 'No objective yet',
  noObjectiveHint: 'Say what this project is for, and every task will be measured against it.',
  setObjective: 'Set the objective',
  viewGoals: 'All goals',
  tasksOfGoal: (done: number, total: number) => (total ? `${done} of ${total} tasks toward it` : 'No tasks linked yet'),
  actions: {
    title: 'Needs you',
    empty: 'Nothing is waiting on you.',
    emptyHint: 'When an agent needs a decision, it shows up here.',
    review: 'Review',
    inbox: 'Open Inbox',
    more: (n: number) => `${n} more in the Inbox`
  }
}
