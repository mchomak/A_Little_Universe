import { describe, expect, it } from 'vitest'
import { shouldKeepGrowthWorld } from './sceneContinuity'

describe('growth world continuity', () => {
  it('keeps the same environment through growth, bloom and the opening of identity', () => {
    expect(shouldKeepGrowthWorld('growth', 16)).toBe(true)
    expect(shouldKeepGrowthWorld('bloom', 0)).toBe(true)
    expect(shouldKeepGrowthWorld('identity', 0)).toBe(true)
    expect(shouldKeepGrowthWorld('identity', 3.99)).toBe(true)
    expect(shouldKeepGrowthWorld('identity', 4)).toBe(false)
    expect(shouldKeepGrowthWorld('gallery', 0)).toBe(false)
    expect(shouldKeepGrowthWorld('identity', Number.NaN)).toBe(false)
  })
})
