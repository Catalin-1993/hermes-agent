/** Brain: what a recording becomes — the routine the agent replays and the `/learn` request that saves it. */
import { describe, expect, it } from 'vitest'

import type { RecordedPageEvent } from './record-in-page'
import { describeStep, routineFromEvents, routineLearnRequest } from './routine'

// Captured by record-in-page.ts in a real browser: log in, open a link, search, add the second result to the cart.
const CAPTURE: RecordedPageEvent[] = [
  { at: 0, kind: 'page', label: 'Shop login', url: 'http://shop.test/index.html' },
  { at: 80, kind: 'click', label: 'Email', selector: '#email', tag: 'input' },
  { at: 150, kind: 'type', label: 'Email', selector: '#email', tag: 'input', value: 'cata@example.com' },
  { at: 151, kind: 'click', label: 'Password', selector: '#pw', tag: 'input' },
  { at: 220, kind: 'type', label: 'Password', secret: true, selector: '#pw', tag: 'input', value: '' },
  { at: 230, kind: 'select', label: 'Country', selector: 'select[name="country"]', tag: 'select', value: 'Romania' },
  { at: 280, kind: 'click', label: 'Go to search', selector: 'a[href="search.html"]', tag: 'a' },
  { at: 300, kind: 'page', label: 'Search', url: 'http://shop.test/search.html' },
  { at: 300, kind: 'page', label: 'Search', url: 'http://shop.test/search.html' },
  { at: 350, kind: 'click', label: 'Search products', selector: 'input[name="q"]', tag: 'input' },
  { at: 360, kind: 'type', label: 'Search products', selector: 'input[name="q"]', tag: 'input', value: 'winter' },
  { at: 370, kind: 'type', label: 'Search products', selector: 'input[name="q"]', tag: 'input', value: 'winter boots' },
  { at: 371, kind: 'key', key: 'Enter', label: 'Search products', selector: 'input[name="q"]', tag: 'input' },
  { at: 400, kind: 'click', label: 'Add to cart', selector: 'ul > li:nth-of-type(2) > button', tag: 'button' },
  { at: 60_000, kind: 'page', url: 'http://shop.test/cart.html' }
]

describe('task recorder routine', () => {
  const routine = routineFromEvents(CAPTURE)

  it('keeps every action in order and folds away the noise', () => {
    expect(routine.map(describeStep)).toEqual([
      'Open http://shop.test/index.html',
      'Type “cata@example.com” in “Email”',
      'Type a secret in “Password”',
      'Choose “Romania” in “Country”',
      'Click “Go to search”',
      'Arrive at http://shop.test/search.html',
      'Type “winter boots” in “Search products”',
      'Press Enter in “Search products”',
      'Click “Add to cart”',
      'Open http://shop.test/cart.html'
    ])
  })

  it('names each element by a selector and by what a person sees', () => {
    expect(routine.at(-2)).toEqual({ kind: 'click', label: 'Add to cart', selector: 'ul > li:nth-of-type(2) > button' })
  })

  it('never carries a secret into the request, and asks for it at replay instead', () => {
    const request = routineLearnRequest('Buy boots', routine)

    expect(request.startsWith('/learn ')).toBe(true)
    expect(request).toContain('"buy-boots"')
    expect(request).toContain('"secret": true')
    expect(request).toContain('ask me for them')
    expect(JSON.parse(request.split('```json\n')[1].split('\n```')[0])).toEqual(routine)
  })

  it('starts somewhere even when the first thing captured is a page a click led to', () => {
    const steps = routineFromEvents([
      { at: 0, kind: 'click', label: 'Docs', selector: 'a' },
      { at: 10, kind: 'page', url: 'https://example.com/docs' }
    ])

    expect(steps.map(describeStep)).toEqual(['Click “Docs”', 'Arrive at https://example.com/docs'])
    expect(routineFromEvents([{ at: 0, kind: 'page', url: 'about:blank' }])).toEqual([])
  })
})
