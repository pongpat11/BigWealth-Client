// Portfolio API client: investment holdings and dividends. Prices are entered
// by hand; the server converts USD to THB with a daily reference rate.
import { apiFetch } from './api'
import { getAccessToken } from './auth'
import type { Currency } from '@/types'

export const ASSET_CLASSES = ['set', 'us', 'fund', 'crypto', 'gold', 'cash'] as const
export type AssetClass = (typeof ASSET_CLASSES)[number]

/** Labels and chart colours (DESIGN_SPEC §3 categorical palette). */
export const ASSET_CLASS_META: Record<AssetClass, { label: string; color: string }> = {
  set: { label: 'Thai Stocks', color: '#059669' },
  us: { label: 'US Stocks', color: '#6366f1' },
  fund: { label: 'Funds', color: '#0ea5e9' },
  crypto: { label: 'Crypto', color: '#f59e0b' },
  gold: { label: 'Gold', color: '#fbbf24' },
  cash: { label: 'Cash', color: '#94a3b8' },
}

export interface Fx {
  /** THB per 1 USD, or null when no rate is available. */
  usdThb: number | null
  date: string | null
}

export interface Holding {
  id: string
  symbol: string
  name: string | null
  assetClass: AssetClass
  currency: Currency
  quantity: number
  /** Per unit, in the holding's currency. */
  avgCost: number
  price: number
  priceUpdatedAt: string
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
  price: number
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

export async function getPortfolio(): Promise<Portfolio> {
  return apiFetch<Portfolio>('/portfolio', auth())
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

/** Dividends, newest first. Omit `year` for all of them. */
export async function listDividends(year?: number): Promise<DividendList> {
  return apiFetch<DividendList>(`/dividends${year ? `?year=${year}` : ''}`, auth())
}

export async function createDividend(input: DividendInput): Promise<Dividend> {
  return apiFetch<Dividend>('/dividends', { method: 'POST', body: input, ...auth() })
}

export async function deleteDividend(id: string): Promise<void> {
  await apiFetch<void>(`/dividends/${id}`, { method: 'DELETE', ...auth() })
}
