/** What the New agent wizard sends: only what the user changed, in the profile's own words. */
import { describe, expect, it } from 'vitest'

import { agentSlug, budgetUsd, createPlan, EMPTY_DRAFT, nameProblem, type WizardBase } from './model'

const BASE: WizardBase = {
  integrations: [{ enabled: true, name: 'github' }],
  skills: [
    { enabled: true, name: 'research' },
    { enabled: false, name: 'pdf' }
  ],
  toolsets: [
    { enabled: true, name: 'web' },
    { enabled: true, name: 'terminal' }
  ]
}

describe('agent name', () => {
  it('turns a typed name into a profile id and says what is wrong with it', () => {
    expect(agentSlug('Market Researcher')).toBe('market-researcher')
    expect(agentSlug('Ștefan Ână')).toBe('stefan-ana')
    expect(nameProblem('', [])).toBe('empty')
    expect(nameProblem('!!!', [])).toBe('invalid')
    expect(nameProblem('Config', [])).toBe('reserved')
    expect(nameProblem('Scout', ['scout'])).toBe('taken')
    expect(nameProblem('Scout', ['other'])).toBeNull()
  })
})

describe('create plan', () => {
  it('leaves everything the user did not touch to the cloned profile', () => {
    const plan = createPlan({ ...EMPTY_DRAFT, name: 'Scout' }, BASE)

    expect(plan.create).toEqual({ clone_from: 'default', description: '', name: 'scout', share_auth: true })
    expect(plan.configure).toEqual({})
    expect(plan.sets).toEqual([])
    expect(plan.budget).toBeNull()
    expect(plan.rhythm).toBeNull()
  })

  it('sends the changed lists, model, depth, memory, budget and schedule', () => {
    const plan = createPlan(
      {
        ...EMPTY_DRAFT,
        budget: '12,5',
        effort: 'high',
        memory: false,
        model: 'glm-5',
        name: 'Scout',
        provider: 'openrouter',
        schedule: { ...EMPTY_DRAFT.schedule, enabled: true },
        skills: { pdf: true },
        soul: '  Be careful.  ',
        toolsets: { terminal: false }
      },
      BASE
    )

    expect(plan.create).toMatchObject({ model: 'glm-5', provider: 'openrouter', soul: 'Be careful.' })
    expect(plan.configure).toEqual({ disabled_skills: [], enabled_toolsets: ['web'] })
    expect(plan.sets).toEqual([
      ['agent.reasoning_effort', 'high'],
      ['memory.memory_enabled', 'false']
    ])
    expect(plan.budget).toBe(12.5)
    expect(plan.rhythm).toMatchObject({ enabled: true, every_minutes: 60, weekdays_only: true })
  })

  it('reads no cap from a blank, zero or garbled budget', () => {
    expect(budgetUsd('')).toBeNull()
    expect(budgetUsd('0')).toBeNull()
    expect(budgetUsd('abc')).toBeNull()
    expect(budgetUsd('$ 20')).toBe(20)
  })
})
