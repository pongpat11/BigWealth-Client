import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Goals } from './Goals'
import * as api from '@/lib/goals'
import type { Goal } from '@/lib/goals'

vi.mock('@/lib/goals', async (importOriginal) => ({
  // Keep the pure goalPlan() helper; stub only the network calls.
  ...(await importOriginal<typeof import('@/lib/goals')>()),
  listGoals: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
}))

const macbook: Goal = {
  id: 'g1',
  name: 'New MacBook',
  target: 75000,
  saved: 30000,
  deadline: null,
  createdAt: '2026-07-01T00:00:00.000Z',
}
const done: Goal = { ...macbook, id: 'g2', name: 'Japan trip', target: 40000, saved: 40000 }

describe('goalPlan', () => {
  const today = new Date(2026, 6, 15) // 15 Jul 2026

  it('spreads what is left over the months remaining', () => {
    const plan = api.goalPlan({ target: 75000, saved: 71000, deadline: '2026-09-15' }, today)
    expect(plan).toMatchObject({ remaining: 4000, monthsLeft: 2, perMonth: 2000, overdue: false })
  })

  it('counts a partial month as a month and never divides by zero', () => {
    expect(
      api.goalPlan({ target: 1000, saved: 0, deadline: '2026-07-20' }, today),
    ).toMatchObject({ monthsLeft: 1, perMonth: 1000 })
    expect(
      api.goalPlan({ target: 1000, saved: 0, deadline: '2026-07-15' }, today),
    ).toMatchObject({ monthsLeft: 1, perMonth: 1000 })
  })

  it('flags a missed deadline instead of suggesting a contribution', () => {
    expect(
      api.goalPlan({ target: 1000, saved: 0, deadline: '2026-07-01' }, today),
    ).toMatchObject({ overdue: true, perMonth: null })
  })

  it('has no plan once the goal is reached or when there is no deadline', () => {
    expect(api.goalPlan({ target: 1000, saved: 1200, deadline: '2027-01-01' }, today)).toMatchObject({
      remaining: 0,
      perMonth: null,
    })
    expect(api.goalPlan({ target: 1000, saved: 0, deadline: null }, today).monthsLeft).toBeNull()
  })
})

describe('Goals page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows progress and what is left for each goal', async () => {
    vi.mocked(api.listGoals).mockResolvedValue([done, macbook])
    render(<Goals />)

    expect(await screen.findByText('New MacBook')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('฿45,000 to go')).toBeInTheDocument()
    expect(screen.getByText('Goal reached')).toBeInTheDocument()
    // Reached goals are listed after the ones still in progress.
    const names = screen.getAllByRole('button', { name: /edit goal/i }).map((b) => b.ariaLabel)
    expect(names).toEqual(['Edit goal New MacBook', 'Edit goal Japan trip'])
  })

  it('shows an empty state when there are no goals', async () => {
    vi.mocked(api.listGoals).mockResolvedValue([])
    render(<Goals />)
    expect(await screen.findByText(/no goals yet/i)).toBeInTheDocument()
  })

  it('creates a goal', async () => {
    vi.mocked(api.listGoals).mockResolvedValue([])
    vi.mocked(api.createGoal).mockResolvedValue({ ...macbook, id: 'g3', name: 'Emergency fund' })
    const user = userEvent.setup()
    render(<Goals />)
    await screen.findByText(/no goals yet/i)

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText(/name/i), 'Emergency fund')
    await user.type(screen.getByLabelText(/target/i), '300000')
    await user.click(screen.getByRole('button', { name: /add goal/i }))

    await waitFor(() =>
      expect(api.createGoal).toHaveBeenCalledWith({
        name: 'Emergency fund',
        target: 300000,
        saved: 0,
        deadline: null,
      }),
    )
    expect(await screen.findByText('Emergency fund')).toBeInTheDocument()
  })

  it('rejects a goal without a target', async () => {
    vi.mocked(api.listGoals).mockResolvedValue([])
    const user = userEvent.setup()
    render(<Goals />)
    await screen.findByText(/no goals yet/i)

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText(/name/i), 'Car')
    await user.click(screen.getByRole('button', { name: /add goal/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/target greater than 0/i)
    expect(api.createGoal).not.toHaveBeenCalled()
  })

  it('updates the saved amount from the edit form', async () => {
    vi.mocked(api.listGoals).mockResolvedValue([macbook])
    vi.mocked(api.updateGoal).mockResolvedValue({ ...macbook, saved: 75000 })
    const user = userEvent.setup()
    render(<Goals />)

    await user.click(await screen.findByRole('button', { name: /edit goal new macbook/i }))
    const saved = screen.getByLabelText(/saved so far/i)
    await user.clear(saved)
    await user.type(saved, '75000')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(api.updateGoal).toHaveBeenCalledWith('g1', expect.objectContaining({ saved: 75000 })),
    )
    expect(await screen.findByText('Goal reached')).toBeInTheDocument()
  })

  it('deletes a goal with a two-tap confirm', async () => {
    vi.mocked(api.listGoals).mockResolvedValue([macbook])
    vi.mocked(api.deleteGoal).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Goals />)

    await user.click(await screen.findByRole('button', { name: /edit goal new macbook/i }))
    await user.click(screen.getByRole('button', { name: /delete goal/i }))
    await user.click(screen.getByRole('button', { name: /tap again to delete/i }))

    await waitFor(() => expect(api.deleteGoal).toHaveBeenCalledWith('g1'))
    expect(await screen.findByText(/no goals yet/i)).toBeInTheDocument()
  })
})
