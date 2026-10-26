/** What a decision card says about itself: what is asked, why it needs the owner, and what each button does
 *  (those lines describe what the app really does, so they hold whatever the agent wrote). English. */
export const DECISION = {
  ask: 'What the agent asks',
  why: 'Why you are needed',
  report: 'Report',
  agentSays: 'Agent says',
  files: 'Files',
  ifApprove: 'If you approve',
  ifChanges: 'If you request changes',
  ifAnswer: 'If you answer',
  ifUnblock: 'If you unblock',
  noAsk: {
    blocked: 'The agent is stuck and cannot continue on its own.',
    question: 'Answer the question so the agent can continue.',
    review: 'Check the result and decide whether it is good to go.'
  },
  noWhy: {
    blocked: (kind: null | string | undefined) => (kind ? `The agent is blocked (${kind}).` : 'The agent is blocked.'),
    question: 'The agent needs information only you have.',
    review: 'The agent finished and sent the result for your review.',
    heldBy: (rule: string) => `The rule “${rule}” holds this card for you.`
  },
  effect: {
    approve: 'The task moves to Done.',
    changes: 'Your comment goes to the agent and the task goes back to Ready.',
    answer: 'Your answer is saved as a comment and the task goes back to Ready, so the agent continues.',
    unblock: 'The task goes back to Ready and the agent tries again.'
  },
  file: {
    download: 'Download',
    show: 'Show in folder',
    pdf: 'PDF'
  }
}
