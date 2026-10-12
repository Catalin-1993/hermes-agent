import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import { dragOutName, prepareDragOut } from './drag-out'

test('a display name stays one path segment', () => {
  assert.equal(dragOutName('../../etc/passwd', 'x'), 'passwd')
  assert.equal(dragOutName('a/b:c\u0007.pdf', 'x'), 'b_c_.pdf')
  assert.equal(dragOutName('..', 'fallback.bin'), 'fallback.bin')
})

test('files go out under the names the user knows, and refused paths are skipped', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drag-out-'))
  const stored = path.join(root, 'fl_123.pdf')
  fs.writeFileSync(stored, '%PDF')

  const files = await prepareDragOut(
    [
      { name: 'Quarterly report.pdf', path: stored },
      { name: 'secret.env', path: '/refused' },
      { name: 'Quarterly report.pdf', path: stored }
    ],
    {
      resolveFile: async raw => {
        if (raw === '/refused') {
          throw new Error('blocked')
        }

        return raw
      },
      tempRoot: path.join(root, 'out')
    }
  )

  assert.equal(files.length, 2)
  assert.deepEqual(
    files.map(file => path.basename(file)),
    ['Quarterly report.pdf', 'Quarterly report.pdf']
  )
  assert.notEqual(files[0], files[1])
  assert.equal(fs.readFileSync(files[0], 'utf8'), '%PDF')
})
