import { describe, expect, it } from 'vitest'
import { identityFrame } from './identityFrame'
import { mockLilyParticles } from './identityParticles'

describe('identity scene frames', () => {
  it('keeps the portrait until the photograph replaces it', () => {
    expect(identityFrame(17).ascii).toBeGreaterThan(0)
    expect(identityFrame(23)).toMatchObject({ ascii: 1, photo: .35 })
    expect(identityFrame(25).photo).toBeCloseTo(.61)
    expect(identityFrame(28)).toMatchObject({ ascii: 0, photo: 1, frame: 0 })
  })
  it('reaches the gallery handoff without a size or visibility jump', () => {
    expect(identityFrame(34)).toMatchObject({ photo: 1, frame: 1, gallery: 1, scale: 1, orbit: 0 })
    expect(identityFrame(4).lily).toBe(0)
    expect(identityFrame(32).gallery).toBeGreaterThan(0)
    expect(identityFrame(23)).toEqual(identityFrame(23))
  })
  it('provides stable mock samples for a future lily handoff', () => {
    expect(mockLilyParticles.sample(23, 100)).toEqual(mockLilyParticles.sample(23, 100))
    expect(mockLilyParticles.sample(23, 100)).toHaveLength(3)
  })
})
