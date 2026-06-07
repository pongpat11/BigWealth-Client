import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Login } from './Login'

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

describe('Login page', () => {
  it('renders the heading and tagline', () => {
    renderLogin()
    expect(
      screen.getByRole('heading', { name: /welcome back/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/sign in to your bigwealth account/i)).toBeInTheDocument()
  })

  it('renders email and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders the sign-in and Google buttons', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument()
  })

  it('renders forgot-password and sign-up links', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
  })
})
