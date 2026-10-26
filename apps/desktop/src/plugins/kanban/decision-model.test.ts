import { describe, expect, it } from 'vitest'

import { hasStructure, parseDecision } from './decision-model'

describe('parseDecision', () => {
  it('reads the labelled parts, with their continuation lines', () => {
    const d = parseDecision(
      'Ask: Approve a cap of 30% on ETH.\nWhy: ETH is 39% of the portfolio.\nIf approved: I rebalance in 3 steps\nover three weeks.\nIf declined: I keep monitoring.\nReport: Full numbers are in the PDF.'
    )

    expect(d).toEqual({
      approve: 'I rebalance in 3 steps\nover three weeks.',
      ask: 'Approve a cap of 30% on ETH.',
      decline: 'I keep monitoring.',
      report: 'Full numbers are in the PDF.',
      why: 'ETH is 39% of the portfolio.'
    })
    expect(hasStructure(d)).toBe(true)
  })

  it('accepts markdown bold and any case', () => {
    expect(parseDecision('**Ask:** one thing\n**IF APPROVED:** go').approve).toBe('go')
    expect(parseDecision('**Ask:** one thing').ask).toBe('one thing')
  })

  it('treats unlabelled text as the report', () => {
    const d = parseDecision('ETH ajunge la 39%.\nRecomand un plafon.')

    expect(d.report).toBe('ETH ajunge la 39%.\nRecomand un plafon.')
    expect(hasStructure(d)).toBe(false)
  })

  it('keeps text before the first label as part of the report', () => {
    expect(parseDecision('Intro line.\nAsk: decide').report).toBe('Intro line.')
  })

  it('is empty for nothing', () => {
    expect(parseDecision(null).report).toBe('')
    expect(hasStructure(parseDecision(undefined))).toBe(false)
  })
})
