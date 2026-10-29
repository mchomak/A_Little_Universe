import { describe, expect, it } from 'vitest'
import { TIMING } from '../../engine/filmConfig'
import { identityFrame } from './identityFrame'
import { mockLilyParticles } from './identityParticles'

describe('identity scene frames', () => {
  it('keeps the portrait until the photograph replaces it', () => {
    expect(identityFrame(8.5).ascii).toBe(1)
    expect(identityFrame(8.5)).toMatchObject({ photo: 0, underlay: .38 })
    expect(identityFrame(10.5)).toMatchObject({ ascii: 1, photo: 0, underlay: .38 })
    expect(identityFrame(12)).toMatchObject({ photo: .5, underlay: .19 })
    expect(identityFrame(13.5)).toMatchObject({ ascii: 0, photo: 1, frame: 0 })
  })
  it('reaches the gallery handoff without a size or visibility jump', () => {
    expect(identityFrame(21)).toMatchObject({ photo: 1, frame: 1, caption: 1, particle: 0, ascii: 0 })
    expect(identityFrame(3.5).lily).toBe(0)
    expect(identityFrame(20.999).photo).toBe(1)
    expect(identityFrame(12)).toMatchObject({ photo: 0.5, ascii: 0.5, underlay: .19 })
    expect(identityFrame(12)).toEqual(identityFrame(12))
  })
  it('reveals the face before the whole portrait and holds it steady until the photo crossfade', () => {
    expect(identityFrame(3.5).reveal).toBe(0)
    expect(identityFrame(5.5).reveal).toBeCloseTo(.5)
    expect(identityFrame(7.5).reveal).toBe(1)
    expect(identityFrame(8.5).ascii).toBe(1)
    expect(identityFrame(10.5).ascii).toBe(1)
    expect(identityFrame(10.5).underlay).toBeCloseTo(TIMING.identity.portraitUnderlayOpacity)
    expect(identityFrame(13.5)).toMatchObject({ photo: 1, ascii: 0 })
  })
  it('holds the photo before the caption and preserves the gallery framing', () => {
    expect(identityFrame(14.25).photo).toBe(1)
    expect(identityFrame(14.25).caption).toBe(0)
    expect(identityFrame(15).caption).toBeCloseTo(.5)
    expect(identityFrame(21).handoff).toMatchObject({ photo: 1, frame: 1, scale: 1, y: .08 })
  })
  it('provides stable mock samples for a future lily handoff', () => {
    expect(mockLilyParticles.sample(23, 100)).toEqual(mockLilyParticles.sample(23, 100))
    expect(mockLilyParticles.sample(23, 100)).toHaveLength(3)
  })

  it('keeps scene-only motion free of the removed name, spiral and tracked spark stages', () => {
    const frame = identityFrame(8)
    expect(frame).not.toHaveProperty('name')
    expect(frame).not.toHaveProperty('spiral')
    expect(frame).not.toHaveProperty('spark')
  })
})
