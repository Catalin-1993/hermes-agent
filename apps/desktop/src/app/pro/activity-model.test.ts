/** Brain (Pro Mode): the agent's tool calls read as plain steps, and a call with nothing to name falls back. */
import { describe, expect, it } from 'vitest'

import { describeTool } from './activity-model'

describe('describeTool', () => {
  it.each([
    ['patch', { path: 'src/app/pro/board-tab.tsx' }, 'Edited board-tab.tsx'],
    ['read_file', { path: '/Users/cata/brain/README.md' }, 'Read README.md'],
    ['terminal', { command: 'git status' }, 'Checked what changed in the project'],
    ['terminal', { command: 'cd /x && npx vitest run src/app' }, 'Ran the tests'],
    ['terminal', { command: 'git push -u origin main' }, 'Sent the changes to GitHub'],
    ['terminal', { command: 'make release' }, 'Ran a command: make release'],
    ['web_search', { query: 'ETH price' }, 'Searched the web for “ETH price”'],
    ['browser_navigate', { url: 'https://www.github.com/x' }, 'Opened github.com']
  ])('%s → %s', (name, args, label) => {
    expect(describeTool(name, args).label).toBe(label)
  })

  it('says a running step in the present and a finished one in the past', () => {
    expect(describeTool('read_file', { path: 'notes.md' }, false).label).toBe('Reading notes.md')
    expect(describeTool('terminal', { command: 'pytest -q' }, false).label).toBe('Running the tests')
  })

  it('names the skill a skill_view read, and falls back to the tool name when there is nothing to say', () => {
    expect(describeTool('skill_view', { name: 'frontend-design' })).toEqual({
      label: 'Read the skill frontend-design',
      using: 'Skill frontend-design'
    })
    expect(describeTool('patch', {}).label).toBe('Patch')
    expect(describeTool('mcp__github__create_issue', {}).label).toBe('Github · create issue')
  })
})
