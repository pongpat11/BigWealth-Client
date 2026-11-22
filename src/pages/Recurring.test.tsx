import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Recurring } from './Recurring'
import * as api from '@/lib/recurring'
import type { RecurringRule } from '@/lib/recurring'

vi.mock('@/lib/recurring', async (importOriginal) => ({
  // Keep the pure schedule helpers; stub only the network calls.
  ...(await importOriginal<typeof import('@/lib/recurring')>()),
  listRecurring: vi.fn(),
  createRecurring: vi.fn(),
  updateRecurring: vi.fn(),
  deleteRecurring: vi.fn(),
}))
vi.mock('@/lib/categories', () => ({
  listCategories: vi.fn().mockResolvedValue([
    { id: 'bills', name: 'Bills', kind: 'expense', parentId: null, icon: null, color: null, isDefault: true },
    { id: 'salary', name: 'Salary', kind: 'income', parentId: null, icon: null, color: null, isDefault: true },
  ]),
}))
vi.mock('@/lib/accounts', () => ({ listAccounts: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/labels', () => ({ listLabels: vi.fn().mockResolvedValue([]) }))

const netflix: RecurringRule = {
  id: 'r1',
  type: 'expense',
  amount: 419,
  currency: 'THB',
  categoryId: 'bills',
  subCategoryId: null,
  category: { id: 'bills', name: 'Bills', kind: 'expense', icon: null, color: null },
  subCategory: null,
  accountId: null,
  account: null,
  note: 'Netflix',
  labelIds: [],
  frequency: 'monthly',
  interval: 1,
  startDate: '2026-01-12',
  endDate: null,
  timezone: 'Asia/Bangkok',
  active: true,
  nextDate: '2026-12-12',
  createdAt: '2026-01-01T00:00:00.000Z',
}
const salary: RecurringRule = {
  ...netflix,
  id: 'r2',
  type: 'income',
  amount: 60000,
  categoryId: 'salary',
  category: { id: 'salary', name: 'Salary', kind: 'income', icon: null, color: null },
  note: 'Salary',
  startDate: '2026-01-25',
  nextDate: '2026-11-25',
}
const paused: RecurringRule = { ...netflix, id: 'r3', note: 'Gym', active: false, nextDate: null }

describe('schedule helpers', () => {
  it('describes schedules in words', () => {
    expect(api.describeSchedule(netflix)).toBe('Monthly on the 12th')
    expect(api.describeSchedule({ ...netflix, startDate: '2026-01-31', interval: 3 })).toBe(
      'Every 3 months on the 31st',
    )
    expect(
      api.describeSchedule({ frequency: 'weekly', interval: 2, startDate: '2026-11-23' }),
    ).toBe('Every 2 weeks on Mon')
    expect(api.describeSchedule({ frequency: 'yearly', interval: 1, startDate: '2026-03-01' })).toBe(
      'Yearly on 1 Mar',
    )
  })

  it('clamps month-end dates and finds the next one', () => {
    const r = { frequency: 'monthly' as const, interval: 1, startDate: '2026-01-31' }
    expect(api.occurrenceDate(r, 1)).toBe('2026-02-28')
    expect(api.nextOccurrenceOnOrAfter(r, '2026-04-02')).toBe('2026-04-30')
  })
})

describe('Recurring page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists rules soonest first, with paused ones last, and monthly totals', async () => {
    vi.mocked(api.listRecurring).mockResolvedValue([paused, netflix, salary])
    render(<Recurring />)

    await screen.findByText('Netflix')
    const titles = screen.getAllByRole('button', { name: /^Edit / }).map((b) => b.ariaLabel)
    expect(titles).toEqual(['Edit Salary', 'Edit Netflix', 'Edit Gym'])
    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getAllByText('Monthly on the 12th')).toHaveLength(2)
    expect(screen.getByText('฿60,000')).toBeInTheDocument() // in per month
    expect(screen.getByText('฿419')).toBeInTheDocument() // out per month
  })

  it('shows an empty state', async () => {
    vi.mocked(api.listRecurring).mockResolvedValue([])
    render(<Recurring />)
    expect(await screen.findByText(/nothing recurring yet/i)).toBeInTheDocument()
  })

  it('creates a monthly rule', async () => {
    vi.mocked(api.listRecurring).mockResolvedValue([])
    vi.mocked(api.createRecurring).mockResolvedValue(netflix)
    const user = userEvent.setup()
    render(<Recurring />)
    await screen.findByText(/nothing recurring yet/i)

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText('Amount'), '419')
    await screen.findByRole('option', { name: 'Bills' })
    await user.selectOptions(screen.getByLabelText('Category'), 'bills')
    await user.type(screen.getByLabelText(/note/i), 'Netflix')
    await user.click(screen.getByRole('button', { name: /add recurring/i }))

    await waitFor(() =>
      expect(api.createRecurring).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expense',
          amount: 419,
          categoryId: 'bills',
          note: 'Netflix',
          frequency: 'monthly',
          interval: 1,
          startDate: api.todayKey(),
          endDate: null,
          active: true,
        }),
      ),
    )
    expect(await screen.findByText('Netflix')).toBeInTheDocument()
  })

  it('rejects an end date before the start', async () => {
    vi.mocked(api.listRecurring).mockResolvedValue([])
    const user = userEvent.setup()
    render(<Recurring />)
    await screen.findByText(/nothing recurring yet/i)

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText('Amount'), '100')
    await screen.findByRole('option', { name: 'Bills' })
    await user.selectOptions(screen.getByLabelText('Category'), 'bills')
    await user.clear(screen.getByLabelText('Starts'))
    await user.type(screen.getByLabelText('Starts'), '2026-12-01')
    await user.type(screen.getByLabelText(/ends/i), '2026-11-01')
    await user.click(screen.getByRole('button', { name: /add recurring/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/before the start/i)
    expect(api.createRecurring).not.toHaveBeenCalled()
  })

  it('pauses a rule from the edit form', async () => {
    vi.mocked(api.listRecurring).mockResolvedValue([netflix])
    vi.mocked(api.updateRecurring).mockResolvedValue({ ...netflix, active: false, nextDate: null })
    const user = userEvent.setup()
    render(<Recurring />)

    await user.click(await screen.findByRole('button', { name: 'Edit Netflix' }))
    await user.click(screen.getByRole('checkbox', { name: /active/i }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(api.updateRecurring).toHaveBeenCalledWith('r1', expect.objectContaining({ active: false })),
    )
    expect(await screen.findByText('Paused')).toBeInTheDocument()
  })

  it('deletes a rule with an undo window', async () => {
    vi.mocked(api.listRecurring).mockResolvedValue([netflix])
    vi.mocked(api.deleteRecurring).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Recurring />)

    await user.click(await screen.findByRole('button', { name: 'Edit Netflix' }))
    await user.click(screen.getByRole('button', { name: /delete recurring/i }))
    expect(await screen.findByText(/nothing recurring yet/i)).toBeInTheDocument()
    expect(api.deleteRecurring).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    await waitFor(() => expect(api.deleteRecurring).toHaveBeenCalledWith('r1'))
  })
})
