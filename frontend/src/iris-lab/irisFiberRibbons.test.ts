import { describe, expect, it } from 'vitest'
import { createIrisFiberField } from './irisFiberRibbons'

describe('Cinematic iris fiber ribbons', () => {
  it('builds tapered ribbon triangles across multiple depth layers with silver accents', () => {
    const field = createIrisFiberField({ seed: 1234, density: 0.9, curvature: 0.7, length: 1 })

    expect(field.strandCount).toBeGreaterThan(400)
    expect(field.layerCount).toBe(4)
    expect(field.branchCount).toBeGreaterThan(0)
    expect(field.groupCounts.fineBlue).toBeGreaterThan(field.groupCounts.silver)
    expect(field.groupCounts.silver).toBeGreaterThan(0)
    expect(field.positions.length % 3).toBe(0)
    expect(field.positions.length).toBe(field.alpha.length * 3)
    expect(field.alpha.reduce((smallest, value) => Math.min(smallest, value), 1)).toBe(0)
    expect(field.depthRange).toBeGreaterThan(0.04)
    expect(field.curveMetrics.maxDeflection).toBeGreaterThan(0.02)
    expect(field.curveMetrics.maxSecondDifference).toBeLessThan(0.035)
  })

  it('places accent particles on the same paths as their luminous ribbons', () => {
    const field = createIrisFiberField({ seed: 8, density: 0.7, curvature: 0.5, length: 1 })
    const ribbonVertex = new Float32Array([field.positions[0]!, field.positions[1]!, field.positions[2]!])
    const distances = []
    for (let i = 0; i < field.particlePositions.length; i += 3) {
      const dx = field.particlePositions[i]! - ribbonVertex[0]!
      const dy = field.particlePositions[i + 1]! - ribbonVertex[1]!
      const dz = field.particlePositions[i + 2]! - ribbonVertex[2]!
      distances.push(Math.hypot(dx, dy, dz))
    }
    expect(field.particlePositions.length).toBeGreaterThan(0)
    expect(Math.min(...distances)).toBeLessThan(0.06)
  })

  it('keeps the pupil clear and deterministic for a given seed', () => {
    const options = { seed: 98, density: 0.8, curvature: 0.4, length: 1 }
    expect(createIrisFiberField(options)).toEqual(createIrisFiberField(options))
  })

  it('makes curvature a usable control for smooth, long arcs and layer spacing', () => {
    const low = createIrisFiberField({ seed: 302, density: 0.8, curvature: 0.18, length: 1, layerSeparation: 0.08 })
    const high = createIrisFiberField({ seed: 302, density: 0.8, curvature: 0.78, length: 1, layerSeparation: 0.3 })
    expect(high.curveMetrics.maxDeflection).toBeGreaterThan(low.curveMetrics.maxDeflection)
    expect(high.curveMetrics.maxDeflection).toBeLessThan(0.2)
    expect(high.curveMetrics.maxSecondDifference).toBeLessThan(0.035)
    expect(high.depthRange).toBeGreaterThan(low.depthRange)
  })

  it('keeps ribbon vertices inside an iris boundary while radiating from the pupil center', () => {
    const field = createIrisFiberField({ seed: 45, density: 0.8, curvature: 0.5, length: 1.2, originX: 0.02, originY: 0.26, innerRadius: 0.29, outerRadius: 0.85 })
    let maxDistance = 0
    for (let i = 0; i < field.positions.length; i += 3) {
      maxDistance = Math.max(maxDistance, Math.hypot(field.positions[i]!, field.positions[i + 1]!))
    }
    expect(maxDistance).toBeLessThan(0.87)
    expect(field.particlePositions.length).toBeGreaterThan(0)
  })
})
