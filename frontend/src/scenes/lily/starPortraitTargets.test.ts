import { describe, expect, it } from 'vitest'
import { sampleStarPortraitTargets, type StarPortraitSamplingSettings, type StarPortraitSource } from './starPortraitTargets'

function makeSource(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number], matte: (x: number, y: number) => number = () => 255): StarPortraitSource {
  const photoRgba = new Uint8ClampedArray(width * height * 4)
  const matteRgba = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      photoRgba.set(pixel(x, y), offset)
      const coverage = matte(x, y)
      matteRgba.set([coverage, coverage, coverage, 255], offset)
    }
  }
  return { width, height, photoRgba, matteRgba }
}

const settings: StarPortraitSamplingSettings = {
  count: 720,
  detailBoost: 1.25,
  fillDensity: 1.2,
  contrast: 1,
  backgroundThreshold: 0.16,
  irregularity: 0.55,
  seed: 0x51a7,
}

describe('sampleStarPortraitTargets', () => {
  it('is deterministic for identical input and varies its layout by seed', () => {
    const source = makeSource(64, 64, (x, y) => {
      const value = (x * 13 + y * 29) % 256
      return [value, 255 - value, (value * 3) % 256, 255]
    })

    const first = sampleStarPortraitTargets(source, settings)
    const repeat = sampleStarPortraitTargets(source, settings)
    const differentSeed = sampleStarPortraitTargets(source, { ...settings, seed: 0x7211 })

    expect(first).toEqual(repeat)
    expect(differentSeed).not.toEqual(first)
    expect(first).toHaveLength(settings.count)
    expect(first.every((point) => point.u >= 0 && point.u <= 1 && point.v >= 0 && point.v <= 1)).toBe(true)
    expect(first.every((point) => [point.tone, point.contrast, point.featureWeight, point.seed, ...point.photoColorLinear].every(Number.isFinite))).toBe(true)
    expect(first.some((point) => Math.abs(point.u * 64 - Math.round(point.u * 64)) > 0.05)).toBe(true)
  })

  it('excludes matte background while retaining dark interior fill and RGB colors', () => {
    const source = makeSource(64, 64, (x) => {
      if (x < 20) return [8, 6, 4, 255]
      if (x < 40) return [120, 70, 190, 255]
      return [255, 255, 255, 255]
    }, (x) => x >= 12 && x < 52 ? 255 : 0)

    const points = sampleStarPortraitTargets(source, { ...settings, count: 1000, backgroundThreshold: 0.2 })

    expect(points.length).toBeGreaterThan(0)
    expect(points.every((point) => point.u >= 12 / 64 && point.u <= 52 / 64)).toBe(true)
    expect(points.some((point) => point.u < 20 / 64 && point.photoColorLinear[0] < 0.01)).toBe(true)
    expect(points.some((point) => point.photoColorLinear[0] > 0 && point.photoColorLinear[2] > point.photoColorLinear[1])).toBe(true)
  })

  it('allocates more samples to textured detail than an equal-sized flat region', () => {
    const source = makeSource(96, 80, (x, y) => {
      if (x >= 12 && x < 32 && y >= 24 && y < 64) {
        const value = x % 2 === 0 ? 240 : 18
        return [value, value, value, 255]
      }
      return [128, 128, 128, 255]
    })

    const points = sampleStarPortraitTargets(source, { ...settings, count: 2200, seed: 12 })
    const inRect = (u: number, v: number, left: number, right: number) => u >= left / 96 && u < right / 96 && v >= 24 / 80 && v < 64 / 80
    const detailed = points.filter(({ u, v }) => inRect(u, v, 12, 32)).length
    const flat = points.filter(({ u, v }) => inRect(u, v, 56, 76)).length

    expect(detailed).toBeGreaterThan(flat)
    expect(points.some((point) => point.featureWeight > 0.4)).toBe(true)
  })

  it('allocates more deterministic weight and samples to equal-luminance chromatic detail', () => {
    const source = makeSource(96, 80, (x, y) => {
      if (x >= 12 && x < 32 && y >= 24 && y < 64) {
        // Red and green stripes have nearly identical linear luminance.
        return x % 2 === 0 ? [255, 0, 0, 255] : [0, 148, 0, 255]
      }
      return [127, 127, 127, 255]
    })

    const samplingSettings = { ...settings, count: 2200, seed: 0xC01 }
    const points = sampleStarPortraitTargets(source, samplingSettings)
    const repeatedPoints = sampleStarPortraitTargets(source, samplingSettings)
    const inRect = (u: number, v: number, left: number, right: number) => u >= left / 96 && u < right / 96 && v >= 24 / 80 && v < 64 / 80
    const chromatic = points.filter(({ u, v }) => inRect(u, v, 12, 32))
    const flat = points.filter(({ u, v }) => inRect(u, v, 56, 76))
    const meanFeatureWeight = (region: typeof points) => region.reduce((sum, point) => sum + point.featureWeight, 0) / region.length

    expect(points).toEqual(repeatedPoints)
    expect(chromatic.length).toBeGreaterThan(flat.length)
    expect(meanFeatureWeight(chromatic)).toBeGreaterThan(meanFeatureWeight(flat))
  })

  it('bounds output count and rejects malformed source buffers', () => {
    const source = makeSource(256, 256, () => [80, 95, 120, 255])
    const points = sampleStarPortraitTargets(source, { ...settings, count: 100_000 })

    expect(points).toHaveLength(32_000)
    expect(() => sampleStarPortraitTargets({ ...source, matteRgba: new Uint8ClampedArray(4) }, settings)).toThrow(/matte/i)
    expect(() => sampleStarPortraitTargets({ ...source, width: 0 }, settings)).toThrow(/dimension/i)
  })
})
