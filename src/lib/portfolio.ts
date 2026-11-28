import { t } from '@/lib/i18n'
// Portfolio API client: investment holdings and dividends. Prices are entered
// by hand, or kept current by the server for SET, US, crypto and gold holdings
// with autoPrice on. The server converts USD to THB with a daily reference rate.
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

/** What one unit of gold is: a Thai baht-weight of 96.5% bar gold, or a troy ounce. */
export const GOLD_UNITS = ['baht', 'oz'] as const
export type GoldUnit = (typeof GOLD_UNITS)[number]

export const GOLD_UNIT_META: Record<GoldUnit, { label: string; short: string }> = {
  baht: { label: t('Baht-weight (96.5%)'), short: t('baht') },
  oz: { label: t('Troy ounce'), short: 'oz' },
}

/** Troy ounces of pure gold in one baht-weight of 96.5% bar gold (15.244 g). */
export const GOLD_OZ_PER_BAHT = (15.244 / 31.1034768) * 0.965

/** The unit the server assumes when none is given: ounces in dollars, baht-weight in baht. */
export function defaultGoldUnit(currency: Currency): GoldUnit {
  return currency === 'USD' ? 'oz' : 'baht'
}

/** The unit a gold holding counts (older rows without one follow the currency); null for other classes. */
export function goldUnitOf(h: Pick<Holding, 'assetClass' | 'goldUnit' | 'currency'>): GoldUnit | null {
  return h.assetClass === 'gold' ? (h.goldUnit ?? defaultGoldUnit(h.currency)) : null
}

/** "5,000" for most holdings; "2 baht" / "1.5 oz" for gold. */
export function holdingQuantityText(h: Pick<Holding, 'assetClass' | 'goldUnit' | 'currency' | 'quantity'>): string {
  const text = h.quantity.toLocaleString('en-US', { maximumFractionDigits: 8 })
  const unit = goldUnitOf(h)
  return unit ? `${text} ${GOLD_UNIT_META[unit].short}` : text
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
  /** Gold only: what `quantity` counts. */
  goldUnit?: GoldUnit | null
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
  /** Sent for gold only. */
  goldUnit?: GoldUnit
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
  /** Net dividends received to date (same account filter), in THB. Absent from older servers. */
  totalDividendsTHB?: number
  /** totalGainTHB + totalDividendsTHB. */
  totalReturnTHB?: number
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

/** One holding with the dividends it paid and its total return. */
export interface HoldingDetail extends Holding {
  fx: Fx
  /** Unrealised gain in THB; null when it can't be converted. */
  gainTHB: number | null
  /** Dividends on this symbol into the holding's account, newest first. */
  dividends: Dividend[]
  dividendsNetTHB: number
  /** Dividends left out of dividendsNetTHB for lack of an exchange rate. */
  dividendsUnconverted: number
  /** gainTHB + dividends, and as a % of the THB cost. */
  totalReturnTHB: number | null
  totalReturnPct: number | null
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

export async function getHolding(id: string): Promise<HoldingDetail> {
  return apiFetch<HoldingDetail>(`/holdings/${id}`, auth())
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

export async function updateDividend(id: string, input: Partial<DividendInput>): Promise<Dividend> {
  return apiFetch<Dividend>(`/dividends/${id}`, { method: 'PATCH', body: input, ...auth() })
}

export async function deleteDividend(id: string): Promise<void> {
  await apiFetch<void>(`/dividends/${id}`, { method: 'DELETE', ...auth() })
}

/**
 * Unrealised gain of a holding: in baht when it can be converted, otherwise
 * in the holding's own currency.
 */
export function holdingGain(h: Pick<Holding, 'marketValue' | 'costBasis' | 'marketValueTHB' | 'costBasisTHB' | 'currency'>): {
  amount: number
  currency: Currency
} {
  if (h.marketValueTHB !== null && h.costBasisTHB !== null) {
    return { amount: Math.round((h.marketValueTHB - h.costBasisTHB) * 100) / 100, currency: 'THB' }
  }
  return { amount: Math.round((h.marketValue - h.costBasis) * 100) / 100, currency: h.currency }
}

/** Baht value of the holdings that can be converted (the rest are left out). */
export function totalValueTHB(rows: Pick<Holding, 'marketValueTHB'>[]): number {
  return rows.reduce((sum, h) => sum + (h.marketValueTHB ?? 0), 0)
}

/**
 * Whole-number percentages that add up to exactly 100 (largest remainder),
 * so an allocation legend never reads 99% or 101%. All zeros stay zero.
 */
export function roundPercents(values: number[]): number[] {
  const total = values.reduce((a, b) => a + Math.max(0, b), 0)
  if (total <= 0) return values.map(() => 0)
  const exact = values.map((v) => (Math.max(0, v) / total) * 100)
  const floors = exact.map(Math.floor)
  let left = 100 - floors.reduce((a, b) => a + b, 0)
  const order = exact
    .map((v, i) => ({ i, rest: v - floors[i] }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i] += 1
    left -= 1
  }
  return floors
}

/** Withholding rate usually applied to dividends of this class, in percent. */
export function usualWithholdingPct(assetClass: AssetClass | undefined): number | null {
  if (assetClass === 'set') return 10
  if (assetClass === 'us') return 15
  return null
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
