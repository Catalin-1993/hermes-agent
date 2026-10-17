import { describe, expect, it } from 'vitest'

import { chatMermaidSource, mermaidKind } from './mermaid-source'

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

  // The bug: every `class Name {` line of a class diagram was dropped as styling, so it failed to parse
  // and showed as code.
  it('keeps the class declarations and member types of a class diagram', () => {
    const source = [
      'classDiagram',
      '    class IPlugin {',
      '        <<interface>>',
      '        +getCommands(): Command[]',
      '        +load(name): Promise~void~',
      '    }',
      '    style IPlugin fill:#fff'
    ].join('\n')

    expect(chatMermaidSource(source)).toBe(source.split('\n').slice(0, -1).join('\n'))
  })
})

describe('mermaidKind', () => {
  it('reads the declared kind past comments and front matter', () => {
    expect(mermaidKind('---\ntitle: x\n---\n%% note\npie showData\n "a" : 1')).toBe('pie')
    expect(mermaidKind('  xychart-beta\n x-axis [a]')).toBe('xychart-beta')
  })
})
