import { describe, expect, it } from 'vitest'

import { writtenHtmlFiles } from './auto-html-previews'

const write = (path: string) => ({
  args: { content: '<html></html>', path },
  toolName: 'write_file',
  type: 'tool-call'
})

describe('writtenHtmlFiles', () => {
  // The bug: the agent saved its dashboard to a file and never showed it, so the user saw only tool rows.
  it('lists the HTML pages this reply wrote, once each', () => {
    const parts = [
      write('/home/u/.hermes/cache/scratch/dashboard.html'),
      write('/home/u/notes.md'),
      write('/home/u/.hermes/cache/scratch/dashboard.html'),
      {
        args: JSON.stringify({ patch: '*** Begin Patch\n*** Update File: site/index.htm\n@@\n-a\n+b\n*** End Patch' }),
        toolName: 'patch',
        type: 'tool-call'
      },
      { type: 'text', text: 'Done.' }
    ]

    expect(writtenHtmlFiles(parts)).toBe('/home/u/.hermes/cache/scratch/dashboard.html\nsite/index.htm')
  })

  it('leaves out a page the reply already shows, and anything that was only read', () => {
    const parts = [
      write('/tmp/report.html'),
      { args: { path: '/tmp/other.html' }, toolName: 'read_file', type: 'tool-call' },
      { type: 'text', text: 'Here:\n\n::preview{file="report.html"}' }
    ]

    expect(writtenHtmlFiles(parts)).toBe('')
  })
})
