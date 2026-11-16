import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'
import { ErrorBoundary } from './ErrorBoundary'
import { OfflineBanner } from './OfflineBanner'

vi.mock('@/lib/auth', () => ({
  isAuthenticated: vi.fn(() => true),
  logout: vi.fn(),
  getAccessToken: vi.fn(() => 'token'),
}))

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'))
  })
}

describe('OfflineBanner', () => {
  afterEach(() => vi.restoreAllMocks())

  it('appears while offline and goes away when the connection returns', () => {
    render(<OfflineBanner />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    setOnline(false)
    expect(screen.getByRole('status')).toHaveTextContent(/you're offline/i)

    setOnline(true)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows a fallback instead of crashing, and recovers on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let broken = true
    function Flaky() {
      if (broken) throw new Error('boom')
      return <p>all good</p>
    }
    const user = userEvent.setup()
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i)
    broken = false
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByText('all good')).toBeInTheDocument()
  })
})

describe('unknown routes', () => {
  it('shows a not-found screen inside the app shell', () => {
    render(
      <MemoryRouter initialEntries={['/no-such-page']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    // Still inside the shell, so navigation is available.
    expect(screen.getAllByRole('link', { name: /transactions/i }).length).toBeGreaterThan(0)
  })
})
