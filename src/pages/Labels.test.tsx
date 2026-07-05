import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Labels } from './Labels'
import * as api from '@/lib/labels'

vi.mock('@/lib/labels', () => ({
  listLabels: vi.fn(),
  createLabel: vi.fn(),
  updateLabel: vi.fn(),
  deleteLabel: vi.fn(),
}))

const work = { id: 'work', name: 'Work', color: '#6366f1', isDefault: true }
const vacation = { id: 'vacation', name: 'Vacation', color: '#ec4899', isDefault: false }

describe('Labels page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('groups defaults and custom labels', async () => {
    vi.mocked(api.listLabels).mockResolvedValue([work, vacation])
    render(<Labels />)

    expect(await screen.findByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Vacation')).toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()
  })

  it('shows an empty state when there are no custom labels', async () => {
    vi.mocked(api.listLabels).mockResolvedValue([work])
    render(<Labels />)
    expect(await screen.findByText(/no custom labels yet/i)).toBeInTheDocument()
  })

  it('creates a new label', async () => {
    vi.mocked(api.listLabels).mockResolvedValue([])
    vi.mocked(api.createLabel).mockResolvedValue({
      id: 'new-1',
      name: 'Business',
      color: null,
      isDefault: false,
    })
    const user = userEvent.setup()
    render(<Labels />)
    await screen.findByText(/no custom labels yet/i)

    await user.click(screen.getByRole('button', { name: /^new$/i }))
    await user.type(screen.getByLabelText(/name/i), 'Business')
    await user.click(screen.getByRole('button', { name: /add label/i }))

    await waitFor(() => expect(api.createLabel).toHaveBeenCalledWith({ name: 'Business' }))
    expect(await screen.findByText('Business')).toBeInTheDocument()
  })

  it('deletes a custom label with a two-tap confirm, via the API', async () => {
    vi.mocked(api.listLabels).mockResolvedValue([vacation])
    vi.mocked(api.deleteLabel).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Labels />)

    await user.click(await screen.findByRole('button', { name: /^delete$/i }))
    await user.click(screen.getByRole('button', { name: /confirm delete/i }))

    await waitFor(() => expect(api.deleteLabel).toHaveBeenCalledWith('vacation'))
    expect(screen.queryByText('Vacation')).not.toBeInTheDocument()
  })

  it('does not show Edit/Delete for a default label', async () => {
    vi.mocked(api.listLabels).mockResolvedValue([work])
    render(<Labels />)
    await screen.findByText('Work')
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
  })
})
