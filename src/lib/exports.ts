// Exports API client: CSV downloads and the yearly tax summary that the
// Export screen prints (the browser's "Save as PDF" makes the PDF).
import { apiFetch } from './api'
import { getAccessToken } from './auth'
import { browserTimezone } from './format'

export interface TaxCategory {
  categoryId: string | null
  name: string
  amount: number
}

export interface TaxDividend {
  symbol: string
  currency: string
  count: number
  gross: number
  withholdingTax: number
  net: number
  grossTHB: number | null
  withholdingTaxTHB: number | null
  netTHB: number | null
}

export interface TaxSummary {
  year: number
  timezone: string
  generatedAt: string
  income: { total: number; byCategory: TaxCategory[] }
  expense: { total: number; byCategory: TaxCategory[] }
  /** Income/expenses in other currencies: counted, not converted. */
  nonThbTransactionCount: number
  dividends: {
    bySymbol: TaxDividend[]
    totalGrossTHB: number
    totalTaxTHB: number
    totalNetTHB: number
    unconvertedCount: number
    fxRate: number | null
    fxDate: string | null
  }
}

export type CsvKind = 'transactions' | 'dividends'

const auth = () => ({ token: getAccessToken() ?? undefined })

/** The CSV text for an inclusive date range ('YYYY-MM-DD'). */
export async function fetchCsv(kind: CsvKind, from: string, to: string): Promise<string> {
  const params = new URLSearchParams({ from, to, timezone: browserTimezone() })
  return apiFetch<string>(`/exports/${kind}.csv?${params}`, { ...auth(), responseType: 'text' })
}

export async function getTaxSummary(year: number): Promise<TaxSummary> {
  const params = new URLSearchParams({ year: String(year), timezone: browserTimezone() })
  return apiFetch<TaxSummary>(`/exports/tax-summary?${params}`, auth())
}

/** Hand the browser a text file to save. */
export function saveTextFile(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  // fetch().text() drops the BOM; put it back so Excel reads Thai as UTF-8.
  const body = type.startsWith('text/csv') && !text.startsWith('﻿') ? '﻿' + text : text
  const url = URL.createObjectURL(new Blob([body], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  // Safari needs the link in the document, and fetches the blob after click()
  // returns, so the URL must outlive this call.
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** 'YYYY-MM-DD' for a local date. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type RangePreset = 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear'

/** Inclusive [from, to] for a preset, relative to `today`. "This …" ends today. */
export function presetRange(preset: RangePreset, today: Date = new Date()): { from: string; to: string } {
  const y = today.getFullYear()
  const m = today.getMonth()
  switch (preset) {
    case 'thisMonth':
      return { from: localDateKey(new Date(y, m, 1)), to: localDateKey(today) }
    case 'lastMonth':
      return { from: localDateKey(new Date(y, m - 1, 1)), to: localDateKey(new Date(y, m, 0)) }
    case 'thisYear':
      return { from: `${y}-01-01`, to: localDateKey(today) }
    case 'lastYear':
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
  }
}
