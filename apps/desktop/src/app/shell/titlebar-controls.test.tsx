// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registry } from '@/contrib/registry'
import { I18nProvider } from '@/i18n'
import { setFileBrowserOpen } from '@/store/layout'
import { clearFeed, recordFeedItem } from '@/store/notification-feed'
import { setTitlebarAppActionsSide } from '@/store/titlebar-app-actions'

import { ROUTES_AREA } from '../routes'

import { TITLEBAR_CHROME_CHANGED_EVENT } from './titlebar'
import { TitlebarControls, type TitlebarTool } from './titlebar-controls'

const PLUGIN_TOOL: TitlebarTool = { icon: <span />, id: 'plugin-tool', label: 'plugin tool' }

let navigateTo: (to: string) => void = () => {}

function NavigateProbe() {
  navigateTo = useNavigate()

  return null
}

function renderControls(pathname: string, props?: { leftTools?: TitlebarTool[]; tools?: TitlebarTool[] }) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <I18nProvider configClient={null} initialLocale="en">
        <NavigateProbe />
        <TitlebarControls leftTools={props?.leftTools} tools={props?.tools} />
      </I18nProvider>
    </MemoryRouter>
  )
}

const windowControls = () => screen.queryByLabelText('Window controls')
const appControls = () => screen.queryByLabelText('App controls')
const pluginChrome = () => screen.queryByText('plugin-chrome')
const pluginTool = () => screen.queryByLabelText('plugin tool')

describe('TitlebarControls fixed clusters', () => {
  let dispose: () => void

  beforeEach(() => {
    dispose = registry.registerMany([
      {
        area: ROUTES_AREA,
        data: { path: '/kanban' },
        id: 'test-kanban-route',
        render: () => null
      },
      {
        area: ROUTES_AREA,
        data: { path: '/plain' },
        id: 'test-plain-route',
        render: () => null
      }
    ])
  })

  afterEach(() => {
    dispose()
    cleanup()
  })

  it('keeps the app clusters on a contributed page that mounts no titlebar chrome', () => {
    renderControls('/plain')

    expect(windowControls()).not.toBeNull()
    expect(appControls()).not.toBeNull()
  })

  it('hides the app clusters on an overlay', () => {
    renderControls('/settings')

    expect(windowControls()).toBeNull()
    expect(appControls()).toBeNull()
  })

  it('a titleBar.tools item alone does not claim the band', () => {
    renderControls('/plain', { leftTools: [PLUGIN_TOOL] })

    expect(windowControls()).not.toBeNull()
    expect(pluginTool()).not.toBeNull()
  })

  it('keeps a titleBar.center component mounted across a chat -> page -> chat round trip', () => {
    // Plugins tear down global side effects (style tags, observers) in their
    // effect cleanup; a remount on navigation ran the OLD cleanup after the
    // NEW setup and left the plugin dead until reload (#114290).
    const life = { cleanups: 0, mounts: 0 }

    function PluginCenter() {
      useEffect(() => {
        life.mounts += 1

        return () => {
          life.cleanups += 1
        }
      }, [])

      return <span>plugin-center</span>
    }

    const disposeTitle = registry.register({
      area: 'titleBar.center',
      id: 'test-plugin-center',
      render: () => <PluginCenter />
    })

    try {
      renderControls('/')
      expect(life).toEqual({ cleanups: 0, mounts: 1 })

      act(() => navigateTo('/skills'))
      expect(screen.getByText('plugin-center')).not.toBeNull()
      expect(windowControls()).not.toBeNull()
      expect(appControls()).not.toBeNull()

      act(() => navigateTo('/'))
      expect(life).toEqual({ cleanups: 0, mounts: 1 })
    } finally {
      act(disposeTitle)
    }
  })

  describe('when the page projects titlebar chrome', () => {
    let disposeChrome: () => void

    beforeEach(() => {
      disposeChrome = registry.register({
        area: 'titleBar.left',
        id: 'test-plugin-chrome',
        render: () => <span>plugin-chrome</span>
      })
    })

    afterEach(() => {
      // The mounted controls subscribe to titleBar.* areas — dispose inside
      // act so the unmount-time registry update doesn't warn.
      act(() => disposeChrome())
    })

    it('keeps plugin titlebar contributions on a contributed full-page route', () => {
      renderControls('/kanban')

      expect(pluginChrome()).not.toBeNull()
      expect(windowControls()).toBeNull()
      expect(appControls()).toBeNull()
    })

    it('keeps contributed titlebar tools on a chrome-owning page', () => {
      renderControls('/kanban', { leftTools: [PLUGIN_TOOL] })

      expect(pluginTool()).not.toBeNull()
    })

    it('hides plugin titlebar contributions on an overlay', () => {
      renderControls('/settings')

      expect(pluginChrome()).toBeNull()
    })

    it('keeps measurable titlebar clusters on a chrome-owning contributed page', () => {
      // usePanelTitlebar positions the sessions tab strip from these hooks;
      // without them the tabs keep their stale chat-view offset and slide
      // under the page's switcher (kanban's board switcher).
      const { container } = renderControls('/kanban')

      expect(container.querySelector('[data-titlebar-cluster="left"]')).not.toBeNull()
      expect(container.querySelector('[data-titlebar-cluster="right"]')).not.toBeNull()
    })

    it('announces its chrome so the sessions tab reservation re-measures', () => {
      const listener = vi.fn()
      window.addEventListener(TITLEBAR_CHROME_CHANGED_EVENT, listener)

      try {
        renderControls('/kanban')

        expect(listener).toHaveBeenCalled()
      } finally {
        window.removeEventListener(TITLEBAR_CHROME_CHANGED_EVENT, listener)
      }
    })
  })
})

describe('titlebar app-action cluster', () => {
  afterEach(() => {
    setTitlebarAppActionsSide('right')
    act(() => setFileBrowserOpen(false))
    cleanup()
  })

  it('moves layout and HUD to the left when the appearance setting says left', () => {
    setTitlebarAppActionsSide('left')
    renderControls('/')

    const left = screen.getByLabelText('Window controls')
    const right = screen.getByLabelText('App controls')

    expect(within(left).getByLabelText('Layout editor')).toBeTruthy()
    expect(within(left).getByLabelText('HUD mode')).toBeTruthy()
    expect(within(right).queryByLabelText('Layout editor')).toBeNull()
  })

  // Settings has one door: the sidebar's footer gear (⌘, from anywhere).
  it.each(['left', 'right'] as const)('never carries Settings (app actions %s, right sidebar open)', side => {
    setTitlebarAppActionsSide(side)
    act(() => setFileBrowserOpen(true))
    renderControls('/')

    expect(screen.queryByLabelText('Open settings')).toBeNull()
  })
})

describe('titlebar right edge', () => {
  afterEach(() => {
    setTitlebarAppActionsSide('right')
    act(() => setFileBrowserOpen(false))
    clearFeed()
    cleanup()
  })

  const rightButtons = () =>
    within(screen.getByLabelText('App controls'))
      .getAllByRole('button')
      .map(button => button.getAttribute('aria-label'))

  it('leaves the bell and the button that opens the right sidebar while it is closed', () => {
    renderControls('/')

    expect(rightButtons()).toEqual(['Notifications', 'Show right sidebar'])
  })

  it('brings layout, HUD and the sidebar swap back while the right sidebar is open', () => {
    act(() => setFileBrowserOpen(true))
    renderControls('/')

    expect(rightButtons()).toEqual([
      'Layout editor',
      'HUD mode',
      'Swap sidebar sides',
      'Notifications',
      'Hide right sidebar'
    ])
  })

  it('follows the sidebar as it opens and closes', () => {
    renderControls('/')

    act(() => setFileBrowserOpen(true))
    expect(rightButtons()).toContain('Swap sidebar sides')

    act(() => setFileBrowserOpen(false))
    expect(rightButtons()).toEqual(['Notifications', 'Show right sidebar'])
  })

  it('counts on the bell the notifications not opened yet, whether the sidebar is open or not', () => {
    recordFeedItem({ kind: 'scheduled', title: 'Nightly report' })
    recordFeedItem({ kind: 'agent', title: 'Wrote the migration' })
    renderControls('/')

    expect(rightButtons()).toEqual(['Notifications · 2 unread notifications', 'Show right sidebar'])

    act(() => setFileBrowserOpen(true))
    expect(rightButtons()).toContain('Notifications · 2 unread notifications')
  })

  it('does not take app actions placed on the left away with the sidebar', () => {
    setTitlebarAppActionsSide('left')
    renderControls('/')

    expect(within(screen.getByLabelText('Window controls')).getByLabelText('Layout editor')).toBeTruthy()
    expect(rightButtons()).toEqual(['Notifications', 'Show right sidebar'])
  })
})
