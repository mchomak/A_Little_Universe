import { describe, expect, it } from 'vitest'
import { createFrameParticleGeometry } from './frameParticles'

describe('gallery frame particle geometry', () => {
  it('samples all four edges proportionally and deterministically', () => {
    const wide = createFrameParticleGeometry(3.3, 2.2, 3)
    const tall = createFrameParticleGeometry(2.2, 3.3, 3)
    const repeated = createFrameParticleGeometry(3.3, 2.2, 3)
    const widePositions = wide.getAttribute('position')
    const tallPositions = tall.getAttribute('position')
    expect(widePositions.count).toBe(tallPositions.count)
    expect(widePositions.count).toBeGreaterThan(32)
    let top = 0, right = 0, bottom = 0, left = 0
    for (let i = 0; i < widePositions.count; i++) {
      const x = widePositions.getX(i), y = widePositions.getY(i)
      if (y > 1) top++
      else if (x > 1.5) right++
      else if (y < -1) bottom++
      else left++
    }
    expect(top).toBeGreaterThan(0)
    expect(right).toBeGreaterThan(0)
    expect(bottom).toBeGreaterThan(0)
    expect(left).toBeGreaterThan(0)
    expect(wide.getAttribute('phase').array).toEqual(repeated.getAttribute('phase').array)
    wide.dispose(); tall.dispose(); repeated.dispose()
  })
})
