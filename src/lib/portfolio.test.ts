import { describe, expect, it } from 'vitest'
import { sortHoldings, type Holding } from './portfolio'

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
