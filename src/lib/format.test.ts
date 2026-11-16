import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDate } from './format'

describe('formatDate', () => {
  // stubEnv writes process.env.TZ, which Node applies to Date immediately.
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('keeps a date-only value on its calendar day west of UTC', () => {
    vi.stubEnv('TZ', 'America/New_York')
    // Sanity check that the zone switch took effect in this runtime.
    expect(new Date('2026-05-10').getDate()).toBe(9)

    expect(formatDate('2026-05-10')).toMatch(/^10 May/)
  })

  it('still formats full timestamps in local time', () => {
    vi.stubEnv('TZ', 'Asia/Bangkok')
    // 20:00Z on 9 May is 03:00 on 10 May in Bangkok.
    expect(formatDate('2026-05-09T20:00:00.000Z')).toMatch(/^10 May/)
  })
})
