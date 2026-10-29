import { describe, expect, it } from 'vitest'
import { restorationStart, restoredPixel, restorationFrame } from './identityRestoration'

describe('04.6 local photographic restoration', () => {
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
})
