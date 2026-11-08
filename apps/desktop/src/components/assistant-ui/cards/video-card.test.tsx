import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import { parseCardSpec } from './card-spec'
import { VideosCard } from './video-card'

const openExternalLink = vi.hoisted(() => vi.fn())

vi.mock('@/lib/external-link', () => ({ openExternalLink }))

afterEach(() => {
  cleanup()
  openExternalLink.mockReset()
})

function renderCard() {
  const parsed = parseCardSpec(
    JSON.stringify({
      type: 'videos',
      videos: [
        { title: 'First song', url: 'https://youtu.be/aaaaaaaaaaa' },
        { title: 'Second song', url: 'https://youtu.be/bbbbbbbbbbb' }
      ]
    })
  )

  const spec = 'spec' in parsed ? parsed.spec : null

  if (spec?.kind !== 'videos') {
    throw new Error('expected a videos card')
  }

  render(
    <I18nProvider>
      <VideosCard spec={spec} />
    </I18nProvider>
  )
}

const search = (text: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Search YouTube' }))
  const field = screen.getByRole('textbox', { name: 'Search YouTube' })
  fireEvent.change(field, { target: { value: text } })
  fireEvent.submit(field)
}

describe('VideosCard search', () => {
  it('opens YouTube search for words, without touching the row', () => {
    renderCard()
    search('nirvana come as you are')

    expect(openExternalLink).toHaveBeenCalledWith(
      'https://www.youtube.com/results?search_query=nirvana%20come%20as%20you%20are'
    )
    expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(3)
  })

  it('puts a pasted YouTube link first in the row and on the stage', () => {
    renderCard()
    search('https://www.youtube.com/watch?v=ccccccccccc')

    const posters = screen.getAllByRole('button', { name: /^Play / }).filter(el => el.hasAttribute('aria-current'))

    expect(posters).toHaveLength(3)
    expect(posters[0]!.getAttribute('aria-current')).toBe('true')
    expect(openExternalLink).not.toHaveBeenCalled()
  })
})
