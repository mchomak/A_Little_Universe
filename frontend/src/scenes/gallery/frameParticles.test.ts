import { describe, expect, it } from 'vitest'
import { createFrameParticleGeometry } from './frameParticles'

describe('gallery frame particle geometry', () => {
  it('adds one deterministic larger accent at each photo-frame corner', () => {
    const frame = createFrameParticleGeometry(3.3, 2.2, 7)
    const positions = frame.getAttribute('position')
    const sizes = frame.getAttribute('size')
    const corners = [
      [-1.71, 1.16],
      [1.71, 1.16],
      [1.71, -1.16],
      [-1.71, -1.16],
    ] as const

    for (const [x, y] of corners) {
      const accents = Array.from({ length: positions.count }, (_, index) => index)
        .filter(index => Math.abs(positions.getX(index) - x) < 1e-6 && Math.abs(positions.getY(index) - y) < 1e-6)
      expect(accents).toHaveLength(1)
      expect(sizes.getX(accents[0]!)).toBeGreaterThan(0.075)
    }

    frame.dispose()
  })

  it('scales frame-particle brightness from bounded art settings', () => {
    const normal = createFrameParticleGeometry(3.3, 2.2, 4)
    const dimmed = createFrameParticleGeometry(3.3, 2.2, 4, { frameIntensity: 0 })
    const doubled = createFrameParticleGeometry(3.3, 2.2, 4, { frameIntensity: 2 })
    const normalAlpha = normal.getAttribute('particleAlpha')
    const dimmedAlpha = dimmed.getAttribute('particleAlpha')
    const doubledAlpha = doubled.getAttribute('particleAlpha')

    expect(Array.from(dimmedAlpha.array)).toEqual(Array.from({ length: dimmedAlpha.count }, () => 0))
    expect(doubledAlpha.getX(0)).toBeCloseTo(normalAlpha.getX(0) * 2)

    normal.dispose(); dimmed.dispose(); doubled.dispose()
  })

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
