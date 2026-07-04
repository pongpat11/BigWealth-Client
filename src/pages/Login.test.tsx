import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Login } from './Login'
import * as auth from '@/lib/auth'
import { ApiError } from '@/lib/api'

vi.mock('@/lib/auth', () => ({ login: vi.fn() }))

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<div>dashboard-home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Login page', () => {
  it('renders heading, fields, buttons and links', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
  })

  it('logs in and navigates to the dashboard on success', async () => {
    vi.mocked(auth.login).mockResolvedValueOnce({
      id: '1',
      email: 'a@b.com',
      name: null,
      createdAt: '',
    })
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(/email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(auth.login).toHaveBeenCalledWith('a@b.com', 'password123')
    expect(await screen.findByText('dashboard-home')).toBeInTheDocument()
  })

  it('shows an error message when login fails', async () => {
    vi.mocked(auth.login).mockRejectedValueOnce(
      new ApiError(401, 'Invalid email or password'),
    )
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(/email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /invalid email or password/i,
    )
  })
})
