import { describe, expect, it } from 'vitest'
import { comparisonPointValid } from './inspectorCompare'

describe('comparison point', () => {
  it('invalidates replay, external seek, scene change and gate change', () => {
    const point = { scene: 'prologue' as const, mode: 'playing' as const, time: 5, revision: 4 }
    expect(comparisonPointValid(point, { scene: 'prologue', mode: 'playing', revision: 4, elapsed: 5 }, 21)).toBe(true)
    expect(comparisonPointValid(point, { scene: 'prologue', mode: 'playing', revision: 5, elapsed: 0 }, 21)).toBe(false)
    expect(comparisonPointValid(point, { scene: 'growth', mode: 'playing', revision: 4, elapsed: 5 }, 21)).toBe(false)
    expect(comparisonPointValid(point, { scene: 'prologue', mode: 'waiting', revision: 4, elapsed: 21 }, 21)).toBe(false)
  })
})
