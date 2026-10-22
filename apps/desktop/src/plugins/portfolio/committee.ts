/**
 * The investment committee: instead of one agent answering, the chosen agent runs a small debate with
 * Hermes subagents (`delegate_task`) and judges it. Three roles argue in isolation first, so none is
 * swayed by the others; the two opposing ones then answer each other once; the agent who received the
 * request decides as the arbiter and writes down where they still disagree. Pure, so it is tested.
 */

/** Who answers a request: one agent, or the committee. */
export type Panel = 'committee' | 'one'

export const PANELS: Panel[] = ['one', 'committee']

/** What each role argues, in the words of the request at hand (an asset, a backtest, …). */
export interface CommitteeRoles {
  optimist: string
  risk: string
  skeptic: string
}

/** The working rules for a committee request: the two rounds, the arbiter, and the report's sections. */
export function committeeLines(roles: CommitteeRoles): string[] {
  return [
    'Cum lucrați: ca un comitet de investiții cu patru roluri, nu ca un singur agent.',
    '1. Runda întâi, separat: pornește trei subagenți cu delegate_task, într-un singur apel (în paralel). Dă-i fiecăruia toate datele de mai sus și doar rolul lui; nu le spune ce cred ceilalți.',
    `   - Optimistul: ${roles.optimist}`,
    `   - Scepticul: ${roles.skeptic}`,
    `   - Ofițerul de risc: ${roles.risk}`,
    '2. Runda a doua, replica: dă-i Optimistului rezumatul Scepticului și Scepticului rezumatul Optimistului (tot cu delegate_task, în paralel). Fiecare răspunde în cel mult cinci puncte: ce acceptă, ce contestă și de ce.',
    '3. Tu ești Arbitrul: cântărește argumentele după calitate și dovezi, nu după număr, ține cont de limitele Ofițerului de risc și decide verdictul.',
    '- Dacă nu poți porni subagenți, joacă tu rolurile pe rând, separat, și scrie asta în raport.',
    '- Raportul are, în ordine, secțiunile: Verdictul arbitrului, Optimistul, Scepticul, Ofițerul de risc, Replica, Unde nu au căzut de acord.'
  ]
}

/** The committee's report is marked in its header, so Research shows it as one. */
export const COMMITTEE_KIND = 'comitet'
