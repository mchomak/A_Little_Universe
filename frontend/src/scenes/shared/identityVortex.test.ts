import { describe, expect, it } from 'vitest'
import { createVortexAttributes, identityLegacyReveal, identityLegacyRevealGLSL } from './identityVortex'

describe('04.2 vortex particle identities', () => {
  it('keeps the old particle field out of the GLB dissolve and fades it in after 12 seconds', () => {
    expect(identityLegacyReveal(0)).toBe(0)
    expect(identityLegacyReveal(6)).toBe(0)
    expect(identityLegacyReveal(12)).toBe(0)
    expect(identityLegacyReveal(12.5)).toBeCloseTo(0.5)
    expect(identityLegacyReveal(13)).toBe(1)
    expect(identityLegacyRevealGLSL).toContain('smoothstep(12.0, 13.0, time)')
  })

  it('rebuilds identical finite attributes for replay at both existing quality budgets', () => {
    for (const count of [7000, 16000]) {
      const first = createVortexAttributes(count)
      const replay = createVortexAttributes(count)
      expect(first.orbit).toEqual(replay.orbit)
      expect(first.impulse).toEqual(replay.impulse)
      expect(first.orbit.length).toBe(count * 4)
      expect(first.impulse.length).toBe(count * 4)
      expect([...first.orbit, ...first.impulse].every(Number.isFinite)).toBe(true)
    }
  })

  it('has slow dust, dominant streams and sparse fast particles with independent capture delays', () => {
    const { orbit, impulse } = createVortexAttributes(7000)
    const populations = [0, 0, 0]
    const speeds: number[][] = [[], [], []]
    const delays: number[] = [], depths: number[] = [], radii: number[] = []
    for (let i = 0; i < 7000; i++) {
      const j = i * 4, kind = orbit[j + 3]!
      populations[kind]!++
      speeds[kind]!.push(Math.hypot(impulse[j]!, impulse[j + 1]!, impulse[j + 2]!))
      delays.push(impulse[j + 3]!)
      depths.push(orbit[j + 2]!)
      radii.push(orbit[j]!)
    }
    expect(populations[0]! / 7000).toBeGreaterThan(.2)
    expect(populations[1]! / 7000).toBeGreaterThan(.6)
    expect(populations[2]! / 7000).toBeLessThan(.05)
    expect(populations[2]!).toBeGreaterThan(80)
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
    expect(mean(speeds[2]!)).toBeGreaterThan(mean(speeds[1]!) * 1.6)
    expect(mean(speeds[1]!)).toBeGreaterThan(mean(speeds[0]!) * 1.8)
    expect(Math.max(...delays) - Math.min(...delays)).toBeGreaterThan(1)
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(.9)
    expect(Math.max(...radii)).toBeLessThan(3.5)
    expect(Math.min(...radii)).toBeLessThan(.15)
  })
})
