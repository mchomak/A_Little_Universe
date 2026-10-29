import { describe, expect, it } from 'vitest'
import { IDENTITY_ASCII_GLYPHS, identityAsciiGlyph } from './identityAscii'

describe('identity ASCII tone mapping', () => {
  it('maps bright subject tones to denser ink and removes the near-white backdrop', () => {
    expect(identityAsciiGlyph(0)).toBe(' ')
    expect(identityAsciiGlyph(.9)).toBe(IDENTITY_ASCII_GLYPHS[1])
    expect(identityAsciiGlyph(.95)).toBe(' ')
    expect(identityAsciiGlyph(-1)).toBe(' ')
    expect(identityAsciiGlyph(2)).toBe(' ')
  })

  it('preserves intermediate tones as distinguishable glyph densities', () => {
    const shadow = identityAsciiGlyph(.18)
    const mid = identityAsciiGlyph(.52)
    const light = identityAsciiGlyph(.84)
    expect(shadow).not.toBe(mid)
    expect(mid).not.toBe(light)
    expect(shadow).not.toBe(' ')
    expect(light).not.toBe(' ')
    expect(IDENTITY_ASCII_GLYPHS.indexOf(light)).toBeLessThan(IDENTITY_ASCII_GLYPHS.indexOf(mid))
  })
})
