/** Brain (Pro Mode): three tabs under the agent, and All files always has a way back to Changed. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

vi.mock('@/app/contrib/panes', () => ({
  FilesPane: () => <p>file tree</p>,
  ReviewPaneContent: () => <p>review pane</p>
}))
vi.mock('./progress-tab', () => ({ ProgressTab: () => <p>progress page</p> }))
vi.mock('./activity-tab', () => ({ ActivityTab: () => <p>activity page</p> }))
vi.mock('./agent-header', () => ({ AgentHeader: () => <p>agent</p> }))

const { ProPanel } = await import('./pro-panel')

afterEach(cleanup)

describe('ProPanel', () => {
  it('opens on Progress, and moves between Changed and All files both ways', () => {
    render(
      <I18nProvider configClient={null} initialLocale="en">
        <ProPanel />
      </I18nProvider>
    )

    expect(screen.getByText('progress page')).toBeTruthy()
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Progress', 'Activity', 'Changes'])

    fireEvent.click(screen.getByRole('tab', { name: 'Changes' }))
    expect(screen.getByText('review pane')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'All files' }))
    expect(screen.getByText('file tree')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Changed' }))
    expect(screen.getByText('review pane')).toBeTruthy()
  })
})
