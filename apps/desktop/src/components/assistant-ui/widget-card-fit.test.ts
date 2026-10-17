import { afterEach, describe, expect, it } from 'vitest'

import { cardFitChrome } from './widget-frame-doc'

/** Runs the card-fit script against the current jsdom document, as the frame runs it after the markup. */
function runCardFit(markup: string) {
  document.body.innerHTML = markup
  const script = /<script>([\s\S]*)<\/script>/.exec(cardFitChrome('Inter'))?.[1] ?? ''

  // jsdom lays nothing out (every box is 0px wide), so the frame is 0px wide too.
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 0 })
  new Function(script)()
}

afterEach(() => {
  document.body.removeAttribute('style')
  document.body.innerHTML = ''
})

describe('cardFitChrome', () => {
  // The bug: a model's widget drew its own dark page and card, which showed as a box inside the figure card
  // — and its light text vanished on the light theme.
  it('takes the page background and the one box wrapping the widget off, and gives its text the theme ink', () => {
    runCardFit(
      '<div class="wrap" style="background: rgb(30, 41, 59); padding: 24px; color: rgb(226, 232, 240)">x</div>'
    )

    const wrap = document.querySelector<HTMLElement>('.wrap')!

    expect(document.body.style.getPropertyValue('background')).toBe('transparent')
    expect(wrap.style.getPropertyValue('background')).toBe('transparent')
    expect(wrap.style.getPropertyValue('padding')).toBe('0px')
    expect(wrap.style.getPropertyValue('color')).toBe('var(--foreground)')
  })

  it('leaves a widget made of several parts as it is', () => {
    runCardFit('<div class="a" style="background: rgb(1, 2, 3)">a</div><div class="b">b</div>')

    expect(document.querySelector<HTMLElement>('.a')!.style.getPropertyValue('background')).toBe('rgb(1, 2, 3)')
  })

  it('makes the app font the widget font', () => {
    expect(cardFitChrome('Inter, sans-serif')).toContain('html,body{font-family:Inter, sans-serif!important}')
  })
})
