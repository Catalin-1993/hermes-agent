import { afterEach, describe, expect, it } from 'vitest'

import { networkRequest } from '@/lib/frame-policy'

import { INTERACTIVE_MAX_CHARS, interactiveSrc } from './interactive-html'
import { INTERACTIVE_TEMPLATES } from './interactive-templates'

// Every starting template must run as a block does: no network, nothing but `hermes` asked of the
// page, no script error, and the data it saves is what it reads back.

interface Run {
  doc: Document
  errors: string[]
  saved: unknown[]
  win: Window & typeof globalThis
}

/** A template in its own frame of the test document, with `hermes` handed in as the page would. */
function run(html: string, state: unknown = null): Run {
  const errors: string[] = []
  const saved: unknown[] = []

  const frame = document.createElement('iframe')

  document.body.append(frame)

  const win = frame.contentWindow as Run['win']
  const doc = frame.contentDocument as Document

  // The frame's `parent` is the real jsdom window, which is not the test's global.
  Object.assign(win.parent, {
    __errors: errors,
    __hermes: {
      onTheme: () => undefined,
      save: (value: unknown) => {
        saved.push(JSON.parse(JSON.stringify(value)))

        return true
      },
      state,
      theme: { accent: '#00f', bg: '#fff', border: '#ccc', fg: '#111', muted: '#666', scheme: 'light' }
    }
  })

  doc.open()
  doc.write(
    '<script>window.hermes=parent.__hermes;window.onerror=function(m){parent.__errors.push(String(m))}</script>'
  )
  doc.write(html)
  doc.close()

  return { doc, errors, saved, win }
}

afterEach(() => {
  document.body.textContent = ''
})

const byId = (doc: Document, id: string) => doc.getElementById(id) as HTMLElement

describe('the interactive templates', () => {
  it.each(INTERACTIVE_TEMPLATES.map(template => [template.id, template] as const))(
    '%s is a sealed, self-contained page that runs',
    (_id, template) => {
      expect(template.html).toContain(`<title>${template.title}</title>`)
      expect(template.html.length).toBeLessThan(INTERACTIVE_MAX_CHARS / 20)
      // A block is offline unless its document names the hosts it needs — and then it reaches only those.
      const { hosts, invalid } = networkRequest(template.html)
      const urls = template.html.match(/https?:\/\/[^\s'")<]+/g) ?? []

      expect(invalid).toEqual([])

      for (const url of urls.filter(url => !url.startsWith('http://www.w3.org/2000/svg'))) {
        expect(url.startsWith('https://')).toBe(true)
        expect(hosts).toContain(new URL(url).hostname)
      }

      if (hosts.length === 0) {
        expect(template.html).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(/)
      }

      expect(template.html).not.toMatch(/\b(alert|prompt|confirm)\s*\(/)
      expect(template.html).not.toMatch(/\binnerHTML\b/)
      // It follows the theme through the variables, never a colour of its own for text or surface.
      expect(template.html).toContain('var(--hermes-')
      expect(interactiveSrc(template.html)).toMatch(/^data:text\/html/)

      const { errors } = run(template.html)

      expect(errors).toEqual([])
    }
  )

  it('keeps the ROI inputs and works the result out of them', () => {
    const { doc, saved, win } = run(INTERACTIVE_TEMPLATES.find(t => t.id === 'roi')!.html, {
      cost: 1000,
      gain: 200,
      months: 10
    })

    expect(byId(doc, 'roi').textContent).toBe('100%')
    expect(byId(doc, 'payback').textContent).toBe('5.0 months')

    const gain = byId(doc, 'gain') as HTMLInputElement

    gain.value = '300'
    gain.dispatchEvent(new win.Event('input'))

    expect(byId(doc, 'roi').textContent).toBe('200%')
    expect(saved.at(-1)).toEqual({ cost: 1000, gain: 300, months: 10 })
  })

  it('scores the quiz, remembers the best score and starts over', () => {
    const { doc, saved, win } = run(INTERACTIVE_TEMPLATES.find(t => t.id === 'quiz')!.html)
    const click = (selector: string, at = 0) => (doc.querySelectorAll(selector)[at] as HTMLElement).click()

    // The first answers are right, right, right, right: indices 0, 1, 0, 1.
    for (const pick of [0, 1, 0, 1]) {
      click('.opts button', pick)
      click('button.primary')
    }

    expect(doc.querySelector('.big')?.textContent).toBe('4 / 4')
    expect(saved.at(-1)).toMatchObject({ best: 4, score: 4 })

    click('button.primary')

    expect(doc.querySelector('.q')?.textContent).toMatch(/navigation/)
    expect(saved.at(-1)).toMatchObject({ i: 0, score: 0, best: 4 })
  })

  it('marks flashcards known, and resumes where it was', () => {
    const { doc, saved, win } = run(INTERACTIVE_TEMPLATES.find(t => t.id === 'flashcards')!.html, { i: 2, known: [0] })

    expect(byId(doc, 'meta').textContent).toBe('Card 3 of 4 · 1 known')

    byId(doc, 'know').click()
    byId(doc, 'next').click()

    expect(saved.at(-1)).toEqual({ i: 3, known: [0, 2] })
  })

  it('draws the chart from its rows and follows an edit', () => {
    const { doc, saved, win } = run(INTERACTIVE_TEMPLATES.find(t => t.id === 'chart')!.html)
    const svg = byId(doc, 'svg')

    expect(svg.querySelectorAll('rect').length).toBe(6)

    byId(doc, 'add').click()

    expect(svg.querySelectorAll('rect').length).toBe(7)

    byId(doc, 'ln').click()

    expect(svg.querySelectorAll('polyline').length).toBe(1)
    expect(saved.at(-1)).toMatchObject({ kind: 'line' })
  })

  it('shows each KPI against its target and keeps an edit', () => {
    const { doc, saved, win } = run(INTERACTIVE_TEMPLATES.find(t => t.id === 'kpi')!.html)
    const value = doc.querySelector('input.v') as HTMLInputElement

    value.value = '60000'
    value.dispatchEvent(new win.Event('input'))

    expect(doc.querySelector('.meter i')?.className).toBe('hit')
    expect(saved.at(-1)).toMatchObject({ rev: { target: 60000, value: 60000 } })
  })

  it('keeps the timeline in date order and adds a milestone', () => {
    const { doc, saved, win } = run(INTERACTIVE_TEMPLATES.find(t => t.id === 'timeline')!.html)

    expect(doc.querySelectorAll('#list li').length).toBe(3)

    ;(byId(doc, 'title') as HTMLInputElement).value = 'Retro'
    ;(byId(doc, 'date') as HTMLInputElement).value = '2000-01-01'
    byId(doc, 'form').dispatchEvent(new win.Event('submit', { cancelable: true }))

    expect(doc.querySelectorAll('#list li').length).toBe(4)
    expect(doc.querySelector('#list li .t')?.textContent).toBe('Retro')
    expect(saved.at(-1)).toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ t: 'Retro' })]) })
  })

  const html = (id: string) => INTERACTIVE_TEMPLATES.find(template => template.id === id)!.html

  it('moves a kanban card with the arrows, adds and removes cards, and keeps it all', () => {
    const { doc, saved } = run(html('kanban'))
    const counts = () => [...doc.querySelectorAll('.col h3 span:last-child')].map(node => node.textContent)

    expect(counts()).toEqual(['2', '1', '1'])
    ;(doc.querySelector('button[aria-label^="Move “Define the scope” to In progress"]') as HTMLElement).click()

    expect(counts()).toEqual(['1', '2', '1'])
    expect(saved.at(-1)).toMatchObject({ doing: ['Design review', 'Define the scope'] })

    const input = doc.querySelectorAll('.add input')[2] as HTMLInputElement

    input.value = 'Ship it'
    ;(doc.querySelectorAll('.add')[2] as HTMLFormElement).dispatchEvent(
      new (doc.defaultView as Window & typeof globalThis).Event('submit', { cancelable: true })
    )

    expect(counts()).toEqual(['1', '2', '2'])
    ;(doc.querySelector('button[aria-label="Remove “Ship it”"]') as HTMLElement).click()

    expect(counts()).toEqual(['1', '2', '1'])
  })

  it('starts the focus timer on the session in hand, and counts a finished one', () => {
    const { doc, saved } = run(html('focus'), {
      day: new Date().toISOString().slice(0, 10),
      done: 2,
      mode: 'focus',
      task: 'Write'
    })

    expect(byId(doc, 'time').textContent).toBe('25:00')
    expect(byId(doc, 'today').textContent).toBe('Today · 2 sessions')
    expect((byId(doc, 'task') as HTMLInputElement).value).toBe('Write')

    byId(doc, 'go').click()

    expect(byId(doc, 'go').textContent).toBe('Pause')

    byId(doc, 'go').click()
    ;(doc.querySelector('.modes button[data-m="short"]') as HTMLElement).click()

    expect(byId(doc, 'time').textContent).toBe('05:00')
    expect(saved.at(-1)).toMatchObject({ done: 2, mode: 'short' })
  })

  it('adds up an invoice: lines, discount, tax, total', () => {
    const { doc, saved, win } = run(html('invoice'), {
      cur: 'USD',
      disc: 10,
      rows: [{ d: 'Work', p: 100, q: 4 }],
      tax: 20
    })

    // 400 − 10% = 360, + 20% = 432
    expect(byId(doc, 'total').textContent).toMatch(/432\.00/)

    const qty = doc.querySelector('input[aria-label="Quantity for line 1"]') as HTMLInputElement

    qty.value = '5'
    qty.dispatchEvent(new win.Event('input'))

    // 500 − 10% = 450, + 20% = 540
    expect(byId(doc, 'total').textContent).toMatch(/540\.00/)
    expect(saved.at(-1)).toMatchObject({ rows: [{ q: 5 }] })

    byId(doc, 'add').click()

    expect(doc.querySelectorAll('#rows tr')).toHaveLength(2)
  })

  it('splits a budget into segments and says when it is over', () => {
    const { doc, win } = run(html('budget'))

    expect(doc.querySelectorAll('#segs circle')).toHaveLength(5)
    expect(byId(doc, 'pct').textContent).toBe('77%')

    const income = byId(doc, 'inc') as HTMLInputElement

    income.value = '2000'
    income.dispatchEvent(new win.Event('input'))

    expect(byId(doc, 'leftLbl').textContent).toBe('Over budget')
    expect(byId(doc, 'left').className).toContain('over')
  })

  it('names the winner of a decision matrix, and follows a changed score', () => {
    const { doc, saved, win } = run(html('decision'), {
      crit: [
        ['Cost', 5, [10, 1]],
        ['Speed', 1, [1, 10]]
      ],
      opts: ['Slow', 'Fast']
    })

    expect(byId(doc, 'verdict').textContent).toBe('Slow leads with 51 points.')

    const weight = doc.querySelector('input[aria-label="Cost weight"]') as HTMLInputElement

    weight.value = '1'
    weight.dispatchEvent(new win.Event('input'))

    expect(byId(doc, 'verdict').textContent).toMatch(/tied/)
    expect(saved.at(-1)).toMatchObject({
      crit: [
        ['Cost', 1, [10, 1]],
        ['Speed', 1, [1, 10]]
      ]
    })
  })

  it('converts at its saved rates when the internet is not allowed, and says so', () => {
    const { doc, win } = run(html('currency'), { amt: 200, from: 'EUR', rates: { EUR: 1, RON: 5 }, to: 'RON' })

    expect(byId(doc, 'res').textContent).toMatch(/1,000/)
    expect(byId(doc, 'src').textContent).toMatch(/Sample rates|Saved rates/)
    expect(byId(doc, 'live').classList.contains('on')).toBe(false)

    byId(doc, 'swap').click()

    expect((byId(doc, 'from') as HTMLSelectElement).value).toBe('RON')
    expect(byId(doc, 'res').textContent).toMatch(/40/)
    expect(win).toBeDefined()
  })
})
