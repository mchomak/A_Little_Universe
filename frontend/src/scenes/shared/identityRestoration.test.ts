import { describe, expect, it } from 'vitest'
import { restorationStart, restoredPixel, restorationFrame, restoredPhotoFragment } from './identityRestoration'
import { createProgressivePhotoRevealMap, getProgressivePhotoRevealArrivalOrder, getProgressivePhotoRevealCoverage, getProgressivePhotoParticleOpacity, progressivePhotoRevealGLSL, progressivePhotoRevealState } from './progressivePhotoReveal'

describe('legacy IdentityScene photographic restoration', () => {
  it('starts with the existing portrait and finishes early enough for a quiet hold', () => {
    for (let y = 0; y <= 20; y++) for (let x = 0; x <= 20; x++) {
      expect(restoredPixel(23, x / 20, y / 20)).toBe(0)
      expect(restoredPixel(26.8, x / 20, y / 20)).toBe(1)
      expect(restoredPixel(28, x / 20, y / 20)).toBe(1)
    }
  })
  it('restores face, hair and shoulder neighbourhoods ahead of distant background', () => {
    const face = restorationStart(.66, .38)
    const hair = restorationStart(.48, .18)
    const shoulder = restorationStart(.81, .73)
    expect(face).toBeLessThan(restorationStart(.02, .97))
    expect(hair).toBeLessThan(restorationStart(.02, .97))
    expect(shoulder).toBeLessThan(restorationStart(.02, .97))
    expect(restoredPixel(24.2, .66, .38)).toBeGreaterThan(restoredPixel(24.2, .02, .97))
  })
  it('uses a monotonic, spatially varied schedule independent of playback history', () => {
    const starts = new Set<number>()
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      starts.add(restorationStart(x / 15, y / 15))
      let previous = 0
      for (let tick = 230; tick <= 280; tick++) {
        const value = restoredPixel(tick / 10, x / 15, y / 15)
        expect(value).toBeGreaterThanOrEqual(previous)
        previous = value
      }
    }
    expect(starts.size).toBeGreaterThan(100)
  })
  it('leaves adjacent shots untouched and limits the temporary card rim', () => {
    for (const time of [0, 17, 22.9, 23, 28, 28.1, 34]) expect(restorationFrame(time)).toEqual({ active: false, quiet: 0, rim: 0 })
    expect(restorationFrame(25).active).toBe(true)
    expect(restorationFrame(27).quiet).toBe(1)
    expect(restorationFrame(27).rim).toBeGreaterThan(0)
    expect(restorationFrame(27.999).rim).toBeLessThan(.001)
  })

  it('keeps the legacy photo-cell curve and shader backed by the shared helper', () => {
    expect(progressivePhotoRevealState(0)).toEqual({ progress: 0, cellResolution: 112, cellInfluence: 0, alpha: 0.35 })
    expect(progressivePhotoRevealState(0.5)).toEqual({ progress: 0.5, cellResolution: 376, cellInfluence: 0.55, alpha: 0.675 })
    expect(progressivePhotoRevealState(1)).toEqual({ progress: 1, cellResolution: 640, cellInfluence: 0, alpha: 1 })
    expect(progressivePhotoRevealState(Number.NaN)).toEqual({ progress: 0, cellResolution: 112, cellInfluence: 0, alpha: 0.35 })
    expect(restoredPhotoFragment).toContain('progressivePhotoCellColor(vUv, restored, original)')
    expect(restoredPhotoFragment).toContain('progressivePhotoRevealAlpha(restored)')
    expect(progressivePhotoRevealGLSL).toContain('float cells = mix(112.0, 640.0, reveal);')
    expect(progressivePhotoRevealGLSL).toContain('float front = 4.0 * reveal * (1.0 - reveal);')
    expect(progressivePhotoRevealGLSL).toContain('mix(0.35, 1.0, reveal)')
  })

  it('shares one centered soft spatial front between photo coverage and particle dissolve', () => {
    const center = getProgressivePhotoRevealArrivalOrder(0.5, 0.5, 2)
    const wideEdge = getProgressivePhotoRevealArrivalOrder(1, 0.5, 2)
    const tallEdge = getProgressivePhotoRevealArrivalOrder(0.5, 1, 2)
    expect(center).toBeLessThan(0.01)
    expect(wideEdge).toBeGreaterThan(tallEdge)
    expect(getProgressivePhotoRevealCoverage(0, center)).toBe(0)
    expect(getProgressivePhotoRevealCoverage(1, wideEdge)).toBe(1)

    for (const [progress, arrival] of [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]] as const) {
      const edge = Math.max(0, Math.min(1, (arrival - (progress - 0.026)) / (2 * 0.026)))
      const expectedCoverage = 1 - edge * edge * (3 - 2 * edge)
      const coverage = getProgressivePhotoRevealCoverage(progress, arrival)
      expect(coverage).toBeCloseTo(expectedCoverage)
      expect(getProgressivePhotoParticleOpacity(progress, arrival)).toBeCloseTo(1 - expectedCoverage)
    }

    expect(progressivePhotoRevealGLSL).toContain('float feather = 0.026;')
    expect(progressivePhotoRevealGLSL).toContain('progressivePhotoRevealCoverage(progress, arrival)')
    expect(progressivePhotoRevealGLSL).toContain('return 1.0 - progressivePhotoRevealCoverage(progress, arrival);')
  })

  it('quantizes the aspect-aware arrival order into a map for the shared shader mask', () => {
    const size = 4
    const aspect = 1.5
    const map = createProgressivePhotoRevealMap(size, aspect)
    expect(map).toHaveLength(size * size)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const expected = Math.round(getProgressivePhotoRevealArrivalOrder((x + 0.5) / size, (y + 0.5) / size, aspect) * 255)
      expect(map[y * size + x]).toBe(expected)
    }
  })
})
