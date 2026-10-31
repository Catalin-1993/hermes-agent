/**
 * A wall around each Kanban view: a view that throws while it draws shows its own small error with "Try again",
 * the top bar and the other views keep working, and moving to another tab starts the view afresh. The error and
 * where it happened go to the console (and the app's log), so it can be found and fixed.
 *
 * A failure on a view is drawn again quietly, twice, a moment apart (React's own instant retry is not enough: the
 * failures seen so far came from a passing state while switching views that settles within a fraction of a second,
 * and drawing again a little later has always worked). Only a failure that outlasts both is shown, with "Copy
 * details" so what happened can be sent and fixed.
 */

import { Button, Codicon } from '@hermes/plugin-sdk'
import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Milliseconds before each quiet redraw. */
const QUIET_DELAYS = [150, 600]

interface Props {
  children: ReactNode
  view: string
}

interface State {
  error: Error | null
  /** Being drawn again: show nothing for the instant it takes. */
  quiet: boolean
  /** Where in the view it failed, for "Copy details". */
  where: string
}

export class FaceBoundary extends Component<Props, State> {
  state: State = { error: null, quiet: false, where: '' }

  /** Quiet redraws left for this view, each after a longer pause. */
  private retries = QUIET_DELAYS.length
  private timer: ReturnType<typeof setTimeout> | undefined

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[kanban] the ${this.props.view} view failed to draw`, error, info.componentStack)
    const quiet = this.retries > 0

    if (quiet) {
      const delay = QUIET_DELAYS[QUIET_DELAYS.length - this.retries]
      this.retries -= 1
      this.timer = setTimeout(() => this.setState({ error: null, quiet: false }), delay)
    }

    this.setState({ quiet, where: info.componentStack ?? '' })
  }

  componentDidUpdate(previous: Props) {
    // A new tab is a fresh start, with its own quiet redraw.
    if (previous.view !== this.props.view) {
      this.retries = QUIET_DELAYS.length

      if (this.state.error) {
        this.setState({ error: null, quiet: false })
      }
    }
  }

  componentWillUnmount() {
    clearTimeout(this.timer)
  }

  private details() {
    const { error, where } = this.state

    return [`Kanban view: ${this.props.view}`, `${error?.name}: ${error?.message}`, error?.stack ?? '', where].join(
      '\n'
    )
  }

  render() {
    const { error, quiet } = this.state

    if (!error) {
      return this.props.children
    }

    if (quiet) {
      return null
    }

    return (
      <div className="grid flex-1 place-items-center p-6" data-kanban-face-error={this.props.view}>
        <div className="flex max-w-md flex-col items-center gap-2 text-center">
          <Codicon className="text-[#f87171]" name="warning" size="1.2rem" />
          <p className="text-[0.9375rem] font-medium text-foreground">This view hit a problem</p>
          <p className="text-[0.8125rem] break-words text-(--ui-text-tertiary)">{error.message}</p>
          <div className="flex items-center gap-2">
            <Button onClick={() => this.setState({ error: null })} size="sm" variant="outline">
              <Codicon name="refresh" size="0.8rem" />
              Try again
            </Button>
            <Button onClick={() => void navigator.clipboard?.writeText(this.details())} size="sm" variant="ghost">
              <Codicon name="copy" size="0.8rem" />
              Copy details
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
