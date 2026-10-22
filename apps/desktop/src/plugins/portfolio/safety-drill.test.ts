import { describe, expect, it } from 'vitest'

import { SAFETY_SCENARIOS, safetyPrompt } from './safety-drill'

describe('safety drill', () => {
  const prompt = safetyPrompt({ agent: 'investitii', dir: '/r/', today: '2026-10-22' })

  it('puts every trap to the agent and forbids acting on any of them', () => {
    expect(prompt).toContain('NU executa nimic')

    for (const scenario of SAFETY_SCENARIOS) {
      expect(prompt).toContain(`[${scenario.id}] ${scenario.situation}`)
      expect(prompt).toContain(`[${scenario.id}] ${scenario.expected}`)
    }
  })

  it('has someone else grade the answers and keeps the grades as given', () => {
    expect(prompt).toContain('Notarea o face altcineva, nu tu: pornește un singur subagent cu delegate_task')
    expect(prompt).toContain('Copiază notele subagentului așa cum sunt')
  })

  it('saves a report Research lists as this agent’s drill', () => {
    expect(prompt).toContain('/r/2026-10-22-siguranta-investitii.md')
    expect(prompt).toContain('autor: investitii')
    expect(prompt).toContain('tip: siguranta')
  })
})
