import { createHandwritingSchedule } from '../../engine/filmConfig'

export function getMatterBirthProgress(x: number, y: number, width: number, seed: number, aspect = 1): number {
  // Small coherent islands, unrelated to reading direction: no paragraph-wide erasing edge.
  const scale = 360 + Math.max(0, width) * 100
  const px = x * scale, py = y * scale / Math.max(0.1, aspect)
  const ix = Math.floor(px), iy = Math.floor(py)
  const sx = smooth(px - ix), sy = smooth(py - iy)
  const a = mix(hash(ix, iy, seed), hash(ix + 1, iy, seed), sx)
  const b = mix(hash(ix, iy + 1, seed), hash(ix + 1, iy + 1, seed), sx)
  return Math.min(1, Math.max(0, 0.04 + mix(a, b, sy) * 0.92))
}

export function sampleGlyphParticlePixels(alpha: Uint8Array, width: number, height: number, count: number, seed: number): Float32Array {
  const result = new Float32Array(Math.max(0, Math.floor(Number.isFinite(count) ? count : 0)) * 2)
  const pixels: number[] = [], weights: number[] = []
  let total = 0
  for (let i = 0; i < Math.min(alpha.length, Math.max(0, width * height)); i++) if (alpha[i]) {
    total += alpha[i]!
    pixels.push(i); weights.push(total)
  }
  if (width < 1 || !total) return result
  const random = seededRandom(seed)
  for (let i = 0; i < result.length; i += 2) {
    const target = random() * total
    let lo = 0, hi = weights.length - 1
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (weights[mid]! < target) lo = mid + 1; else hi = mid }
    const pixel = pixels[lo]!
    result[i] = pixel % width + 0.5
    result[i + 1] = Math.floor(pixel / width) + 0.5
  }
  return result
}

export function seededRandom(seed: number) {
  let state = seed | 0
  return () => {
    state = state + 0x6d2b79f5 | 0
    let mixed = Math.imul(state ^ state >>> 15, state | 1)
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61)
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296
  }
}

interface Glyph { text: string; left: number; right: number; top: number; bottom: number; index: number; layoutIndex: number; zone: number }
export interface GraphemePosition { left: number; top: number }
export interface LetterRaster {
  width: number; height: number; scale: number
  rect: { x: number; y: number; width: number; height: number }
  /** RGBA channels: ink coverage, handwriting progress, grapheme dissolve zone, soft halo. */
  data: Uint8Array
  alpha: Uint8Array
  particleBirths: Uint8Array
  graphemeCount: number
  zoneWidth: number
}

/** Returns normalized dissolve order in the input layout's grapheme order. */
export function createGraphemeZones(glyphs: readonly GraphemePosition[], lineHeight: number): Float32Array {
  const threshold = Math.max(1, Number.isFinite(lineHeight) ? lineHeight * 0.4 : 19.2)
  const lines: Array<{ top: number; glyphs: Array<{ position: GraphemePosition; index: number }> }> = []
  glyphs.forEach((position, index) => {
    const line = lines.find((candidate) => Math.abs(candidate.top - position.top) < threshold)
    if (line) line.glyphs.push({ position, index })
    else lines.push({ top: position.top, glyphs: [{ position, index }] })
  })
  lines.sort((a, b) => a.top - b.top)
  const readingOrder = lines.flatMap((line) => line.glyphs.sort((a, b) => a.position.left - b.position.left || a.index - b.index))
  const zones = new Float32Array(glyphs.length)
  readingOrder.forEach((glyph, order) => { zones[glyph.index] = order / Math.max(1, glyphs.length) })
  return zones
}

/** Particle position and its existing release time come from the same immutable visible-ink raster pass. */
export function sampleLetterMatter(raster: LetterRaster, count: number, seed: number, start: number, fractureDuration: number): Float32Array {
  const pixels = sampleGlyphParticlePixels(raster.alpha, raster.width, raster.height, count, seed)
  const samples = new Float32Array(pixels.length / 2 * 3)
  for (let i = 0; i < pixels.length / 2; i++) {
    const x = pixels[i * 2]!, y = pixels[i * 2 + 1]!
    const pixel = Math.floor(y) * raster.width + Math.floor(x)
    samples.set([raster.rect.x + x / raster.scale, raster.rect.y + y / raster.scale, start + raster.particleBirths[pixel]! / 255 * fractureDuration], i * 3)
  }
  return samples
}

/** One whole-line atlas for GPU ink, with separately retained legacy particle release samples. */
export function rasterizeLetter(element: HTMLElement, viewport: DOMRect, rhythm: number, fractureWidth: number, seed: number): LetterRaster | null {
  const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
  const fontSize = Number.parseFloat(style.fontSize) || 48
  const padding = 12, scale = 2
  const width = Math.max(1, Math.ceil((rect.width + padding * 2) * scale))
  const height = Math.max(1, Math.ceil((rect.height + padding * 2) * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  const glyphs: Glyph[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), range = document.createRange()
  let node = walker.nextNode(), index = 0
  while (node) {
    const text = node.textContent ?? ''
    let offset = 0
    for (const grapheme of getGraphemes(text)) {
      const codePointCount = Array.from(grapheme).length
      range.setStart(node, offset); range.setEnd(node, offset + grapheme.length)
      const bounds = range.getBoundingClientRect()
      if (bounds.width > 0) glyphs.push({ text: grapheme, left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, index, layoutIndex: glyphs.length, zone: 0 })
      offset += grapheme.length; index += codePointCount
    }
    node = walker.nextNode()
  }
  range.detach()
  if (!glyphs.length) return null
  const zones = createGraphemeZones(glyphs, fontSize)
  for (const glyph of glyphs) glyph.zone = zones[glyph.layoutIndex] ?? 0
  context.scale(scale, scale)
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  context.fillStyle = '#fff'; context.textBaseline = 'alphabetic'
  const lines: Glyph[][] = []
  for (const glyph of glyphs) {
    const line = lines.find(items => Math.abs(items[0]!.top - glyph.top) < fontSize * 0.4)
    if (line) line.push(glyph); else lines.push([glyph])
  }
  for (const line of lines) {
    const text = line.map(g => g.text).join('')
    const metrics = context.measureText(text)
    const ascent = metrics.fontBoundingBoxAscent || fontSize * 0.8
    context.fillText(text, line[0]!.left - rect.left + padding, line[0]!.top - rect.top + padding + ascent)
  }
  const ink = context.getImageData(0, 0, width, height).data
  const haloCanvas = document.createElement('canvas')
  haloCanvas.width = width; haloCanvas.height = height
  const haloContext = haloCanvas.getContext('2d', { willReadFrequently: true })
  if (haloContext) { haloContext.filter = `blur(${2.2 * scale}px)`; haloContext.drawImage(canvas, 0, 0) }
  const halo = haloContext?.getImageData(0, 0, width, height).data
  const alpha = new Uint8Array(width * height), particleBirths = new Uint8Array(width * height), data = new Uint8Array(width * height * 4)
  const schedule = createHandwritingSchedule(element.textContent ?? '', 1, rhythm)
  for (let y = 0; y < height; y++) {
    const screenY = rect.top - padding + (y + 0.5) / scale
    const line = lines.reduce((best, item) => Math.abs(screenY - (item[0]!.top + item[0]!.bottom) / 2) < Math.abs(screenY - (best[0]!.top + best[0]!.bottom) / 2) ? item : best, lines[0]!)
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x
      const coverage = ink[pixel * 4 + 3] ?? 0
      const glow = halo?.[pixel * 4 + 3] ?? 0
      if (!coverage && !glow) continue
      const screenX = rect.left - padding + (x + 0.5) / scale
      const glyph = line.find(g => screenX <= g.right) ?? line[line.length - 1]!
      const beat = schedule[glyph.index] ?? { start: 0, duration: 1 }
      const localX = clamp((screenX - glyph.left) / Math.max(1, glyph.right - glyph.left))
      const localY = clamp((screenY - glyph.top) / Math.max(1, glyph.bottom - glyph.top))
      const stroke = localX * 0.78 + (glyph.index % 2 ? 1 - localY : localY) * 0.22
      const write = Math.min(0.985, beat.start + beat.duration * stroke)
      // Low-coverage edges release a few grains before the solid stroke interior.
      const birth = clamp(getMatterBirthProgress(x / width, y / height, fractureWidth, seed, width / height) - (coverage < 140 ? 0.085 : 0))
      alpha[pixel] = coverage
      particleBirths[pixel] = Math.round(birth * 255)
      data[pixel * 4] = coverage
      data[pixel * 4 + 1] = Math.round(write * 255)
      data[pixel * 4 + 2] = Math.round(glyph.zone * 255)
      data[pixel * 4 + 3] = glow
    }
  }
  canvas.width = 0; canvas.height = 0; haloCanvas.width = 0; haloCanvas.height = 0
  return { width, height, scale, alpha, particleBirths, data, graphemeCount: glyphs.length, zoneWidth: 1 / glyphs.length, rect: { x: rect.left - viewport.left - padding, y: rect.top - viewport.top - padding, width: width / scale, height: height / scale } }
}

function getGraphemes(text: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locales?: string | string[], options?: { granularity: 'grapheme' }) => { segment(input: string): Iterable<{ segment: string }> } }).Segmenter
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(text), ({ segment }) => segment)
  return Array.from(text)
}

function hash(x: number, y: number, seed: number) { const n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.0137) * 43758.5453; return n - Math.floor(n) }
function clamp(value: number) { return Math.min(1, Math.max(0, value)) }
function smooth(value: number) { return value * value * (3 - 2 * value) }
function mix(a: number, b: number, t: number) { return a + (b - a) * t }
