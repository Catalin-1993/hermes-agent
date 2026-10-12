import { describe, expect, it } from 'vitest'

import {
  contentPolicy,
  LIBRARY_HOSTS,
  networkAccess,
  networkRequest,
  parseApprovedHosts,
  sealedHtml
} from './frame-policy'

describe('internet access for a sealed page', () => {
  const meta = (hosts: string) =>
    `<!doctype html><head><meta name="hermes:network" content="${hosts}"></head><body></body>`

  it('takes only public https hosts, spelled out, from the document', () => {
    expect(networkRequest(meta('api.frankfurter.dev  CDN.Example.org, api.frankfurter.dev'))).toEqual({
      hosts: ['api.frankfurter.dev', 'cdn.example.org'],
      invalid: []
    })

    const bad = [
      'localhost',
      '127.0.0.1',
      '10.0.0.5',
      '[::1]',
      '*.example.com',
      'api.com:8080',
      'x.com/path',
      'nas.local',
      'router.lan',
      'a.internal',
      'intranet',
      'https://a.com'
    ]

    expect(networkRequest(meta(bad.join(' '))).hosts).toEqual([])
    expect(networkRequest(meta(bad.join(' '))).invalid).toHaveLength(bad.length)
    expect(networkRequest('<p>no meta</p>')).toEqual({ hosts: [], invalid: [] })
    expect(
      networkRequest(meta(Array.from({ length: 12 }, (_v, n) => `h${n}.example.org`).join(' '))).hosts
    ).toHaveLength(8)
  })

  it('reaches what the document names AND the owner approved, and asks about the rest', () => {
    const html = meta('a.example.org b.example.org')

    expect(networkAccess(html, '["a.example.org","evil.example.org"]')).toEqual({
      active: ['a.example.org'],
      invalid: [],
      pending: ['b.example.org']
    })
    expect(networkAccess(html, '').active).toEqual([])
    expect(networkAccess(html, 'not json').pending).toEqual(['a.example.org', 'b.example.org'])
    // An approval of something that is not a public host is no approval.
    expect(parseApprovedHosts('["localhost","10.0.0.1","ok.example.org"]')).toEqual(['ok.example.org'])
  })

  it('opens the policy to exactly the approved hosts, and no further', () => {
    expect(contentPolicy()).not.toContain('connect-src')
    expect(contentPolicy()).not.toContain('https:')

    const policy = contentPolicy({ hosts: ['api.frankfurter.dev'] })

    expect(policy).toContain("default-src 'none'")
    expect(policy).toContain('connect-src https://api.frankfurter.dev wss://api.frankfurter.dev')
    expect(policy).toContain("script-src 'unsafe-inline' https://api.frankfurter.dev")
    expect(policy).not.toMatch(/\*|https: |http:/)
  })

  it('lets the shared CDNs serve code, styles and fonts — never data, pictures or a connection', () => {
    const policy = contentPolicy({ libraries: true })
    const directive = (name: string) => policy.split('; ').find(part => part.startsWith(`${name} `)) ?? ''

    for (const host of LIBRARY_HOSTS) {
      for (const name of ['script-src', 'style-src', 'font-src']) {
        expect(directive(name)).toContain(`https://${host}`)
      }
    }

    expect(policy).not.toContain('connect-src')
    expect(directive('img-src')).not.toContain('https:')
    expect(contentPolicy({ libraries: false })).not.toContain(LIBRARY_HOSTS[0])
  })

  it('puts the policy before anything the page can run', () => {
    const policy = contentPolicy({ libraries: true })

    expect(sealedHtml('<p>x</p>', { libraries: true }).startsWith('<meta http-equiv="Content-Security-Policy"')).toBe(
      true
    )
    expect(sealedHtml('<html><head><title>t</title></head></html>', { libraries: true })).toContain(
      `<head><meta http-equiv="Content-Security-Policy" content="${policy}"><title>`
    )
  })
})
