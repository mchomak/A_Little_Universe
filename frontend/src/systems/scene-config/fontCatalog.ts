import type { ArtFontId } from './fontIds'
import { isArtFontId } from './fontIds'
import greatVibesAsset from '../../assets/typography/GreatVibes-Regular.ttf?url'

export interface ArtFontDefinition {
  readonly id: ArtFontId
  readonly label: string
  readonly family: string
  readonly fileName: string
  readonly source: string
  readonly assetUrl?: string
}

export const ART_FONT_REQUIRED_GLYPHS = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя0123456789«»—…!?.,:;'

export const ART_FONT_CATALOG: readonly ArtFontDefinition[] = Object.freeze([
  Object.freeze({ id: 'great-vibes', label: 'Great Vibes', family: 'Great Vibes', fileName: 'GreatVibes-Regular.ttf', source: 'https://github.com/google/fonts/tree/main/ofl/greatvibes', assetUrl: greatVibesAsset }),
  Object.freeze({ id: 'marck-script', label: 'Marck Script', family: 'Marck Script', fileName: 'MarckScript-Regular.ttf', source: 'https://github.com/google/fonts/tree/main/ofl/marckscript' }),
  Object.freeze({ id: 'bad-script', label: 'Bad Script', family: 'Bad Script', fileName: 'BadScript-Regular.ttf', source: 'https://github.com/google/fonts/tree/main/ofl/badscript' }),
  Object.freeze({ id: 'caveat', label: 'Caveat', family: 'Caveat', fileName: 'Caveat-Variable.ttf', source: 'https://github.com/google/fonts/tree/main/ofl/caveat' }),
  Object.freeze({ id: 'cormorant-garamond', label: 'Cormorant Garamond', family: 'Cormorant Garamond', fileName: 'CormorantGaramond-Variable.ttf', source: 'https://github.com/google/fonts/tree/main/ofl/cormorantgaramond' }),
])

const catalogById = new Map(ART_FONT_CATALOG.map((font) => [font.id, font]))
const readyFaces = new Map<ArtFontId, Promise<boolean>>()

export function loadArtFont(id: ArtFontId): Promise<boolean> {
  if (!isArtFontId(id)) return Promise.resolve(false)
  const existing = readyFaces.get(id)
  if (existing) return existing
  const font = catalogById.get(id)
  if (!font) return Promise.resolve(false)

  const pending = loadFace(font)
  readyFaces.set(id, pending)
  void pending.then((ready) => { if (!ready) readyFaces.delete(id) })
  return pending
}

async function loadFace(font: ArtFontDefinition): Promise<boolean> {
  if (typeof document === 'undefined' || !document.fonts) return false
  const descriptor = `400 16px "${font.family}"`
  try {
    if (font.assetUrl) {
      if (typeof FontFace === 'undefined') return false
      const face = await new FontFace(font.family, `url("${font.assetUrl}")`, { weight: '400' }).load()
      document.fonts.add(face)
    }
    const faces = await document.fonts.load(descriptor, ART_FONT_REQUIRED_GLYPHS)
    return faces.length > 0 && document.fonts.check(descriptor, ART_FONT_REQUIRED_GLYPHS)
  } catch {
    return false
  }
}

/** Reads Unicode cmap formats 4/12 from the shipped TrueType font binary. */
export function fontCoversRequiredGlyphs(bytes: ArrayBuffer, glyphs = ART_FONT_REQUIRED_GLYPHS): boolean {
  try {
    const view = new DataView(bytes)
    if (view.byteLength < 12) return false
    const tableCount = view.getUint16(4)
    let cmapOffset = -1
    let cmapLength = 0
    for (let index = 0; index < tableCount; index++) {
      const record = 12 + index * 16
      if (record + 16 > view.byteLength) return false
      if (view.getUint32(record) === 0x636d6170) {
        cmapOffset = view.getUint32(record + 8)
        cmapLength = view.getUint32(record + 12)
        break
      }
    }
    if (cmapOffset < 0 || cmapOffset + cmapLength > view.byteLength || cmapLength < 4) return false

    const subtableCount = view.getUint16(cmapOffset + 2)
    const subtables: number[] = []
    for (let index = 0; index < subtableCount; index++) {
      const record = cmapOffset + 4 + index * 8
      if (record + 8 > cmapOffset + cmapLength) return false
      const platform = view.getUint16(record)
      const encoding = view.getUint16(record + 2)
      const offset = cmapOffset + view.getUint32(record + 4)
      if ((platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))) && offset + 2 <= cmapOffset + cmapLength) subtables.push(offset)
    }
    return Array.from(glyphs).every((glyph) => {
      const codepoint = glyph.codePointAt(0)!
      return subtables.some((offset) => hasGlyph(view, offset, codepoint))
    })
  } catch {
    return false
  }
}

function hasGlyph(view: DataView, offset: number, codepoint: number): boolean {
  const format = view.getUint16(offset)
  if (format === 12) {
    const length = view.getUint32(offset + 4)
    const groupCount = view.getUint32(offset + 12)
    if (offset + length > view.byteLength) return false
    let low = 0
    let high = groupCount - 1
    while (low <= high) {
      const middle = (low + high) >>> 1
      const group = offset + 16 + middle * 12
      const start = view.getUint32(group)
      const end = view.getUint32(group + 4)
      if (codepoint < start) high = middle - 1
      else if (codepoint > end) low = middle + 1
      else return view.getUint32(group + 8) + codepoint - start !== 0
    }
    return false
  }
  if (format !== 4) return false

  const length = view.getUint16(offset + 2)
  const segmentCount = view.getUint16(offset + 6) / 2
  if (offset + length > view.byteLength || codepoint > 0xffff) return false
  const endCodes = offset + 14
  const startCodes = endCodes + segmentCount * 2 + 2
  const deltas = startCodes + segmentCount * 2
  const rangeOffsets = deltas + segmentCount * 2
  for (let index = 0; index < segmentCount; index++) {
    const end = view.getUint16(endCodes + index * 2)
    if (codepoint > end) continue
    const start = view.getUint16(startCodes + index * 2)
    if (codepoint < start) return false
    const delta = view.getInt16(deltas + index * 2)
    const range = view.getUint16(rangeOffsets + index * 2)
    let glyph = (codepoint + delta) & 0xffff
    if (range !== 0) {
      const glyphIndex = view.getUint16(rangeOffsets + index * 2 + range + (codepoint - start) * 2)
      glyph = glyphIndex === 0 ? 0 : (glyphIndex + delta) & 0xffff
    }
    return glyph !== 0
  }
  return false
}
