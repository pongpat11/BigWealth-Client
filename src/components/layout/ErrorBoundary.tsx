import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/**
 * Catches render errors in a screen so one broken page doesn't blank the whole
 * app. Give it a `key` (e.g. the route path) to reset when the user navigates.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-14 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/10 text-[var(--color-loss)]">
          <TriangleAlert size={22} aria-hidden />
        </span>
        <p className="text-sm font-semibold text-[var(--color-ink)]">
          Something went wrong on this screen
        </p>
        <p className="max-w-xs text-xs text-[var(--color-muted)]">
          Your data is safe. Try again, or pick another screen from the menu.
        </p>
        <Button size="sm" onClick={() => this.setState({ failed: false })}>
          Try again
        </Button>
      </div>
    )
  }
}
