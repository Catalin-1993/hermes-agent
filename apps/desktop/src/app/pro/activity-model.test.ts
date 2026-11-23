/** Brain (Pro Mode): the agent's tool calls read as plain steps, and a call with nothing to name falls back. */
import { describe, expect, it } from 'vitest'

import { describeTool } from './activity-model'

describe('describeTool', () => {
  it.each([
    ['patch', { path: 'src/app/pro/board-tab.tsx' }, 'Edited board-tab.tsx'],
    ['read_file', { path: '/Users/cata/brain/README.md' }, 'Read README.md'],
    ['terminal', { command: 'git status' }, 'Ran git status'],
    ['web_search', { query: 'ETH price' }, 'Searched the web for ETH price'],
    ['delegate_task', { goal: 'Review the diff' }, 'Helper agent: Review the diff']
  ])('%s → %s', (name, args, label) => {
    expect(describeTool(name, args).label).toBe(label)
  })

  it('names the skill a skill_view read, and falls back to the tool name when there is nothing to say', () => {
    expect(describeTool('skill_view', { name: 'frontend-design' })).toEqual({
      label: 'Read skill frontend-design',
      using: 'Skill frontend-design'
    })
    expect(describeTool('patch', {}).label).toBe('patch')
    expect(describeTool('mcp__github__create_issue', {}).label).toBe('github · create issue')
  })
})
