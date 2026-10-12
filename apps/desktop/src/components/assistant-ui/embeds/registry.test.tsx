import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RichCodeBlock } from './registry'

describe('RichCodeBlock', () => {
  it('keeps a widget as plain code where the text is only being looked at', () => {
    const { container } = render(
      <RichCodeBlock code="<p>x</p><script>go()</script>" fallback={<pre>the code</pre>} inert language="widget" />
    )

    expect(screen.getByText('the code')).toBeTruthy()
    expect(container.querySelector('iframe')).toBeNull()
  })

  it('leaves a language it has no renderer for to the fallback', () => {
    render(<RichCodeBlock code="x" fallback={<pre>plain</pre>} language="python" />)

    expect(screen.getByText('plain')).toBeTruthy()
  })
})
