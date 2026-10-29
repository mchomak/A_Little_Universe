/** Glyphs are ordered from dense to sparse; bright subject tones carry more ink. */
export const IDENTITY_ASCII_GLYPHS = '@%#*+=-:. '
export const IDENTITY_ASCII_BACKGROUND_CUTOFF = 0.94

export function identityAsciiGlyph(luminance: number) {
  const bounded = Math.min(1, Math.max(0, luminance))
  if (bounded >= IDENTITY_ASCII_BACKGROUND_CUTOFF) return ' '
  const index = Math.round((1 - bounded) * (IDENTITY_ASCII_GLYPHS.length - 1))
  return IDENTITY_ASCII_GLYPHS[index] ?? ' '
}
