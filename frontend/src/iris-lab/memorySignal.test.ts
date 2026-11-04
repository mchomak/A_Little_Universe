import { describe, expect, it } from 'vitest'
import { sampleMemorySignalPixels } from './memorySignal'

describe('sampleMemorySignalPixels', () => {
  it('keeps the eye silhouette and omits transparent pixels and connected flat background', () => {
    const width = 9, height = 9
    const rgba = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < width * height; i++) rgba.set([8, 12, 20, 255], i * 4)
    for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) rgba.set([130, 170, 220, 255], (y * width + x) * 4)
    rgba.set([255, 255, 255, 0], (4 * width + 4) * 4)
    const result = sampleMemorySignalPixels({ data: rgba, width, height }, { backgroundThreshold: 0.2, alphaThreshold: 0.1, brightnessThreshold: 0.02, maxPoints: 100 })
    expect(result.count).toBe(8)
    expect(Array.from(result.edgeFactor).some((edge) => edge > 0.5)).toBe(true)
    expect(result.positions.every(Number.isFinite)).toBe(true)
  })

  it('retains an enclosed dark pupil while opaque border background is removed', () => {
    const rgba = new Uint8ClampedArray(3 * 3 * 4)
    for (let i = 0; i < 9; i++) rgba.set([255,255,255,255], i * 4)
    rgba.set([20,30,40,255], (4) * 4)
    const result = sampleMemorySignalPixels({ data: rgba, width: 3, height: 3 }, { backgroundThreshold: 0, alphaThreshold: 0, brightnessThreshold: 0.25, maxPoints: 10 })
    expect(result.count).toBe(1)
    expect(result.relief[0]).toBeLessThanOrEqual(1)
    expect(result.brightness[0]).toBe(0)
  })

  it('changes brightness relief without changing the independent connected background mask', () => {
    const rgba = new Uint8ClampedArray(3 * 3 * 4)
    for (let i = 0; i < 9; i++) rgba.set([12, 16, 24, 255], i * 4)
    rgba.set([145, 180, 230, 255], 4 * 4)
    const plane = { data: rgba, width: 3, height: 3 }
    const low = sampleMemorySignalPixels(plane, { backgroundThreshold: 0, alphaThreshold: 0, brightnessThreshold: 0, maxPoints: 10 })
    const high = sampleMemorySignalPixels(plane, { backgroundThreshold: 0, alphaThreshold: 0, brightnessThreshold: 0.5, maxPoints: 10 })
    expect(low.count).toBe(1)
    expect(high.count).toBe(1)
    expect(high.brightness[0]).toBeLessThan(low.brightness[0]!)
  })

  it('decodes a captured surface depth and maps pixels to the capture camera span', () => {
    const rgba = new Uint8ClampedArray(3 * 3 * 4), depth = new Uint8ClampedArray(3 * 3 * 4)
    for (let i = 0; i < 9; i++) rgba.set([0, 0, 0, 255], i * 4)
    rgba.set([120, 150, 200, 255], 4 * 4); depth.set([127, 128, 0, 255], 4 * 4)
    const result = sampleMemorySignalPixels({ data: rgba, depthData: depth, depthScale: 2, worldSpan: 2.6, width: 3, height: 3 }, { backgroundThreshold: 0, alphaThreshold: 0, brightnessThreshold: 0, maxPoints: 10 })
    expect(result.positions[0]).toBeCloseTo(0)
    expect(result.positions[1]).toBeCloseTo(0)
    expect(result.positions[2]).toBeCloseTo(1, 3)
  })
})
