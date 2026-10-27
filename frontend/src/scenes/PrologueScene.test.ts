import { describe, expect, it } from 'vitest'
import { sampleGlyphParticlePixels } from './PrologueScene'

describe('prologue glyph particles', () => {
  it('samples only glyph pixels and reproduces the same seeded positions', () => {
    const mask = new Uint8Array([
      0, 255, 255, 0,
      0, 255, 0, 255,
    ])
    const first = sampleGlyphParticlePixels(mask, 4, 2, 12, 1420577)
    const replay = sampleGlyphParticlePixels(mask, 4, 2, 12, 1420577)
    const otherSeed = sampleGlyphParticlePixels(mask, 4, 2, 12, 1420578)
    const glyphPixels = new Set(['1.5,0.5', '2.5,0.5', '1.5,1.5', '3.5,1.5'])

    expect(Array.from(first)).toEqual(Array.from(replay))
    expect(Array.from(first)).not.toEqual(Array.from(otherSeed))
    expect(first).toHaveLength(24)
    for (let index = 0; index < first.length; index += 2) {
      expect(glyphPixels.has(`${first[index]},${first[index + 1]}`)).toBe(true)
    }
  })
})
