// Formatting helpers. Base currency is THB (฿); all net-worth figures
// are assumed already converted to THB by the (future) FX layer.

const thb = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const thbPrecise = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** ฿1,234,567 — whole baht, no decimals. */
export function formatTHB(amount: number): string {
  return thb.format(amount)
}

/** ฿1,234.56 — for transaction-level precision. */
export function formatTHBPrecise(amount: number): string {
  return thbPrecise.format(amount)
}

/** Compact figure for large net-worth numbers: ฿1.2M, ฿850K. */
export function formatTHBCompact(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}฿${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}฿${(abs / 1_000).toFixed(1)}K`
  return `${sign}฿${abs.toFixed(0)}`
}

/** +12.4% / -3.1% with explicit sign. */
export function formatPercent(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

/** Signed amount with leading +/- for P&L and cash-flow rows. */
export function formatSignedTHB(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${sign}${formatTHB(Math.abs(amount))}`
}

/** Short date: 7 Jun (current year) or 7 Jun 25. */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: '2-digit' }
  return d.toLocaleDateString('en-GB', opts)
}

/** Days remaining until an ISO date (negative if past). */
export function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

/** The browser's IANA timezone, e.g. "Asia/Bangkok". */
export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Convert an ISO instant to a `<input type="datetime-local">` value
 * (`YYYY-MM-DDTHH:mm`), rendered in the given timezone (defaults to local).
 */
export function toDateTimeLocalValue(iso: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** Current time as a datetime-local value in the browser's zone. */
export function nowDateTimeLocalValue(): string {
  return toDateTimeLocalValue(new Date().toISOString())
}

/** Date + time shown in a specific timezone, e.g. "5 Jul 2026, 12:30". */
export function formatDateTime(iso: string, timeZone?: string | null): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: timeZone ?? undefined,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
