import { describe, expect, it } from 'vitest'
import { getSeedShatterOpacity } from './growth/seedProcedure'

describe('seed impact handoff', () => {
  it('holds the seed through contact, then fades it during the fragment burst', () => {
    const impactTime = 8
    expect(getSeedShatterOpacity(impactTime - 0.01, impactTime, 0.85, false)).toBe(1)
    expect(getSeedShatterOpacity(impactTime, impactTime, 0.85, false)).toBe(1)
    expect(getSeedShatterOpacity(impactTime + 0.085, impactTime, 0.85, false)).toBeCloseTo(0.5)
    expect(getSeedShatterOpacity(impactTime + 0.2, impactTime, 0.85, false)).toBe(0)
  })

  it('keeps reduced motion on the existing gradual handoff', () => {
    expect(getSeedShatterOpacity(8.2, 8, 0.85, true)).toBe(1)
  })

  it('returns the same shatter state for arbitrary forward and backward seeks', () => {
    const sample = () => getSeedShatterOpacity(8.06, 8, 0.85, false)
    expect(sample()).toBe(sample())
  })
})
