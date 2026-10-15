import { describe, expect, it } from 'vitest'

import { chatMermaidSource } from './mermaid-source'

describe('chatMermaidSource', () => {
  // Real output from a free model: pastel `style` fills and a node opened with { and closed with ].
  it('drops the model’s own colours and closes a node with the bracket it opened', () => {
    const source = [
      'flowchart TD',
      '    A[vizitator] --> B{lead]',
      '    B -->|lead calificat| C[ofertă]',
      '    style A fill:#e3f2fd',
      '    classDef lost fill:#ffcdd2',
      '    class E lost',
      '    linkStyle 0 stroke:#f00'
    ].join('\n')

    expect(chatMermaidSource(source)).toBe(
      ['flowchart TD', '    A[vizitator] --> B{lead}', '    B -->|lead calificat| C[ofertă]'].join('\n')
    )
  })

  it('leaves a well-formed diagram exactly as written', () => {
    const source = 'flowchart LR\n  A[Visitor] --> B(Lead) --> C{Client?}\n  B --> D[Lost]'

    expect(chatMermaidSource(source)).toBe(source)
  })
})
