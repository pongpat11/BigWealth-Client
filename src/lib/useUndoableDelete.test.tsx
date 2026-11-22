import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import { reinsert, UNDO_MS, useUndoableDelete } from './useUndoableDelete'

type Row = { id: string; name: string }
const rows: Row[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
]

function Harness({ commit }: { commit: (id: string) => Promise<unknown> }) {
  const [items, setItems] = useState(rows)
  const { remove, toast } = useUndoableDelete()
  return (
    <>
      {items.map((r, i) => (
        <button
          key={r.id}
          onClick={() =>
            remove({
              message: `Deleted ${r.name}`,
              hide: () => setItems((l) => l.filter((x) => x.id !== r.id)),
              restore: () => setItems((l) => reinsert(l, r, i)),
              commit: () => commit(r.id),
            })
          }
        >
          {r.name}
        </button>
      ))}
      {toast}
    </>
  )
}

const click = (name: string) => act(() => screen.getByRole('button', { name }).click())

describe('useUndoableDelete', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('hides at once and calls the API only after the undo window', async () => {
    const commit = vi.fn().mockResolvedValue(undefined)
    render(<Harness commit={commit} />)

    click('Alpha')
    expect(screen.queryByRole('button', { name: 'Alpha' })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Deleted Alpha')
    expect(commit).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(UNDO_MS))
    expect(commit).toHaveBeenCalledWith('a')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('Undo restores the row in place and never calls the API', async () => {
    const commit = vi.fn()
    render(<Harness commit={commit} />)

    click('Alpha')
    click('Undo')
    await act(() => vi.advanceTimersByTimeAsync(UNDO_MS * 2))

    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Alpha', 'Bravo'])
    expect(commit).not.toHaveBeenCalled()
  })

  it('restores the row and shows the reason when the server refuses', async () => {
    const commit = vi.fn().mockRejectedValue(new ApiError(409, 'Account has transactions'))
    render(<Harness commit={commit} />)

    click('Alpha')
    await act(() => vi.advanceTimersByTimeAsync(UNDO_MS))

    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/account has transactions/i)
  })

  it('a second delete sends the first straight away', () => {
    const commit = vi.fn().mockResolvedValue(undefined)
    render(<Harness commit={commit} />)

    click('Alpha')
    click('Bravo')
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledWith('a')
    expect(screen.getByRole('status')).toHaveTextContent('Deleted Bravo')
  })

  it('leaving the screen sends the pending delete instead of dropping it', () => {
    const commit = vi.fn().mockResolvedValue(undefined)
    const { unmount } = render(<Harness commit={commit} />)

    click('Alpha')
    unmount()
    expect(commit).toHaveBeenCalledWith('a')
  })
})

describe('reinsert', () => {
  it('puts an item back at its index, clamped, without duplicating', () => {
    const c = { id: 'c', name: 'C' }
    expect(reinsert(rows, c, 1).map((r) => r.id)).toEqual(['a', 'c', 'b'])
    expect(reinsert(rows, c, 99).map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(reinsert(rows, rows[0], 1)).toBe(rows)
  })
})
