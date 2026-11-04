import { describe, expect, it } from 'vitest'
import { irisMaskDistance, processBlueEyePixels, supportRadiusForIrisFocus } from './blueParticleEye'

describe('Blue Particle Eye image sampling', () => {
  it('keeps image coordinates and linearized source detail while dropping transparent pixels', () => {
    const rgba = new Uint8ClampedArray([
      255, 180, 60, 255,
      8, 12, 20, 0,
    ])
    const sample = processBlueEyePixels(rgba, 2, 1, 10, () => 0.5)

    expect(sample.count).toBe(1)
    expect(sample.uv).toEqual(new Float32Array([0.25, 0.5]))
    expect(sample.color[0]!).toBeGreaterThan(sample.color[1]!)
    expect(sample.random[0]!).toBe(0.5)
  })

  it('measures a rotated elliptical iris mask and narrows the outer eye at full focus', () => {
    expect(irisMaskDistance({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5, radiusX: 0.25, radiusY: 0.125, rotation: 0 })).toBe(0)
    expect(irisMaskDistance({ x: 0.5, y: 0.375 }, { x: 0.5, y: 0.5, radiusX: 0.25, radiusY: 0.125, rotation: 0 })).toBeCloseTo(1)
    expect(irisMaskDistance({ x: 0.5, y: 0.375 }, { x: 0.5, y: 0.5, radiusX: 0.25, radiusY: 0.125, rotation: Math.PI / 2 })).toBeCloseTo(0.5)
    expect(supportRadiusForIrisFocus(1, 1)).toBeLessThan(supportRadiusForIrisFocus(0, 0))
    expect(supportRadiusForIrisFocus(1, 1)).toBeCloseTo(1.025)
  })

  it('rejects malformed pixel planes rather than creating a rectangular cloud', () => {
    expect(() => processBlueEyePixels(new Uint8ClampedArray(3), 1, 1)).toThrow('Invalid RGBA pixel plane')
  })
})
