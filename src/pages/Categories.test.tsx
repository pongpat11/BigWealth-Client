import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Categories } from './Categories'
import * as api from '@/lib/categories'

vi.mock('@/lib/categories', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

const food = {
  id: 'food',
  name: 'Food & Dining',
  kind: 'expense' as const,
  parentId: null,
  icon: 'UtensilsCrossed',
  color: '#f59e0b',
  isDefault: true,
}
const restaurants = {
  id: 'restaurants',
  name: 'Restaurants',
  kind: 'expense' as const,
  parentId: 'food',
  icon: null,
  color: null,
  isDefault: true,
}
const sideHustle = {
  id: 'side-hustle',
  name: 'Side Hustle',
  kind: 'income' as const,
  parentId: null,
  icon: null,
  color: null,
  isDefault: false,
}

describe('Categories page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('groups defaults and custom categories, with nested sub-categories', async () => {
    vi.mocked(api.listCategories).mockResolvedValue([food, restaurants, sideHustle])
    render(<Categories />)

    expect(await screen.findByText('Food & Dining')).toBeInTheDocument()
    expect(screen.getByText('Restaurants')).toBeInTheDocument()
    expect(screen.getByText('Side Hustle')).toBeInTheDocument()
    // default category shows a lock badge, not an Edit link
    expect(screen.getAllByText('Default').length).toBeGreaterThan(0)
  })

  it('shows an empty state when there are no custom categories', async () => {
    vi.mocked(api.listCategories).mockResolvedValue([food, restaurants])
    render(<Categories />)
    expect(await screen.findByText(/no custom categories yet/i)).toBeInTheDocument()
  })

  it('creates a new top-level category', async () => {
    vi.mocked(api.listCategories).mockResolvedValue([])
    vi.mocked(api.createCategory).mockResolvedValue({
      id: 'new-1',
      name: 'Pets',
      kind: 'expense',
      parentId: null,
      icon: null,
      color: null,
      isDefault: false,
    })
    const user = userEvent.setup()
    render(<Categories />)
    await screen.findByText(/no custom categories yet/i)

    await user.click(screen.getByRole('button', { name: /^new$/i }))
    await user.type(screen.getByLabelText(/name/i), 'Pets')
    await user.click(screen.getByRole('button', { name: /add category/i }))

    await waitFor(() =>
      expect(api.createCategory).toHaveBeenCalledWith({ name: 'Pets', kind: 'expense' }),
    )
    expect(await screen.findByText('Pets')).toBeInTheDocument()
  })

  it('adds a sub-category under a default category', async () => {
    vi.mocked(api.listCategories).mockResolvedValue([food])
    vi.mocked(api.createCategory).mockResolvedValue({
      id: 'sushi',
      name: 'Sushi',
      kind: 'expense',
      parentId: 'food',
      icon: null,
      color: null,
      isDefault: false,
    })
    const user = userEvent.setup()
    render(<Categories />)

    await user.click(await screen.findByText(/add sub-category/i))
    await user.type(screen.getByPlaceholderText(/sub-category name/i), 'Sushi')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(api.createCategory).toHaveBeenCalledWith({
        name: 'Sushi',
        kind: 'expense',
        parentId: 'food',
      }),
    )
    expect(await screen.findByText('Sushi')).toBeInTheDocument()
  })

  it('deletes a custom sub-category with a two-tap confirm', async () => {
    vi.mocked(api.listCategories).mockResolvedValue([sideHustle, { ...restaurants, id: 'freelance', name: 'Freelance', parentId: 'side-hustle', isDefault: false }])
    vi.mocked(api.deleteCategory).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Categories />)

    await screen.findByText('Freelance')
    const deleteButtons = screen.getAllByText('×')
    await user.click(deleteButtons[0])
    await user.click(screen.getByText(/confirm\?/i))

    await waitFor(() => expect(api.deleteCategory).toHaveBeenCalledWith('freelance'))
    expect(screen.queryByText('Freelance')).not.toBeInTheDocument()
  })

  it('deletes a custom top-level category via the API (not just local state)', async () => {
    vi.mocked(api.listCategories).mockResolvedValue([sideHustle])
    vi.mocked(api.deleteCategory).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Categories />)

    await screen.findByText('Side Hustle')
    // Only one delete affordance exists here: the category's own (no sub-categories).
    const deleteButtons = screen.getAllByText('×')
    await user.click(deleteButtons[0])
    await user.click(screen.getByText(/confirm\?/i))

    await waitFor(() => expect(api.deleteCategory).toHaveBeenCalledWith('side-hustle'))
    expect(screen.queryByText('Side Hustle')).not.toBeInTheDocument()
  })
})
