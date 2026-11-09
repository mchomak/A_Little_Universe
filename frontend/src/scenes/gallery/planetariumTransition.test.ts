import { describe, expect, it } from 'vitest'
import { getPlanetariumGalaxyFade, getPlanetariumGalleryFade, getPlanetariumGalleryWaterOpacity } from './planetariumTransition'

describe('planetarium gallery-to-galaxy crossfade', () => {
  it('fades the gallery over the first seven seconds of the local transition', () => {
    expect(getPlanetariumGalleryFade(0)).toBe(0)
    expect(getPlanetariumGalleryFade(3.5)).toBeCloseTo(0.5)
    expect(getPlanetariumGalleryFade(7)).toBe(1)
    expect(getPlanetariumGalleryFade(8)).toBe(1)
  })

  it('reveals the existing galaxy from transition second five through ten', () => {
    expect(getPlanetariumGalaxyFade(4.99)).toBe(0)
    expect(getPlanetariumGalaxyFade(5)).toBe(0)
    expect(getPlanetariumGalaxyFade(7.5)).toBeCloseTo(0.5)
    expect(getPlanetariumGalaxyFade(10)).toBe(1)
  })

  it('keeps the gallery and galaxy visible together during the two-second overlap', () => {
    const transitionTime = 6
    expect(getPlanetariumGalleryFade(transitionTime)).toBeLessThan(1)
    expect(getPlanetariumGalaxyFade(transitionTime)).toBeGreaterThan(0)
  })

  it('fades the water plane with the rest of the gallery', () => {
    expect(getPlanetariumGalleryWaterOpacity(1, 0)).toBe(1)
    expect(getPlanetariumGalleryWaterOpacity(0.5, 3.5)).toBeCloseTo(0.25)
    expect(getPlanetariumGalleryWaterOpacity(1, 7)).toBe(0)
  })
})
