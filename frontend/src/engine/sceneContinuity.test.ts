import { describe, expect, it } from 'vitest'
import { getIdentityEnvironmentOpacity, shouldKeepGrowthWorld, shouldMountGrowthClouds } from './sceneContinuity'

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

describe('growth environment handoff', () => {
  it('keeps world-space clouds mounted through the 02 to 03 environment handoff', () => {
    expect(shouldMountGrowthClouds(false)).toBe(true)
    expect(shouldMountGrowthClouds(true)).toBe(true)
  })

  it('keeps the scene 02 environment visible through the slower scene 04 dissolve', () => {
    expect(getIdentityEnvironmentOpacity(0, 12)).toBe(1)
    expect(getIdentityEnvironmentOpacity(4, 12)).toBeCloseTo(2 / 3)
    expect(getIdentityEnvironmentOpacity(12, 12)).toBe(0)
    expect(getIdentityEnvironmentOpacity(16, 12)).toBe(0)
    expect(getIdentityEnvironmentOpacity(-2, 12)).toBe(1)
    expect(getIdentityEnvironmentOpacity(Number.NaN, 12)).toBe(1)
  })
})
