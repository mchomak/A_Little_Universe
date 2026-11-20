import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { createProceduralLily } from './plant.js'

describe('procedural lily', () => {
  it('seeks deterministically between a closed bud and six open tepals', () => {
    const plant = createProceduralLily({ textures: false })
    try {
      const profile = (bloom: number) => {
        plant.setPose(1, bloom)
        return plant.tepals.map(tepal => {
          let radius = 0
          const point = new Vector3()
          const count = tepal.geometry.getAttribute('position').count
          for (let i = 0; i < count; i++) {
            tepal.getVertexPosition(i, point)
            radius = Math.max(radius, Math.hypot(point.x, point.z))
          }
          return radius
        })
      }
      expect(plant.leaves).toHaveLength(10)
      expect(plant.tepals).toHaveLength(6)
      const closed = profile(0)
      expect(closed.every(radius => radius < 0.3)).toBe(true)
      const opened = profile(1)
      expect(opened.every(radius => radius > 0.78)).toBe(true)
      expect(profile(0)).toEqual(closed)
      expect(profile(1)).toEqual(opened)
    } finally { plant.dispose() }
  })

  it('grows from a fixed base without scaling the mature flower', () => {
    const plant = createProceduralLily({ textures: false })
    try {
      plant.setPose(1, 0)
      expect(plant.head.position.y).toBeCloseTo(2.644 * 1.25)
      expect(plant.head.scale.y).toBe(1)
      expect(plant.object.position.y).toBe(0)
      plant.setPose(0.5, 0)
      expect(plant.head.position.y).toBeCloseTo(2.644 * 1.25 * 0.5)
      plant.setPose(1, 1)
      expect(plant.head.position.y).toBeCloseTo(2.644 * 1.25)
    } finally { plant.dispose() }
  })
})
