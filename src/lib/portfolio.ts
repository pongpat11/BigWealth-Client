import { t } from '@/lib/i18n'
// Portfolio API client: investment holdings and dividends. Prices are entered
// by hand, or kept current by the server for SET, US and crypto holdings with
// autoPrice on. The server converts USD to THB with a daily reference rate.
import { apiFetch } from './api'
import { getAccessToken } from './auth'
import type { Currency } from '@/types'

export const ASSET_CLASSES = ['set', 'us', 'fund', 'crypto', 'gold', 'cash'] as const
export type AssetClass = (typeof ASSET_CLASSES)[number]

/** Classes the server can price automatically from the market feed. */
export const AUTO_PRICE_CLASSES: readonly AssetClass[] = ['set', 'us', 'crypto', 'gold']

/** Labels and chart colours (DESIGN_SPEC §3 categorical palette). */
export const ASSET_CLASS_META: Record<AssetClass, { label: string; color: string }> = {
  set: { label: t('Thai Stocks'), color: '#059669' },
  us: { label: t('US Stocks'), color: '#6366f1' },
  fund: { label: t('Funds'), color: '#0ea5e9' },
  crypto: { label: t('Crypto'), color: '#f59e0b' },
  gold: { label: t('Gold'), color: '#fbbf24' },
  cash: { label: t('Cash'), color: '#94a3b8' },
}

export interface Fx {
  /** THB per 1 USD, or null when no rate is available. */
  usdThb: number | null
  date: string | null
}

export interface Holding {
  id: string
  /** Investment account holding it; null when not assigned yet. */
  accountId?: string | null
  symbol: string
  name: string | null
  assetClass: AssetClass
  currency: Currency
  quantity: number
  /** Per unit, in the holding's currency. */
  avgCost: number
  price: number
  priceUpdatedAt: string
  /** true when the server keeps the price current from the market. */
  autoPrice?: boolean
  marketValue: number
  costBasis: number
  /** null when the holding is USD and there is no exchange rate. */
  marketValueTHB: number | null
  costBasisTHB: number | null
  gainPct: number | null
}

export interface HoldingInput {
  symbol: string
  name: string | null
  assetClass: AssetClass
  currency: Currency
  quantity: number
  avgCost: number
  /** Optional when autoPrice is on: the server looks it up. */
  price?: number
  autoPrice: boolean
  /** Investment account that holds it (the form requires one). */
  accountId?: string
}

export interface Portfolio {
  fx: Fx
  totalValueTHB: number
  totalCostTHB: number
  totalGainTHB: number
  totalGainPct: number | null
  /** Holdings left out of the totals for lack of an exchange rate. */
  unconvertedCount: number
  holdings: Holding[]
  allocation: { assetClass: AssetClass; valueTHB: number; pct: number }[]
}

export interface Dividend {
  id: string
  accountId?: string | null
  symbol: string
  payDate: string // 'YYYY-MM-DD'
  currency: Currency
  gross: number
  withholdingTax: number
  net: number
  netTHB: number | null
}

export interface DividendInput {
  symbol: string
  payDate: string
  currency: Currency
  gross: number
  withholdingTax: number
  accountId?: string
}

export interface DividendList {
  fx: Fx
  totalGrossTHB: number
  totalTaxTHB: number
  totalNetTHB: number
  unconvertedCount: number
  items: Dividend[]
}

function auth() {
  return { token: getAccessToken() ?? undefined }
}

/** Account filter: an account id, or `none` for holdings without one. */
export const NO_ACCOUNT = 'none'

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

/** Holdings and totals; pass `accountId` (or NO_ACCOUNT) to narrow to one account. */
export async function getPortfolio(accountId?: string): Promise<Portfolio> {
  return apiFetch<Portfolio>(`/portfolio${query({ accountId })}`, auth())
}

export async function createHolding(input: HoldingInput): Promise<Holding> {
  return apiFetch<Holding>('/holdings', { method: 'POST', body: input, ...auth() })
}

export async function updateHolding(id: string, input: Partial<HoldingInput>): Promise<Holding> {
  return apiFetch<Holding>(`/holdings/${id}`, { method: 'PATCH', body: input, ...auth() })
}

export async function deleteHolding(id: string): Promise<void> {
  await apiFetch<void>(`/holdings/${id}`, { method: 'DELETE', ...auth() })
}

/** Dividends, newest first. Omit `year` for all of them, `accountId` for every account. */
export async function listDividends(year?: number, accountId?: string): Promise<DividendList> {
  return apiFetch<DividendList>(`/dividends${query({ year: year || undefined, accountId })}`, auth())
}

export async function createDividend(input: DividendInput): Promise<Dividend> {
  return apiFetch<Dividend>('/dividends', { method: 'POST', body: input, ...auth() })
}

export async function deleteDividend(id: string): Promise<void> {
  await apiFetch<void>(`/dividends/${id}`, { method: 'DELETE', ...auth() })
}

export type HoldingSort = 'value' | 'gain' | 'symbol'

/** Larger value first. Compares in THB when both have it, otherwise in the
 * holdings' own currency when they share one (no exchange rate available). */
function compareValue(a: Holding, b: Holding): number {
  if (a.marketValueTHB !== null && b.marketValueTHB !== null) {
    return b.marketValueTHB - a.marketValueTHB
  }
  if (a.currency === b.currency) return b.marketValue - a.marketValue
  // Mixed currencies without a rate can't be compared: known THB values first.
  return Number(a.marketValueTHB === null) - Number(b.marketValueTHB === null)
}

/**
 * Holdings in display order: largest value first, best return first, or by
 * symbol. Holdings without a return go last when sorting by gain.
 */
export function sortHoldings(rows: Holding[], by: HoldingSort): Holding[] {
  return [...rows].sort((a, b) => {
    if (by === 'symbol') return a.symbol.localeCompare(b.symbol)
    if (by === 'value') return compareValue(a, b) || a.symbol.localeCompare(b.symbol)
    const last = Number.NEGATIVE_INFINITY
    const diff = (b.gainPct ?? last) - (a.gainPct ?? last)
    return (Number.isNaN(diff) ? 0 : diff) || a.symbol.localeCompare(b.symbol)
  })
}
