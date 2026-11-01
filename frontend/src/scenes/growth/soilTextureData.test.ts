import { describe, expect, it } from 'vitest'
import { createSoilTextureData } from './soilTextureData'

describe('floating island soil textures', () => {
  it('creates stable warm color, shallow relief, and broad roughness variation', () => {
    const first = createSoilTextureData(64)
    const replay = createSoilTextureData(64)
    expect(first).toEqual(replay)
    for (const data of Object.values(first)) expect(data).toHaveLength(64 * 64 * 4)

    const red = Array.from({ length: 64 * 64 }, (_, i) => first.color[i * 4]!)
    const green = Array.from({ length: 64 * 64 }, (_, i) => first.color[i * 4 + 1]!)
    const blue = Array.from({ length: 64 * 64 }, (_, i) => first.color[i * 4 + 2]!)
    const relief = Array.from({ length: 64 * 64 }, (_, i) => first.height[i * 4]!)
    const roughness = Array.from({ length: 64 * 64 }, (_, i) => first.roughness[i * 4]!)
    const span = (values: number[]) => Math.max(...values) - Math.min(...values)

    expect(red.every((value, i) => value > green[i]! && green[i]! > blue[i]!)).toBe(true)
    expect(span(red)).toBeGreaterThan(40)
    expect(span(relief)).toBeGreaterThan(70)
    expect(span(roughness)).toBeGreaterThan(55)
    expect(Math.min(...roughness)).toBeGreaterThanOrEqual(192)
  })
})
