import { describe, expect, it } from 'vitest'
import { createGalleryDustGeometry, getGalleryDustCount } from './dust'

describe('gallery air dust', () => {
  it('scales the configured count for low quality and reduced motion', () => {
    expect(getGalleryDustCount(220, false, false)).toBe(220)
    expect(getGalleryDustCount(220, true, false)).toBe(97)
    expect(getGalleryDustCount(220, false, true)).toBe(97)
    expect(getGalleryDustCount(0, false, false)).toBe(0)
    expect(getGalleryDustCount(800, false, false)).toBe(600)
  })

  it('creates deterministic warm and silver particles on three depth planes', () => {
    const first = createGalleryDustGeometry(12)
    const repeated = createGalleryDustGeometry(12)
    const positions = first.getAttribute('position')
    const speeds = first.getAttribute('speed')
    const depths = Array.from({ length: positions.count }, (_, i) => positions.getZ(i))

    expect(positions.count).toBe(12)
    expect(positions.array).toEqual(repeated.getAttribute('position').array)
    expect(first.getAttribute('color').array).toEqual(repeated.getAttribute('color').array)
    expect(Array.from(speeds.array).every(speed => speed > 0 && speed < 0.1)).toBe(true)
    expect(depths.some(z => z > -20)).toBe(true)
    expect(depths.some(z => z < -20 && z > -50)).toBe(true)
    expect(depths.some(z => z < -55)).toBe(true)

    first.dispose(); repeated.dispose()
  })
})
