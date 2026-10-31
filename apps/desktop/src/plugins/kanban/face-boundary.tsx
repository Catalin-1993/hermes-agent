/**
 * A wall around each Kanban view: a view that throws while it draws shows its own small error with "Try again",
 * the top bar and the other views keep working, and moving to another tab starts the view afresh. The error and
 * where it happened go to the console (and the app's log), so it can be found and fixed.
 */

import { Button, Codicon } from '@hermes/plugin-sdk'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  view: string
}

interface State {
  error: Error | null
}

export class FaceBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[kanban] the ${this.props.view} view failed to draw`, error, info.componentStack)
  }

  componentDidUpdate(previous: Props) {
    // A new tab is a fresh start.
    if (previous.view !== this.props.view && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    const { error } = this.state

    if (!error) {
      return this.props.children
    }

    return (
      <div className="grid flex-1 place-items-center p-6" data-kanban-face-error={this.props.view}>
        <div className="flex max-w-md flex-col items-center gap-2 text-center">
          <Codicon className="text-[#f87171]" name="warning" size="1.2rem" />
          <p className="text-[0.9375rem] font-medium text-foreground">This view hit a problem</p>
          <p className="text-[0.8125rem] break-words text-(--ui-text-tertiary)">{error.message}</p>
          <Button onClick={() => this.setState({ error: null })} size="sm" variant="outline">
            <Codicon name="refresh" size="0.8rem" />
            Try again
          </Button>
        </div>
      </div>
    )
  }
}
