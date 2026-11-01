import { describe, expect, it } from 'vitest'
import { createIslandSideGeometryData, createIslandTopGeometryData, createGrassBladeData } from './floatingIslandGeometry'

describe('floating island geometry', () => {
  it('builds a centered top surface with an irregular edge and finite vertex colors', () => {
    const surface = createIslandTopGeometryData(0.82)

    expect(surface.positions.length).toBeGreaterThan(3000)
    expect(surface.indices.length).toBeGreaterThan(5000)
    expect(surface.positions[0]).toBe(0)
    expect(surface.positions[1]).toBe(0)
    expect(surface.positions[2]).toBe(0)
    expect(Array.from(surface.positions).every(Number.isFinite)).toBe(true)
    expect(Array.from(surface.colors).every(Number.isFinite)).toBe(true)

    const edgeRadii = Array.from({ length: 96 }, (_, index) => {
      const vertex = (surface.positions.length / 3) - 96 + index
      return Math.hypot(surface.positions[vertex * 3]!, surface.positions[vertex * 3 + 2]!)
    })
    expect(Math.max(...edgeRadii) - Math.min(...edgeRadii)).toBeGreaterThan(0.03)
    expect(Math.max(...edgeRadii)).toBeLessThan(0.9)
  })

  it('adds a tapered soil body below the planting surface', () => {
    const body = createIslandSideGeometryData(0.82)
    const yValues = Array.from({ length: body.positions.length / 3 }, (_, index) => body.positions[index * 3 + 1]!)

    expect(body.indices.length).toBeGreaterThan(1000)
    expect(Math.max(...yValues)).toBeGreaterThan(-0.03)
    expect(Math.max(...yValues)).toBeLessThan(0.02)
    expect(Math.min(...yValues)).toBeLessThan(-0.25)
    expect(Array.from(body.colors).every(Number.isFinite)).toBe(true)

    const [ia, ib, ic] = body.indices.slice(0, 3)
    const a = [body.positions[ia! * 3]!, body.positions[ia! * 3 + 1]!, body.positions[ia! * 3 + 2]!]
    const b = [body.positions[ib! * 3]!, body.positions[ib! * 3 + 1]!, body.positions[ib! * 3 + 2]!]
    const c = [body.positions[ic! * 3]!, body.positions[ic! * 3 + 1]!, body.positions[ic! * 3 + 2]!]
    const ab = b.map((value, index) => value - a[index]!)
    const ac = c.map((value, index) => value - a[index]!)
    const normal = [ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!]
    expect(normal[0]! * (a[0]! + b[0]! + c[0]!) + normal[2]! * (a[2]! + b[2]! + c[2]!)).toBeGreaterThan(0)
  })

  it('places deterministic grass within the island while leaving a clear planting center', () => {
    const first = createGrassBladeData(360, 0.82, 42)
    const replay = createGrassBladeData(360, 0.82, 42)

    expect(first.roots).toEqual(replay.roots)
    expect(first.heights).toEqual(replay.heights)
    expect(first.phases).toEqual(replay.phases)
    expect(first.roots).toHaveLength(360 * 3)
    expect(first.colors).toHaveLength(360 * 3)
    for (let index = 0; index < first.roots.length / 3; index += 1) {
      const x = first.roots[index * 3]!
      const y = first.roots[index * 3 + 1]!
      const z = first.roots[index * 3 + 2]!
      const radius = Math.hypot(x, z)
      expect(radius).toBeGreaterThan(0.15)
      expect(radius).toBeLessThan(0.82)
      expect(y).toBeLessThanOrEqual(0.02)
      expect(first.heights[index]).toBeGreaterThan(0.07)
      expect(first.heights[index]).toBeLessThan(0.19)
    }
  })
})
