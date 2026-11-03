import { DEFAULT_PARTICLE_PROFILES, DEFAULT_PORTRAIT_STRUCTURE_SETTINGS, type ParticleProfiles, type PortraitStructureSettings } from './particleProfiles'
import { sampleStarPortraitTargets, type StarPortraitPoint, type StarPortraitSamplingSettings, type StarPortraitSource } from '../scenes/lily/starPortraitTargets'

export type StrokeKind = 'contour' | 'flow'
export type Stroke = { id: string; kind: StrokeKind; points: { x: number; y: number }[]; spacing: number; jitter: number; brightness: number; width: number; smooth: number; size: number }
export type HybridPoint = StarPortraitPoint & { type: 'fill' | 'support' | StrokeKind; artSize: number; artBrightness: number }

function srgbByteToLinear(value: number) {
  const srgb = Math.max(0, Math.min(255, value)) / 255
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

type DistanceField = { values: Float32Array; columns: number; rows: number; resolution: number }

/** Coarse Euclidean-like distance field for feature strokes, built deterministically in two passes. */
export function buildContourDistanceField(width: number, height: number, strokes: readonly Stroke[], maxGridEdge = 512): DistanceField {
  const resolution = Math.max(1, Math.ceil(Math.max(width, height) / maxGridEdge))
  const columns = Math.ceil(width / resolution), rows = Math.ceil(height / resolution)
  const values = new Float32Array(columns * rows)
  values.fill(Number.POSITIVE_INFINITY)
  const contours = strokes.filter((stroke) => stroke.kind === 'contour')
  const stamp = (x: number, y: number) => {
    const gx = Math.max(0, Math.min(columns - 1, Math.floor(x / resolution)))
    const gy = Math.max(0, Math.min(rows - 1, Math.floor(y / resolution)))
    values[gy * columns + gx] = 0
  }
  for (const stroke of contours) {
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1]!, b = stroke.points[i]!
      const dx = b.x - a.x, dy = b.y - a.y
      const length = Math.hypot(dx, dy)
      const steps = Math.max(1, Math.ceil(length / (resolution * 0.6)))
      for (let step = 0; step <= steps; step++) {
        const t = step / steps
        stamp(a.x + dx * t, a.y + dy * t)
      }
    }
  }

  const diagonal = Math.SQRT2
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const index = y * columns + x
    let distance = values[index]!
    if (x > 0) distance = Math.min(distance, values[index - 1]! + 1)
    if (y > 0) distance = Math.min(distance, values[index - columns]! + 1)
    if (x > 0 && y > 0) distance = Math.min(distance, values[index - columns - 1]! + diagonal)
    if (x + 1 < columns && y > 0) distance = Math.min(distance, values[index - columns + 1]! + diagonal)
    values[index] = distance
  }
  for (let y = rows - 1; y >= 0; y--) for (let x = columns - 1; x >= 0; x--) {
    const index = y * columns + x
    let distance = values[index]!
    if (x + 1 < columns) distance = Math.min(distance, values[index + 1]! + 1)
    if (y + 1 < rows) distance = Math.min(distance, values[index + columns]! + 1)
    if (x + 1 < columns && y + 1 < rows) distance = Math.min(distance, values[index + columns + 1]! + diagonal)
    if (x > 0 && y + 1 < rows) distance = Math.min(distance, values[index + columns - 1]! + diagonal)
    values[index] = distance
  }
  return { values, columns, rows, resolution }
}

function distanceAt(field: DistanceField, x: number, y: number) {
  const gx = Math.max(0, Math.min(field.columns - 1, Math.floor(x / field.resolution)))
  const gy = Math.max(0, Math.min(field.rows - 1, Math.floor(y / field.resolution)))
  return field.values[gy * field.columns + gx]! * field.resolution
}

function makeContourMasks(source: StarPortraitSource, density: Uint8Array, suppression: Uint8Array, strokes: readonly Stroke[], structure: PortraitStructureSettings) {
  const distance = buildContourDistanceField(source.width, source.height, strokes)
  const fill = new Uint8Array(density.length)
  const support = new Uint8Array(density.length)
  const { supportWidth, fillSuppression, minFaceFill } = structure
  const featureReach = supportWidth * 2.4
  let maskedMass = 0, supportMass = 0
  for (let index = 0; index < density.length; index++) {
    const x = index % source.width, y = Math.floor(index / source.width)
    const d = distanceAt(distance, x, y)
    const nearFeature = Math.exp(-0.5 * (d / Math.max(2, supportWidth * 0.72)) ** 2)
    const faceProximity = Math.exp(-0.5 * (d / Math.max(2, supportWidth * 1.45)) ** 2)
    const originalDensity = density[index]! / 255
    const maskSuppression = suppression[index]! / 255
    const maskedDensity = originalDensity * (1 - maskSuppression)
    maskedMass += maskedDensity
    const reducedFill = maskedDensity * (1 - fillSuppression * nearFeature)
    // The floor preserves a share of the already-masked density, so it cannot cancel either user mask.
    const contourFloor = maskedDensity * (1 - (1 - minFaceFill) * faceProximity)
    fill[index] = Math.round(Math.max(reducedFill, contourFloor) * 255)

    if (d > featureReach || originalDensity === 0) continue
    // A soft, slightly hollow Gaussian creates a stochastic cloud around the stroke instead of a bright outline.
    const gaussian = Math.exp(-0.5 * (d / Math.max(2, supportWidth * 0.72)) ** 2)
    const hollowCore = 1 - Math.exp(-0.5 * (d / Math.max(2, structure.contourMinSpacing * 1.4)) ** 2)
    support[index] = Math.round(Math.max(0, maskedDensity * gaussian * hollowCore) * 255)
    supportMass += support[index]! / 255
  }
  return { fill, support, supportCoverage: maskedMass > 0 ? Math.min(1, supportMass / maskedMass * 2) : 0 }
}

function sourceOffsetAt(source: StarPortraitSource, x: number, y: number) {
  return (Math.floor(y) * source.width + Math.floor(x)) * 4
}

/** Sample contour, support and photographic fill targets without carving hard gaps beside feature lines. */
export function sampleHybrid(
  source: StarPortraitSource,
  settings: StarPortraitSamplingSettings,
  density: Uint8Array,
  suppression: Uint8Array,
  strokes: readonly Stroke[],
  profiles: ParticleProfiles = DEFAULT_PARTICLE_PROFILES,
  structure: PortraitStructureSettings = DEFAULT_PORTRAIT_STRUCTURE_SETTINGS,
): HybridPoint[] {
  const requestedCount = Math.max(0, Math.min(32_000, Math.floor(settings.count)))
  if (requestedCount === 0) return []
  if (density.length !== source.width * source.height || suppression.length !== density.length) throw new RangeError('Portrait masks do not match source dimensions.')

  const masks = makeContourMasks(source, density, suppression, strokes, structure)
  const manual: HybridPoint[] = []
  // Check actual jittered positions across all feature strokes, including intersections.
  const contourBuckets = new Map<string, Array<{ x: number; y: number }>>()
  const contourSpacing = Math.max(3, structure.contourMinSpacing)
  let randomState = (settings.seed ?? 20903) >>> 0
  const random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296 }
  manualSampling: for (const stroke of strokes) {
    const profile = profiles[stroke.kind]
    if (profile.density <= 0) continue
    const points = stroke.points.map((point, index, array) => {
      if (!index || index === array.length - 1) return point
      const amount = Math.max(0, Math.min(1, stroke.smooth)) * .5
      return { x: point.x * (1 - amount) + (array[index - 1]!.x + array[index + 1]!.x) * amount / 2, y: point.y * (1 - amount) + (array[index - 1]!.y + array[index + 1]!.y) * amount / 2 }
    })
    let remaining = 0
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!, b = points[i]!
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy)
      if (length < .001) continue
      const minDistance = stroke.kind === 'contour' ? structure.contourMinSpacing : 3
      const spacing = Math.max(minDistance, stroke.spacing / profile.density)
      for (let d = remaining; d < length; d += spacing) {
        if (manual.length >= requestedCount) break manualSampling
        const scatter = (random() - .5) * (stroke.kind === 'flow' ? stroke.width : stroke.jitter * 2) * profile.jitter
        const along = (random() - .5) * Math.min(spacing * .7, stroke.jitter * profile.jitter)
        const x = Math.max(0, Math.min(source.width - 1, a.x + dx * (d + along) / length - dy / length * scatter))
        const y = Math.max(0, Math.min(source.height - 1, a.y + dy * (d + along) / length + dx / length * scatter))
        const pointSeed = random()
        if (stroke.kind === 'contour') {
          const bx = Math.floor(x / contourSpacing), by = Math.floor(y / contourSpacing)
          let crowded = false
          for (let yy = by - 1; yy <= by + 1 && !crowded; yy++) for (let xx = bx - 1; xx <= bx + 1 && !crowded; xx++) {
            crowded = (contourBuckets.get(`${xx},${yy}`) ?? []).some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < contourSpacing ** 2)
          }
          if (crowded) continue
          const key = `${bx},${by}`
          const bucket = contourBuckets.get(key) ?? []
          bucket.push({ x, y }); contourBuckets.set(key, bucket)
        }
        const offset = sourceOffsetAt(source, x, y)
        const tone = Math.max(.15, Math.min(1, stroke.brightness * .5))
        manual.push({ u: x / source.width, v: y / source.height, tone, contrast: .45, featureWeight: 1, seed: pointSeed, photoColorLinear: [srgbByteToLinear(source.photoRgba[offset]!), srgbByteToLinear(source.photoRgba[offset + 1]!), srgbByteToLinear(source.photoRgba[offset + 2]!)], type: stroke.kind, artSize: stroke.size * profile.size, artBrightness: stroke.brightness * profile.brightness })
      }
      remaining = (remaining - length % spacing + spacing) % spacing
    }
  }

  const remainingCount = Math.max(0, requestedCount - manual.length)
  const supportBudget = Math.min(remainingCount, Math.round(remainingCount * structure.supportMix * profiles.support.density * masks.supportCoverage))
  const supportSettings = { ...settings, count: supportBudget, seed: ((settings.seed ?? 20903) + 0x6d2b79f5) >>> 0, irregularity: Math.min(1, Math.max(settings.irregularity, .72) * profiles.support.jitter) }
  const support = supportBudget > 0
    ? sampleStarPortraitTargets({ ...source, importanceMask: masks.support }, supportSettings).map((point) => ({
      ...point,
      type: 'support' as const,
      featureWeight: point.featureWeight * .62,
      contrast: point.contrast * .76,
      artSize: profiles.support.size,
      artBrightness: profiles.support.brightness,
    }))
    : []
  const fillBudget = Math.max(0, remainingCount - support.length)
  const fillSettings = { ...settings, count: Math.min(32_000, Math.round(fillBudget * profiles.fill.density)), irregularity: Math.min(1, settings.irregularity * profiles.fill.jitter) }
  const fill = fillBudget > 0
    ? sampleStarPortraitTargets({ ...source, importanceMask: masks.fill }, fillSettings).map((point) => ({ ...point, type: 'fill' as const, artSize: profiles.fill.size, artBrightness: profiles.fill.brightness }))
    : []
  return [...manual, ...support, ...fill].slice(0, requestedCount)
}
