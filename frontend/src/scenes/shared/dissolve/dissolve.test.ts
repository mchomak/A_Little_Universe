import { expect, it } from 'vitest'
import {
  getDissolveEdge,
  getDissolveThreshold,
  normalizeDissolveStyle,
  sampleDissolveNoise,
} from './index'

it('normalizes style values to restrained shader-safe bounds', () => {
  const style = normalizeDissolveStyle({
    noiseScale: 0,
    noiseStrength: 2,
    edgeWidth: 0,
    edgeIntensity: 1,
    edgeColor: [2, -1, 0.5],
  })

  expect(style).toMatchObject({
    noiseScale: 1,
    noiseStrength: 1,
    edgeWidth: 0.001,
    edgeIntensity: 0.45,
    edgeColor: [1, 0, 0.5],
  })
})

it('samples deterministic spatial noise from the style seed', () => {
  const style = normalizeDissolveStyle({ seed: 91, noiseScale: 12 })
  const sample = sampleDissolveNoise(0.25, 0.5, style)

  expect(sampleDissolveNoise(0.25, 0.5, style)).toBe(sample)
  expect(sampleDissolveNoise(0.25, 0.5, normalizeDissolveStyle({ seed: 92, noiseScale: 12 }))).not.toBe(sample)
  expect(sample).toBeGreaterThanOrEqual(0)
  expect(sample).toBeLessThanOrEqual(1)
})

it('offsets each glyph zone with noise and keeps the edge localized to its threshold', () => {
  const style = normalizeDissolveStyle({ noiseStrength: 1, edgeWidth: 0.02, edgeIntensity: 0.3 })

  expect(getDissolveThreshold(0.5, 0, 0.2, style)).toBeCloseTo(0.4)
  expect(getDissolveThreshold(0.5, 1, 0.2, style)).toBeCloseTo(0.6)
  expect(getDissolveEdge(0.5, 0.5, style)).toBeCloseTo(0.3)
  expect(getDissolveEdge(0.54, 0.5, style)).toBeLessThan(0.02)
})
