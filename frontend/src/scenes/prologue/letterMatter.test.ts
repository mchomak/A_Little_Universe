import { expect, it } from 'vitest'
import { DEFAULT_DISSOLVE_STYLE, getDissolveEmissionTime, getDissolveThreshold, normalizeDissolveStyle, sampleDissolveNoise } from '../shared/dissolve'
import { createGraphemeZones, createPrologueDissolveStyle, sampleLetterMatter } from './letterMatter'

it('assigns measured graphemes a stable left-to-right order across wrapped lines', () => {
  const zones = createGraphemeZones([
    { left: 40, top: 10 },
    { left: 0, top: 40 },
    { left: 0, top: 10 },
    { left: 40, top: 40 },
  ], 20)

  expect(Array.from(zones)).toEqual([0.25, 0.5, 0, 0.75])
})

it('emits sampled alpha pixels at their shared seeded grapheme dissolve thresholds', () => {
  const style = normalizeDissolveStyle({ seed: 91, noiseScale: 12, noiseStrength: 0.5, edgeWidth: 0.02 })
  const zone = 128 / 255
  const noise = sampleDissolveNoise(0.25, 0.5, style)
  const threshold = getDissolveThreshold(zone, noise, 0.5, style)
  const raster = {
    width: 2, height: 1, scale: 2, rect: { x: 10, y: 20, width: 1, height: 0.5 },
    alpha: new Uint8Array([255, 0]), particleBirths: new Float32Array([threshold, 0]),
    data: new Uint8Array([255, 128, 128, 40, 0, 0, 255, 0]), graphemeCount: 2, zoneWidth: 0.5,
  }
  const samples = sampleLetterMatter(raster, 1, 91, 12.5, 1.5)
  const expectedTime = getDissolveEmissionTime(zone, noise, 0.5, 12.5, 1.5, style)

  expect(Array.from(samples.slice(0, 2))).toEqual([10.25, 20.25])
  expect(samples[2]).toBeCloseTo(expectedTime)
})

it('feeds configured fracture width into the shared dissolve threshold and emission style', () => {
  const narrowStyle = createPrologueDissolveStyle(91, 0.04)
  const defaultStyle = createPrologueDissolveStyle(91, 0.08)
  const wideStyle = createPrologueDissolveStyle(91, 0.12)
  const noise = sampleDissolveNoise(0.3, 0.6, narrowStyle)
  const zone = 0.5, zoneWidth = 0.25
  const narrowThreshold = getDissolveThreshold(zone, noise, zoneWidth, narrowStyle)
  const wideThreshold = getDissolveThreshold(zone, noise, zoneWidth, wideStyle)

  expect(narrowStyle.noiseStrength).toBeCloseTo(0.41)
  expect(defaultStyle).toEqual(normalizeDissolveStyle({ ...DEFAULT_DISSOLVE_STYLE, seed: 91 }))
  expect(wideStyle.noiseStrength).toBe(1)
  expect(narrowThreshold).not.toBe(wideThreshold)
  expect(getDissolveEmissionTime(zone, noise, zoneWidth, 4, 2, narrowStyle)).toBeCloseTo(4 + narrowThreshold * 2)
  expect(getDissolveEmissionTime(zone, noise, zoneWidth, 4, 2, wideStyle)).toBeCloseTo(4 + wideThreshold * 2)
})
