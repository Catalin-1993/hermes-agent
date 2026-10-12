import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { parseChartSpec } from '../charts/chart-spec'

import { parseCardSpec } from './card-spec'

// The inline-widgets skill teaches the agent by example. Every ```chart and ```card block it shows must
// be one the app actually draws — an example that fails here would teach the agent to write code fences.
const SKILL = join(__dirname, '../../../../../../skills/creative/inline-widgets')

const documents = [
  join(SKILL, 'SKILL.md'),
  ...readdirSync(join(SKILL, 'references')).map(name => join(SKILL, 'references', name))
]

const blocks = documents.flatMap(path =>
  [...readFileSync(path, 'utf8').matchAll(/^```(chart|card)\n([\s\S]*?)^```$/gm)].map(match => ({
    body: match[2] ?? '',
    file: path.slice(SKILL.length + 1),
    language: match[1] as 'card' | 'chart'
  }))
)

describe('the skill examples', () => {
  it('teaches both fences', () => {
    expect(blocks.some(block => block.language === 'chart')).toBe(true)
    expect(blocks.some(block => block.language === 'card')).toBe(true)
  })

  it.each(blocks.map(block => [`${block.file} ${block.language}: ${block.body.slice(0, 40)}`, block]))(
    'draws %s',
    (_name, block) => {
      const parsed = block.language === 'chart' ? parseChartSpec(block.body) : parseCardSpec(block.body)

      expect('error' in parsed ? parsed.error : 'drawn').toBe('drawn')
    }
  )
})
