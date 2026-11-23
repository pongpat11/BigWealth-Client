import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Settings } from './Settings'
import * as auth from '@/lib/auth'
import { reloadPage } from '@/lib/i18n'

vi.mock('@/lib/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/i18n')>()),
  reloadPage: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  me: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  logout: vi.fn(),
}))

const user = {
  id: 'u1',
  email: 'me@example.com',
  name: 'Pong',
  createdAt: '2026-07-01T00:00:00.000Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  )
}

async function fillPasswords(current: string, next: string, confirm: string) {
  const u = userEvent.setup()
  if (current) await u.type(screen.getByLabelText('Current password'), current)
  await u.type(screen.getByLabelText('New password'), next)
  await u.type(screen.getByLabelText('Confirm new password'), confirm)
  await u.click(screen.getByRole('button', { name: /change password/i }))
}

describe('Settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    vi.mocked(auth.me).mockResolvedValue(user)
  })

  it('shows the profile and saves a new display name', async () => {
    vi.mocked(auth.updateProfile).mockResolvedValue({ ...user, name: 'Big' })
    const u = userEvent.setup()
    renderPage()

    expect(await screen.findByText('me@example.com')).toBeInTheDocument()
    const name = screen.getByLabelText(/display name/i)
    expect(name).toHaveValue('Pong')
    // Nothing to save until the name changes.
    expect(screen.getByRole('button', { name: /save profile/i })).toBeDisabled()

    await u.clear(name)
    await u.type(name, 'Big')
    await u.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => expect(auth.updateProfile).toHaveBeenCalledWith('Big'))
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
  })

  it('switches to dark mode and remembers it', async () => {
    const u = userEvent.setup()
    renderPage()
    await screen.findByText('me@example.com')

    await u.click(screen.getByRole('button', { name: 'Dark' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('bw.theme')).toBe('dark')

    await u.click(screen.getByRole('button', { name: 'Light' }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('switches the language and reloads to apply it', async () => {
    const u = userEvent.setup()
    renderPage()
    await screen.findByText('me@example.com')
    const language = screen.getByRole('group', { name: 'Language' })
    // Defaults to following the device, like the theme.
    expect(within(language).getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true')

    await u.click(within(language).getByRole('button', { name: 'ไทย' }))
    expect(localStorage.getItem('bw.language')).toBe('th')
    expect(reloadPage).toHaveBeenCalledTimes(1)

    // Back to the language already showing: nothing to reload.
    await u.click(within(language).getByRole('button', { name: 'English' }))
    expect(localStorage.getItem('bw.language')).toBe('en')
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })

  it('rejects mismatched or too-short new passwords without calling the API', async () => {
    renderPage()
    await screen.findByText('me@example.com')

    await fillPasswords('old-password', 'short', 'short')
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8 characters/i)

    await userEvent.clear(screen.getByLabelText('New password'))
    await userEvent.clear(screen.getByLabelText('Confirm new password'))
    await fillPasswords('', 'new-password-1', 'new-password-2')
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i)

    expect(auth.changePassword).not.toHaveBeenCalled()
  })

  it('changes the password and clears the form', async () => {
    vi.mocked(auth.changePassword).mockResolvedValue(undefined)
    renderPage()
    await screen.findByText('me@example.com')

    await fillPasswords('old-password', 'new-password', 'new-password')

    await waitFor(() =>
      expect(auth.changePassword).toHaveBeenCalledWith('old-password', 'new-password'),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(/password changed/i)
    expect(screen.getByLabelText('Current password')).toHaveValue('')
  })

  it('logs out', async () => {
    vi.mocked(auth.logout).mockResolvedValue(undefined)
    const u = userEvent.setup()
    renderPage()
    await screen.findByText('me@example.com')

    await u.click(screen.getByRole('button', { name: /log out/i }))
    await waitFor(() => expect(auth.logout).toHaveBeenCalled())
  })
})
