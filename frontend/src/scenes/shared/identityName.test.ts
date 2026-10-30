import { describe, expect, it } from 'vitest'
import { nameAssembly, nameFocus, nameWave } from './identityName'

describe('04.3 name choreography', () => {
  it('preserves the incoming handoff, staggers streams and settles for a 3–4 second hold', () => {
    for (const seed of [0, .25, .75, 1]) {
      for (const stream of [0, 1, 2]) {
        expect(nameAssembly(8, stream, seed)).toBe(0)
        expect(nameAssembly(9.4, stream, seed)).toBe(1)
        expect(nameAssembly(13, stream, seed)).toBe(1)
      }
    }
    expect(nameAssembly(8.4, 0, .5)).toBeGreaterThan(nameAssembly(8.4, 2, .5))
    const values = Array.from({ length: 141 }, (_, i) => nameAssembly(8 + i / 100, 0, .5))
    expect(Math.max(...values)).toBeGreaterThan(1.02)
    expect(Math.max(...values)).toBeLessThan(1.09)
    expect(nameAssembly(8.7, 0, .5, false)).toBeLessThanOrEqual(1)
  })

  it('sends one left-to-right wave only after assembly and restores the later shots', () => {
    expect(nameWave(9.35, -2)).toBe(0)
    expect(nameWave(9.7, -1.9)).toBeGreaterThan(nameWave(9.7, 1.9))
    expect(nameWave(10.6, 1.9)).toBeGreaterThan(nameWave(10.6, -1.9))
    expect(nameWave(11.2, 1.9)).toBe(0)
    expect(nameWave(12.7, -2)).toBe(0)
    expect(nameFocus(8)).toBe(0)
    expect(nameFocus(10)).toBe(1)
    expect(nameFocus(13)).toBe(1)
    expect(nameFocus(17)).toBe(0)
  })
})
