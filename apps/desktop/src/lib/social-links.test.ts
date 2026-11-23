/** Brain: a pasted profile link is recognised by its platform, shows a readable handle, and only web links pass. */
import { describe, expect, it } from 'vitest'

import { parseSocialLink } from './social-links'

describe('parseSocialLink', () => {
  it.each([
    ['https://www.instagram.com/cata.lindau/', 'Instagram', '@cata.lindau'],
    ['instagram.com/cata.lindau', 'Instagram', '@cata.lindau'],
    ['https://wa.me/4915112345678', 'WhatsApp', '+4915112345678'],
    ['https://x.com/cata', 'X', '@cata'],
    ['twitter.com/cata', 'X', '@cata'],
    ['https://www.facebook.com/profile.php?id=1000123', 'Facebook', '@1000123'],
    ['https://www.threads.net/@cata', 'Threads', '@cata'],
    ['https://www.linkedin.com/in/vasi-catalin/', 'LinkedIn', '@vasi-catalin'],
    ['https://www.youtube.com/@brainchef', 'YouTube', '@brainchef'],
    ['https://t.me/cata', 'Telegram', '@cata'],
    ['https://my-restaurant.de/team', 'Website', 'my-restaurant.de']
  ])('%s → %s %s', (input, platform, handle) => {
    expect(parseSocialLink(input)).toMatchObject({ handle, platform: { name: platform } })
  })

  it('refuses what is not a web link', () => {
    for (const input of ['', 'hello there', 'javascript:alert(1)', 'file:///etc/passwd', 'mailto:a@b.de', 'notalink']) {
      expect(parseSocialLink(input)).toBeNull()
    }
  })
})
