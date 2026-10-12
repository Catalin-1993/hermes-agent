export type LibraryTemplateId =
  'blank' | 'decision' | 'journal' | 'meeting' | 'okr' | 'project' | 'spec' | 'thesis' | 'todo'

export interface LibraryTemplate {
  /** The page's own icon once made, as in Notion. */
  emoji?: string
  /** The card's glyph (codicon). */
  icon: string
  id: LibraryTemplateId
  /** Accent for the card glyph, as a token-derived colour. */
  tint: string
  /** Page body in markdown; the editor imports it on first open. */
  markdown: () => string
}

const dateOf = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

const weekday = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString(undefined, { weekday: 'long' })

const lines = (...parts: string[]) => parts.join('\n\n')

const meeting = () =>
  lines(
    `**Date:** ${dateOf()}  ·  **Time:** 10:00 – 10:45  ·  **Location:** Video call`,
    '**Facilitator:** @  ·  **Note-taker:** @',
    '> **Objective** — what must be true when this meeting ends? Write it as one sentence.',
    '## Attendees',
    '| Name | Role | Present |\n| --- | --- | --- |\n|  | Decision maker | ✓ |\n|  | Contributor | ✓ |\n|  | Optional |  |',
    '## Agenda',
    '| # | Topic | Owner | Time | Outcome wanted |\n| --- | --- | --- | --- | --- |\n| 1 | Updates since last meeting |  | 5 min | Inform |\n| 2 | Main topic |  | 20 min | Decide |\n| 3 | Risks and blockers |  | 10 min | Unblock |\n| 4 | Next steps |  | 5 min | Agree |',
    '## Pre-read',
    '- Links to documents everyone should read beforehand',
    '## Discussion',
    '### 1. Updates',
    '- ',
    '### 2. Main topic',
    '- Options considered:\n- Arguments for and against:',
    '### 3. Risks and blockers',
    '- ',
    '## Decisions',
    '| Decision | Rationale | Decided by |\n| --- | --- | --- |\n|  |  |  |',
    '## Action items',
    '- [ ] **Owner** — task — due \n- [ ] **Owner** — task — due \n- [ ] **Owner** — task — due ',
    '## Parking lot',
    '- Topics raised but deferred to a later meeting',
    '---',
    `**Next meeting:** ${dateOf(7)}  ·  **Send notes to:** all attendees within 24 hours`
  )

const todo = () =>
  lines(
    '> **Focus this week** — the one result that would make this week a success.',
    '## Top 3 priorities',
    '- [ ] **Must** — \n- [ ] **Should** — \n- [ ] **Could** — ',
    '## Today',
    '- [ ] Deep work block (90 min): \n- [ ] \n- [ ] \n- [ ] Inbox to zero',
    '## This week',
    ...[1, 2, 3, 4].flatMap(day => [`### ${weekday(day)}`, '- [ ] \n- [ ] ']),
    '## Waiting on',
    '| Item | From | Asked on | Follow up |\n| --- | --- | --- | --- |\n|  |  |  |  |',
    '## Someday / maybe',
    '- ',
    '## Done',
    '- [x] Set up this list'
  )

const project = () =>
  lines(
    '| Status | Owner | Start | Target launch | Priority |\n| --- | --- | --- | --- | --- |\n| 🟡 Planning | @ | ' +
      dateOf() +
      ' | ' +
      dateOf(60) +
      ' | High |',
    '> **In one sentence** — what we are building, for whom, and why now.',
    '## Problem',
    'What is broken or missing today? Who feels it, how often, and what does it cost them? Add evidence: data, quotes, tickets.',
    '## Goals',
    '1. \n2. \n3. ',
    '## Non-goals',
    '- What we are deliberately not doing in this phase, so scope stays honest.',
    '## Success metrics',
    '| Metric | Baseline | Target | How we measure |\n| --- | --- | --- | --- |\n| Primary |  |  |  |\n| Secondary |  |  |  |\n| Guardrail |  |  |  |',
    '## Scope',
    '### In scope\n\n- \n\n### Out of scope\n\n- ',
    '## Stakeholders',
    '| Person | Role | Responsible | Accountable | Consulted | Informed |\n| --- | --- | --- | --- | --- | --- |\n|  | Project lead | ✓ | ✓ |  |  |\n|  | Engineering | ✓ |  |  |  |\n|  | Design |  |  | ✓ |  |\n|  | Leadership |  |  |  | ✓ |',
    '## Timeline',
    '| Milestone | Deliverable | Owner | Date | Status |\n| --- | --- | --- | --- | --- |\n| Kick-off | Brief approved |  | ' +
      dateOf(3) +
      ' | ⚪ |\n| Design | Prototype reviewed |  | ' +
      dateOf(17) +
      ' | ⚪ |\n| Build | Feature complete |  | ' +
      dateOf(45) +
      ' | ⚪ |\n| Launch | Released to users |  | ' +
      dateOf(60) +
      ' | ⚪ |',
    '## Risks',
    '| Risk | Likelihood | Impact | Mitigation | Owner |\n| --- | --- | --- | --- | --- |\n|  | Medium | High |  |  |\n|  | Low | Medium |  |  |',
    '## Budget & resources',
    '- People:\n- Tools and services:\n- Estimated cost:',
    '## Open questions',
    '- [ ] \n- [ ] ',
    '## Links',
    '- Designs:\n- Tracking board:\n- Related documents:'
  )

const journal = () =>
  lines(
    `**${weekday(0)}, ${dateOf()}**`,
    '| Mood | Energy | Sleep | Focus |\n| --- | --- | --- | --- |\n| 🙂 | ⚡⚡⚡ | 7 h | ★★★ |',
    '## Morning',
    '> **Today’s intention** — how do I want to show up today?',
    '**Grateful for**',
    '1. \n2. \n3. ',
    '**Top 3 for today**',
    '- [ ] \n- [ ] \n- [ ] ',
    '## Schedule',
    '| Time | Plan |\n| --- | --- |\n| 08:00 |  |\n| 10:00 |  |\n| 12:00 |  |\n| 14:00 |  |\n| 16:00 |  |\n| 18:00 |  |',
    '## Notes & ideas',
    '- ',
    '## Habits',
    '- [ ] Exercise\n- [ ] Read 20 pages\n- [ ] Two litres of water\n- [ ] No screens after 22:00',
    '## Evening review',
    '**What went well?**\n\n**What could have gone better?**\n\n**What did I learn?**\n\n**Tomorrow’s first task:**'
  )

const spec = () =>
  lines(
    '| Status | Author | Reviewers | Last updated | Version |\n| --- | --- | --- | --- | --- |\n| 📝 Draft | @ | @ | ' +
      dateOf() +
      ' | 0.1 |',
    '> **TL;DR** — the problem, the proposed solution and the expected impact, in three sentences.',
    '## Background',
    'Why this matters now: market context, customer feedback, strategic fit. Link the research.',
    '## Problem statement',
    '**Who** is affected, **what** they are trying to do, and **why** they cannot today.',
    '## Users & personas',
    '| Persona | Need | Current workaround | Frequency |\n| --- | --- | --- | --- |\n| Primary |  |  | Daily |\n| Secondary |  |  | Weekly |',
    '## User stories',
    '| ID | As a… | I want to… | So that… | Priority |\n| --- | --- | --- | --- | --- |\n| US-1 |  |  |  | P0 |\n| US-2 |  |  |  | P1 |\n| US-3 |  |  |  | P2 |',
    '## Requirements',
    '### Functional',
    '- [ ] \n- [ ] \n- [ ] ',
    '### Non-functional',
    '- [ ] **Performance** — \n- [ ] **Security & privacy** — \n- [ ] **Accessibility** — \n- [ ] **Localization** — ',
    '## User experience',
    '- Key flows and screens (link designs)\n- Empty, loading and error states\n- Edge cases',
    '## Success metrics',
    '| Metric | Type | Target | Measured by |\n| --- | --- | --- | --- |\n|  | Adoption |  |  |\n|  | Engagement |  |  |\n|  | Quality |  |  |',
    '## Launch plan',
    '| Phase | Audience | Date | Exit criteria |\n| --- | --- | --- | --- |\n| Internal | Team |  |  |\n| Beta | 10% of users |  |  |\n| General availability | Everyone |  |  |',
    '## Dependencies & risks',
    '- ',
    '## Open questions',
    '| Question | Owner | Answer |\n| --- | --- | --- |\n|  |  |  |',
    '## FAQ',
    '**Why not build X instead?**\n\n**What happens to existing users?**'
  )

const decision = () =>
  lines(
    '| Status | Decider | Date | Reversible? |\n| --- | --- | --- | --- |\n| 🟡 Proposed | @ | ' +
      dateOf() +
      ' | Yes / No |',
    '> **The question** — what exactly are we deciding? Phrase it so the answer is one of the options.',
    '## Context',
    'What is happening that forces a decision? Constraints, deadlines and what we already know.',
    '## Decision criteria',
    '| Criterion | Weight |\n| --- | --- |\n| Cost | 25% |\n| Time to deliver | 25% |\n| Risk | 25% |\n| Long-term fit | 25% |',
    '## Options',
    '### Option A — \n\n**Pros:** \n\n**Cons:** ',
    '### Option B — \n\n**Pros:** \n\n**Cons:** ',
    '### Option C — do nothing\n\n**Pros:** \n\n**Cons:** ',
    '## Comparison',
    '| Criterion | Option A | Option B | Option C |\n| --- | --- | --- | --- |\n| Cost |  |  |  |\n| Time to deliver |  |  |  |\n| Risk |  |  |  |\n| Long-term fit |  |  |  |\n| **Score** |  |  |  |',
    '## Decision',
    '**We will…**',
    '## Rationale',
    'Why this option wins against the criteria, and what we are knowingly giving up.',
    '## Consequences',
    '- **Positive:** \n- **Negative:** \n- **Follow-up work:** ',
    '## Review',
    `- [ ] Revisit on ${dateOf(90)}: did the decision deliver what we expected?`
  )

const okr = () =>
  lines(
    '| Period | Owner | Confidence | Last check-in |\n| --- | --- | --- | --- |\n| This quarter | @ | 🟢 On track | ' +
      dateOf() +
      ' |',
    '> **Why these goals** — the one theme that ties this quarter together.',
    ...[1, 2, 3].flatMap(n => [
      `## Objective ${n} — `,
      'An ambitious, qualitative outcome. Why it matters:',
      '| Key result | Start | Target | Current | Progress |\n| --- | --- | --- | --- | --- |\n| KR ' +
        n +
        '.1 — | 0 |  |  | 0% |\n| KR ' +
        n +
        '.2 — | 0 |  |  | 0% |\n| KR ' +
        n +
        '.3 — | 0 |  |  | 0% |',
      '**Initiatives**\n\n- [ ] \n- [ ] '
    ]),
    '## Check-ins',
    '| Week | Overall | Highlights | Risks | Next focus |\n| --- | --- | --- | --- | --- |\n| 1 | 🟢 |  |  |  |\n| 4 |  |  |  |  |\n| 8 |  |  |  |  |\n| 12 |  |  |  |  |',
    '## End-of-quarter review',
    '**Score per objective (0–1.0):**\n\n**What worked:**\n\n**What we will change next quarter:**'
  )

const thesis = () =>
  lines(
    '| Asset | Ticker | Position | Entry date | Horizon | Conviction |\n| --- | --- | --- | --- | --- | --- |\n|  |  | Watchlist | ' +
      dateOf() +
      ' | 12–24 months | ★★★☆☆ |',
    '> **The thesis in one sentence** — why this is mispriced, and what the market is missing.',
    '## Business overview',
    'What the company does, how it makes money, and its main segments.',
    '| Segment | Revenue share | Growth | Margin |\n| --- | --- | --- | --- |\n|  |  |  |  |\n|  |  |  |  |',
    '## Investment thesis',
    '1. **Pillar one** — \n2. **Pillar two** — \n3. **Pillar three** — ',
    '## Competitive position',
    '- Moat (brand, scale, network effects, switching costs, IP):\n- Main competitors and how they compare:',
    '## Catalysts',
    '| Catalyst | Expected timing | Impact | Status |\n| --- | --- | --- | --- |\n| Earnings report |  | High | ⚪ |\n| Product launch |  | Medium | ⚪ |\n| Regulatory / macro |  | Medium | ⚪ |',
    '## Valuation',
    '| Scenario | Revenue | Multiple | Fair value | Upside |\n| --- | --- | --- | --- | --- |\n| 🐻 Bear |  |  |  |  |\n| 📊 Base |  |  |  |  |\n| 🐂 Bull |  |  |  |  |',
    '**Key metrics:** P/E · EV/EBITDA · free-cash-flow yield · revenue growth · gross margin',
    '## Risks',
    '| Risk | Probability | Impact | What would tell me I am wrong |\n| --- | --- | --- | --- |\n|  | Medium | High |  |\n|  | Low | High |  |',
    '## Position plan',
    '- **Entry:** \n- **Size:** % of portfolio\n- **Add if:** \n- **Trim if:** \n- **Exit / stop:** ',
    '## Sources',
    '- Annual report and latest filings\n- Earnings call transcript\n- Industry research',
    '## Review log',
    '| Date | Price | What changed | Thesis intact? |\n| --- | --- | --- | --- |\n| ' +
      dateOf() +
      ' |  | Initial write-up | ✓ |',
    '---',
    '_Personal research notes, not financial advice._'
  )

/** The templates the Library starts pages from, in the order they are offered. */
export const LIBRARY_TEMPLATES: readonly LibraryTemplate[] = [
  { icon: 'note', id: 'blank', markdown: () => '', tint: 'var(--ui-text-secondary)' },
  { emoji: '🗓️', icon: 'comment-discussion', id: 'meeting', markdown: meeting, tint: 'var(--ui-accent)' },
  { emoji: '✅', icon: 'checklist', id: 'todo', markdown: todo, tint: 'var(--ui-green)' },
  { emoji: '🚀', icon: 'rocket', id: 'project', markdown: project, tint: 'var(--ui-purple)' },
  { emoji: '📐', icon: 'symbol-structure', id: 'spec', markdown: spec, tint: 'var(--ui-blue)' },
  { emoji: '⚖️', icon: 'law', id: 'decision', markdown: decision, tint: 'var(--ui-red)' },
  { emoji: '🎯', icon: 'target', id: 'okr', markdown: okr, tint: 'var(--ui-yellow)' },
  { emoji: '📈', icon: 'graph-line', id: 'thesis', markdown: thesis, tint: 'var(--ui-green)' },
  { emoji: '📔', icon: 'calendar', id: 'journal', markdown: journal, tint: 'var(--ui-orange)' }
]
