import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RequireAuth } from './RequireAuth'
import * as auth from '@/lib/auth'

vi.mock('@/lib/auth', () => ({ isAuthenticated: vi.fn() }))

function renderGuarded(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login-page</div>} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<div>protected-content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  it('redirects to /login when unauthenticated', () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(false)
    renderGuarded('/')
    expect(screen.getByText('login-page')).toBeInTheDocument()
    expect(screen.queryByText('protected-content')).not.toBeInTheDocument()
  })

  it('renders the protected content when authenticated', () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(true)
    renderGuarded('/')
    expect(screen.getByText('protected-content')).toBeInTheDocument()
  })
})
