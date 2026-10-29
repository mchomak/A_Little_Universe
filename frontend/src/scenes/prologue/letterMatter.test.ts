import { expect, it } from 'vitest'
import { getMatterBirthProgress, sampleLetterMatter } from './letterMatter'

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

it('births dust from the same quantized fracture texels that erase the ink', () => {
  const raster = { width: 2, height: 1, scale: 2, rect: { x: 10, y: 20, width: 1, height: 0.5 }, alpha: new Uint8Array([255, 0]), data: new Uint8Array([255, 128, 51, 40, 0, 0, 230, 0]) }
  const samples = sampleLetterMatter(raster, 3, 91, 12.5, 1.5)
  expect(Array.from(samples)).toEqual([10.25, 20.25, Math.fround(12.8), 10.25, 20.25, Math.fround(12.8), 10.25, 20.25, Math.fround(12.8)])
})
