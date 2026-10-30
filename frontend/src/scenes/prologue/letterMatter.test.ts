import { expect, it } from 'vitest'
import { createGraphemeZones, getMatterBirthProgress, sampleLetterMatter } from './letterMatter'

it('assigns measured graphemes a stable left-to-right order across wrapped lines', () => {
  const zones = createGraphemeZones([
    { left: 40, top: 10 },
    { left: 0, top: 40 },
    { left: 0, top: 10 },
    { left: 40, top: 40 },
  ], 20)

  expect(Array.from(zones)).toEqual([0.25, 0.5, 0, 0.75])
})

it('breaks matter across the whole phrase instead of sending an erasing edge left to right', () => {
  const left = [0.02, 0.1, 0.2].map(x => getMatterBirthProgress(x, 0.41, 0.08, 91))
  const right = [0.8, 0.9, 0.98].map(x => getMatterBirthProgress(x, 0.41, 0.08, 91))
  expect(Math.min(...right)).toBeLessThan(Math.max(...left))
  for (const x of [0.02, 0.5, 0.98]) {
    expect(getMatterBirthProgress(x, 0.41, 0.08, 91)).toBe(getMatterBirthProgress(x, 0.41, 0.08, 91))
    expect(getMatterBirthProgress(x, 0.41, 0.08, 91)).toBeGreaterThanOrEqual(0)
    expect(getMatterBirthProgress(x, 0.41, 0.08, 91)).toBeLessThanOrEqual(1)
  }
})

it('keeps existing particle birth timing separate from the dissolve-zone atlas channel', () => {
  const raster = {
    width: 2, height: 1, scale: 2, rect: { x: 10, y: 20, width: 1, height: 0.5 },
    alpha: new Uint8Array([255, 0]), particleBirths: new Uint8Array([51, 230]),
    data: new Uint8Array([255, 128, 0, 40, 0, 0, 255, 0]), graphemeCount: 1, zoneWidth: 1,
  }
  const samples = sampleLetterMatter(raster, 3, 91, 12.5, 1.5)
  expect(Array.from(samples)).toEqual([10.25, 20.25, Math.fround(12.8), 10.25, 20.25, Math.fround(12.8), 10.25, 20.25, Math.fround(12.8)])
})
