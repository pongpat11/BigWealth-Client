// A holding deleted on its own page is handed to the screen the user returns
// to (Portfolio or the account page), which hides it and offers Undo before
// the delete is sent. Kept in memory, not in navigation state, so the page can
// go back with history (no duplicate entry) and a reload never deletes again.
import { useEffect, useRef } from 'react'
import type { Holding } from './portfolio'

let pending: Holding | null = null

/** Leave a deleted holding for the next screen to pick up. */
export function handOffDeletedHolding(holding: Holding): void {
  pending = holding
}

/** The handed-off holding, once; null when there is none. */
export function takeDeletedHolding(): Holding | null {
  const holding = pending
  pending = null
  return holding
}

/**
 * Calls `handle` once after mount with a holding handed off by its page. Runs
 * on a timer so StrictMode's mount → unmount → mount doesn't commit the delete
 * (leaving a screen sends a pending delete straight away).
 */
export function useDeletedHolding(handle: (holding: Holding) => void): void {
  const latest = useRef(handle)
  useEffect(() => {
    latest.current = handle
  })
  useEffect(() => {
    const timer = setTimeout(() => {
      const holding = takeDeletedHolding()
      if (holding) latest.current(holding)
    }, 0)
    return () => clearTimeout(timer)
  }, [])
}
