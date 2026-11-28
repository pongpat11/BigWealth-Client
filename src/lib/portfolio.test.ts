import { describe, expect, it } from 'vitest'
import { holdingGain, roundPercents, sortHoldings, type Holding } from './portfolio'

const h = (symbol: string, valueTHB: number | null, gainPct: number | null): Holding => ({
  id: symbol,
  symbol,
  name: null,
  assetClass: 'set',
  currency: 'THB',
  quantity: 1,
  avgCost: 1,
  price: 1,
  priceUpdatedAt: '2026-11-20T00:00:00.000Z',
  marketValue: valueTHB ?? 1,
  costBasis: 1,
  marketValueTHB: valueTHB,
  costBasisTHB: valueTHB,
  gainPct,
})

const rows = [h('PTT', 190_000, 10.9), h('CPALL', 234_000, -5.6), h('AOT', null, null), h('ADVANC', 50_000, 22)]
const symbols = (list: Holding[]) => list.map((x) => x.symbol)

describe('sortHoldings', () => {
  it('puts the largest THB value first, unconverted last', () => {
    expect(symbols(sortHoldings(rows, 'value'))).toEqual(['CPALL', 'PTT', 'ADVANC', 'AOT'])
  })

  it('ranks same-currency holdings by their own value when there is no rate', () => {
    const usd = (symbol: string, value: number): Holding => ({
      ...h(symbol, null, 1),
      currency: 'USD',
      marketValue: value,
    })
    expect(symbols(sortHoldings([usd('SMALL', 100), usd('VOO', 6000)], 'value'))).toEqual([
      'VOO',
      'SMALL',
    ])
  })

  it('puts the best return first, unknown last', () => {
    expect(symbols(sortHoldings(rows, 'gain'))).toEqual(['ADVANC', 'PTT', 'CPALL', 'AOT'])
  })

  it('sorts by symbol', () => {
    expect(symbols(sortHoldings(rows, 'symbol'))).toEqual(['ADVANC', 'AOT', 'CPALL', 'PTT'])
  })

  it('does not change the input', () => {
    sortHoldings(rows, 'symbol')
    expect(symbols(rows)).toEqual(['PTT', 'CPALL', 'AOT', 'ADVANC'])
  })
})

describe('roundPercents', () => {
  it('adds up to exactly 100', () => {
    expect(roundPercents([1, 1, 1])).toEqual([34, 33, 33])
    expect(roundPercents([50.5, 30.3, 19.2])).toEqual([51, 30, 19])
    expect(roundPercents([985, 10, 5])).toEqual([99, 1, 0])
  })

  it('leaves all zeros at zero', () => {
    expect(roundPercents([0, 0])).toEqual([0, 0])
    expect(roundPercents([])).toEqual([])
  })
})

describe('holdingGain', () => {
  it('is in baht when the holding converts, else in its own currency', () => {
    expect(holdingGain({ marketValue: 6000, costBasis: 6240, marketValueTHB: 204000, costBasisTHB: 212160, currency: 'USD' })).toEqual({ amount: -8160, currency: 'THB' })
    expect(holdingGain({ marketValue: 6000, costBasis: 6240, marketValueTHB: null, costBasisTHB: null, currency: 'USD' })).toEqual({ amount: -240, currency: 'USD' })
  })
})
