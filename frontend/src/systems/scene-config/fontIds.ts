export const ART_FONT_IDS = ['great-vibes', 'marck-script', 'bad-script', 'caveat', 'cormorant-garamond'] as const
export type ArtFontId = (typeof ART_FONT_IDS)[number]

export function isArtFontId(value: unknown): value is ArtFontId {
  return typeof value === 'string' && (ART_FONT_IDS as readonly string[]).includes(value)
}
