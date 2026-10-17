import { describe, expect, it } from 'vitest'

import { preprocessMarkdown } from './markdown-preprocess'

const PLACE = '{\n"type": "place",\n"title": "Sede Centrală Brain AI",\n"address": "Strada Inovației 42"\n}'

describe('drawn fences with a word after the language', () => {
  // The bug: a model wrote ```card place and the chat unwrapped it into plain JSON text.
  it('keeps ```card place a card fence', () => {
    expect(preprocessMarkdown(`## 1. Place Card\n\n\`\`\`card place\n${PLACE}\n\`\`\`\n`)).toBe(
      `## 1. Place Card\n\n\`\`\`card\n${PLACE}\n\`\`\`\n`
    )
  })

  it('keeps a JSON body fenced whatever its info tail says', () => {
    const json = '{\n"name": "Brain",\n"tags": ["agent", "chat"]\n}'

    expect(preprocessMarkdown(`\`\`\`json example config\n${json}\n\`\`\`\n`)).toContain('```json\n')
  })
})
