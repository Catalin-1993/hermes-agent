/** The Inbox's plain-language guidance: what to do with each kind of card, and what each choice does. English. */
export const INBOX = {
  startHere: 'Start here',
  budgetTitle: (agent: string) => `${agent} has used up its monthly budget`,
  whatToDo: 'What to do',
  decision: 'Your decision',
  hint: {
    question: 'Read the question, type your answer, then press “Send answer”.',
    review: 'Read the report, then approve it or ask for changes.',
    blocked: 'Find out why it is stuck. When it is sorted, press “Continue”.',
    budget: 'Set a higher monthly limit so the agent can keep working.',
    watch: 'Have a look. The button below does the suggested next step.',
    problem: 'Open the task to see what went wrong and how to fix it.'
  },
  block: {
    ask: 'What it is asking',
    why: 'Why it needs you',
    report: 'Its report',
    files: 'Attached files'
  },
  readReport: 'Read the full report',
  hideReport: 'Show less',
  choice: {
    approve: 'The task is marked Done.',
    changes: 'Your note goes back to the agent, which tries again.',
    answer: 'The agent gets your answer and picks the task up again.',
    unblock: 'The task goes back to Ready and the agent tries again.',
    agentSays: (text: string) => `The agent says: ${text}`
  },
  reason: { label: 'Your reason', placeholder: 'Why? (optional, saved in the project journal)' }
}
