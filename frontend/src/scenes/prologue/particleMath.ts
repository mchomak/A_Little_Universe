export interface ParticleBirthTimeInput {
  xNormalized: number
  yNormalized: number
  fractureWidth: number
  dissolveStart: number
  fractureDuration: number
  seed: number
}

export interface GlyphTextFragment {
  text: string
  left: number
  top: number
  right: number
  bottom: number
}

export interface GlyphTextLineRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface GlyphMaskLine {
  text: string
  left: number
  top: number
}

/** Reconstructs browser-wrapped text lines from measured glyph and line rectangles. */
export function groupGlyphFragmentsByLine(
  fragments: readonly GlyphTextFragment[],
  lineRects: readonly GlyphTextLineRect[],
): GlyphMaskLine[] {
  const lines = lineRects.map((rect) => ({ text: '', left: rect.left, top: rect.top, rect }))
  for (const fragment of fragments) {
    if (!fragment.text || lines.length === 0) continue
    const fragmentCenter = (fragment.top + fragment.bottom) / 2
    let bestLine = -1
    let bestOverlap = -1
    let bestDistance = Number.POSITIVE_INFINITY

    for (let index = 0; index < lines.length; index++) {
      const rect = lines[index]?.rect
      if (!rect) continue
      const overlap = Math.max(0, Math.min(fragment.bottom, rect.bottom) - Math.max(fragment.top, rect.top))
      const distance = Math.abs(fragmentCenter - (rect.top + rect.bottom) / 2)
      if (overlap > bestOverlap || (overlap === bestOverlap && distance < bestDistance)) {
        bestLine = index
        bestOverlap = overlap
        bestDistance = distance
      }
    }

    if (bestLine >= 0) lines[bestLine]!.text += fragment.text
  }

  return lines
    .filter(({ text }) => text.trim().length > 0)
    .map(({ text, left, top }) => ({ text, left, top }))
}

/** Rounds a requested count down to complete four-point shard groups. */
export function getPrologueParticleVertexCount(count: number): number {
  const requested = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  return Math.floor(requested / 4) * 4
}

export function getFractureFront(progress: number, _yNormalized: number, _fractureWidth: number, _seed: number): number {
  const amount = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  if (amount === 0 || amount === 1) return amount
  const y = Number.isFinite(_yNormalized) ? Math.min(1, Math.max(0, _yNormalized)) : 0.5
  const width = Number.isFinite(_fractureWidth) ? Math.min(0.18, Math.max(0, _fractureWidth)) : 0
  if (width === 0) return amount

  const scaledY = y * 6
  const lower = Math.floor(scaledY)
  const mix = smoothstep(scaledY - lower)
  const noise = lerp(latticeNoise(_seed, lower), latticeNoise(_seed, lower + 1), mix)
  const edgeEnvelope = 4 * amount * (1 - amount)
  return Math.min(1, Math.max(0, amount + noise * width * edgeEnvelope))
}

export function getParticleBirthTime(input: ParticleBirthTimeInput): number {
  const start = Number.isFinite(input.dissolveStart) ? input.dissolveStart : 0
  const duration = Number.isFinite(input.fractureDuration) ? Math.max(0, input.fractureDuration) : 0
  const x = Number.isFinite(input.xNormalized) ? Math.min(1, Math.max(0, input.xNormalized)) : 0
  const y = Number.isFinite(input.yNormalized) ? Math.min(1, Math.max(0, input.yNormalized)) : 0.5
  const width = Number.isFinite(input.fractureWidth) ? Math.min(0.18, Math.max(0, input.fractureWidth)) : 0
  if (duration === 0 || x === 0) return start
  if (x === 1) return start + duration

  let low = 0
  let high = 1
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2
    if (getFractureFront(middle, y, width, input.seed) >= x) high = middle
    else low = middle
  }
  return start + high * duration
}

export function getParticleFadeStart(travelDuration: number, fadeDuration: number): number {
  const travel = Number.isFinite(travelDuration) ? Math.max(0, travelDuration) : 0
  const fade = Number.isFinite(fadeDuration) ? Math.max(0, fadeDuration) : 0
  return Math.max(0, travel - fade)
}

export function getParticleSceneOpacity(
  time: number,
  dissolveStart: number,
  sceneDuration: number,
  fadeDuration: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion || !Number.isFinite(time) || !Number.isFinite(dissolveStart) || !Number.isFinite(sceneDuration)) return 0
  if (time < dissolveStart || time >= sceneDuration || sceneDuration <= dissolveStart) return 0
  const fade = Number.isFinite(fadeDuration) ? Math.max(0, fadeDuration) : 0
  const fadeStart = Math.max(dissolveStart, sceneDuration - fade)
  const fadeProgress = (time - fadeStart) / Math.max(0.001, sceneDuration - fadeStart)
  return 1 - smoothstep(fadeProgress)
}

export function resolvePrologueParticleCount(
  count: number,
  quality: 'standard' | 'low',
  dpr: number,
  compact: boolean,
): number {
  if (!Number.isFinite(count)) return 0
  const requested = Math.min(6000, Math.max(0, Math.floor(count)))
  const qualityScale = quality === 'low' ? 0.5 : 1
  const pixelScale = 1 / Math.sqrt(Number.isFinite(dpr) ? Math.max(1, dpr) : 1)
  const deviceScale = compact ? 0.7 : 1
  return Math.floor(requested * qualityScale * pixelScale * deviceScale)
}

function latticeNoise(seed: number, index: number): number {
  let value = ((Number.isFinite(seed) ? Math.trunc(seed) : 0) ^ Math.imul(index + 1, 0x9e3779b1)) | 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value ^= value >>> 16
  return ((value >>> 0) / 0xffffffff) * 2 - 1
}

function smoothstep(value: number): number {
  const amount = Math.min(1, Math.max(0, value))
  return amount * amount * (3 - 2 * amount)
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}
