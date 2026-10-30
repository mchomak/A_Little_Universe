import { expect, it, vi } from 'vitest'
import { ART_FONT_CATALOG, ART_FONT_REQUIRED_GLYPHS, fontCoversRequiredGlyphs, loadArtFont } from './fontCatalog'
import { ART_FONT_IDS } from './fontIds'
import badScriptFont from '../../assets/typography/BadScript-Regular.ttf?inline'
import caveatFont from '../../assets/typography/Caveat-Variable.ttf?inline'
import cormorantGaramondFont from '../../assets/typography/CormorantGaramond-Variable.ttf?inline'
import greatVibesFont from '../../assets/typography/GreatVibes-Regular.ttf?inline'
import marckScriptFont from '../../assets/typography/MarckScript-Regular.ttf?inline'

const inlineFontData = new Map([
  ['BadScript-Regular.ttf', badScriptFont],
  ['Caveat-Variable.ttf', caveatFont],
  ['CormorantGaramond-Variable.ttf', cormorantGaramondFont],
  ['GreatVibes-Regular.ttf', greatVibesFont],
  ['MarckScript-Regular.ttf', marckScriptFont],
])

it('catalogs Great Vibes with the existing local faces and verifies Russian letters including Yo', async () => {
  expect(ART_FONT_IDS).toContain('great-vibes')
  expect(ART_FONT_CATALOG.map(({ id }) => id)).toEqual(ART_FONT_IDS)
  expect(ART_FONT_REQUIRED_GLYPHS).toContain('Ё')
  expect(ART_FONT_REQUIRED_GLYPHS).toContain('ё')
  for (const font of ART_FONT_CATALOG) {
    const dataUrl = inlineFontData.get(font.fileName)
    if (!dataUrl) throw new Error(`Missing inline font fixture: ${font.fileName}`)
    expect(fontCoversRequiredGlyphs(decodeInlineFont(dataUrl)), font.label).toBe(true)
  }
})

it('waits for a catalog face and confirms the requested Russian glyphs', async () => {
  const load = vi.fn(async () => [{}])
  const check = vi.fn(() => true)
  vi.stubGlobal('document', { fonts: { load, check } })
  await expect(loadArtFont('caveat')).resolves.toBe(true)
  expect(load).toHaveBeenCalledWith('400 16px "Caveat"', ART_FONT_REQUIRED_GLYPHS)
  expect(check).toHaveBeenCalledWith('400 16px "Caveat"', ART_FONT_REQUIRED_GLYPHS)
  vi.unstubAllGlobals()
})

it('registers the bundled Great Vibes face before validating Russian text', async () => {
  const loadedFace = { family: 'Great Vibes' }
  const face = { load: vi.fn(async () => loadedFace) }
  const faceArguments: unknown[][] = []
  class FontFaceMock {
    constructor(...args: unknown[]) { faceArguments.push(args) }
    load() { return face.load() }
  }
  const add = vi.fn()
  const load = vi.fn(async () => [loadedFace])
  const check = vi.fn(() => true)
  vi.stubGlobal('document', { fonts: { load, check, add } })
  vi.stubGlobal('FontFace', FontFaceMock)

  await expect(loadArtFont('great-vibes')).resolves.toBe(true)

  const asset = ART_FONT_CATALOG.find(({ id }) => id === 'great-vibes')?.assetUrl
  expect(faceArguments).toEqual([['Great Vibes', `url("${asset}")`, { weight: '400' }]])
  expect(add).toHaveBeenCalledWith(loadedFace)
  expect(load).toHaveBeenCalledWith('400 16px "Great Vibes"', ART_FONT_REQUIRED_GLYPHS)
  vi.unstubAllGlobals()
})

function decodeInlineFont(dataUrl: string): ArrayBuffer {
  const separator = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || separator < 0) throw new Error('Expected an inline font data URL')
  const binary = atob(dataUrl.slice(separator + 1))
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return buffer
}
