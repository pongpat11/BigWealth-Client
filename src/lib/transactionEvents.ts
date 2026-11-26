// A transaction made or removed outside the screen on show (by quick add or
// its Undo). A screen that can update itself in place handles the event and
// claims it; otherwise the app shell reloads the screen.
import { useEffect, useRef } from 'react'
import type { Transaction } from './transactions'

const EVENT = 'bw:transaction-changed'

export type TransactionChange =
  | { kind: 'created'; tx: Transaction }
  | { kind: 'deleted'; tx: Transaction }

/** Announce a change. Returns true when a screen handled it in place. */
export function announceTransactionChange(change: TransactionChange): boolean {
  const event = new CustomEvent<TransactionChange>(EVENT, { detail: change, cancelable: true })
  // dispatchEvent returns false once a listener called preventDefault().
  return !window.dispatchEvent(event)
}

/**
 * Handle changes in place. The latest `handler` runs on each change; the
 * change counts as handled (no screen reload) while this is mounted.
 */
export function useTransactionChanges(handler: (change: TransactionChange) => void): void {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    function listener(e: Event) {
      e.preventDefault()
      latest.current((e as CustomEvent<TransactionChange>).detail)
    }
    window.addEventListener(EVENT, listener)
    return () => window.removeEventListener(EVENT, listener)
  }, [])
}
