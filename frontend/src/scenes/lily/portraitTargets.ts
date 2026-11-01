export interface PortraitPixelSource {
  photoRgba: Uint8ClampedArray
  matteRgba: Uint8ClampedArray
  width: number
  height: number
}

export interface PortraitTarget {
  uv: [number, number]
  stage: number
  tone: number
  contrast?: number
  seed: number
}

interface Candidate extends PortraitTarget {
  x: number
  y: number
  weight: number
  contrast: number
  cumulative: number
}

const STAGE_QUOTAS = [0.3, 0.3, 0.23, 0.17]

export interface PortraitRouteCandidate {
  index: number
  screenDeltaX: number
  depth: number
}

export interface PortraitCameraBasis {
  eye: [number, number, number]
  forward: [number, number, number]
  right: [number, number, number]
  up: [number, number, number]
  center: [number, number, number]
  tanHalfFov: number
  aspect: number
  visibleWidth: number
  visibleHeight: number
}

export const PORTRAIT_STAGE_OFFSETS = [0, 0.24, 0.5, 0.74] as const
export const PORTRAIT_STAGE_WINDOW = 0.28

export function getPortraitStageReveal(time: number, start: number, duration: number, stage: number, lead = 0.27) {
  if (!Number.isFinite(time) || !Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) return 0
  const index = Math.min(3, Math.max(0, Math.floor(Number.isFinite(stage) ? stage : 0)))
  const stageStart = start + PORTRAIT_STAGE_OFFSETS[index]! * duration + Math.max(0, lead)
  const stageEnd = index === 3 ? start + duration : stageStart + duration * PORTRAIT_STAGE_WINDOW
  const progress = clamp((time - stageStart) / Math.max(0.001, stageEnd - stageStart), 0, 1)
  return progress * progress * (3 - 2 * progress)
}

export function createPortraitCameraBasis(input: {
  eye: readonly [number, number, number]
  lookAt: readonly [number, number, number]
  aspect: number
  fovDegrees: number
  planeDistance: number
}): PortraitCameraBasis {
  const forward = normalize(subtract(input.lookAt, input.eye), [0, 0, -1])
  let right = normalize(cross(forward, [0, 1, 0]), [1, 0, 0])
  if (!right.every(Number.isFinite)) right = [1, 0, 0]
  const up = normalize(cross(right, forward), [0, 1, 0])
  const aspect = Number.isFinite(input.aspect) && input.aspect > 0 ? input.aspect : 1
  const tanHalfFov = Math.tan((Number.isFinite(input.fovDegrees) ? input.fovDegrees : 38) * Math.PI / 360)
  const planeDistance = Number.isFinite(input.planeDistance) ? Math.max(0.1, input.planeDistance) : 3
  const visibleHeight = 2 * planeDistance * tanHalfFov
  const visibleWidth = visibleHeight * aspect
  return {
    eye: [...input.eye], forward, right, up,
    center: add(input.eye, multiply(forward, planeDistance)),
    tanHalfFov, aspect, visibleWidth, visibleHeight,
  }
}

export function projectPortraitPoint(point: readonly [number, number, number], basis: PortraitCameraBasis) {
  const relative = subtract(point, basis.eye)
  const depth = dot(relative, basis.forward)
  const divisor = Math.max(0.001, depth) * basis.tanHalfFov
  return {
    x: dot(relative, basis.right) / (divisor * basis.aspect),
    y: dot(relative, basis.up) / divisor,
    depth,
  }
}

/** Places sampled source coordinates on a camera-facing plane while preserving the source aspect. */
export function placePortraitTargets(
  targets: readonly PortraitTarget[],
  sourceAspect: number,
  basis: PortraitCameraBasis,
  scale: number,
  offsetX: number,
  offsetY: number,
): [number, number, number][] {
  const aspect = Number.isFinite(sourceAspect) && sourceAspect > 0 ? sourceAspect : 1
  const normalizedScale = Number.isFinite(scale) ? Math.min(1.25, Math.max(0.55, scale)) : 0.9
  const height = Math.min(basis.visibleHeight * 0.76, basis.visibleWidth * 0.76 / aspect) * normalizedScale
  const width = height * aspect
  const center = add(basis.center, add(
    multiply(basis.right, clamp(Number.isFinite(offsetX) ? offsetX : 0, -1, 1) * Math.max(0, (basis.visibleWidth - width) * 0.5)),
    multiply(basis.up, clamp(Number.isFinite(offsetY) ? offsetY : 0, -1, 1) * Math.max(0, (basis.visibleHeight - height) * 0.5)),
  ))
  return targets.map(({ uv }) => add(center, add(
    multiply(basis.right, (uv[0] - 0.5) * width),
    multiply(basis.up, (0.5 - uv[1]) * height),
  )))
}

/** Cubic Hermite travel with the vortex's entry velocity and a zero-velocity landing. */
export function getPortraitHermitePosition(
  start: readonly [number, number, number],
  velocity: readonly [number, number, number],
  target: readonly [number, number, number],
  elapsed: number,
  duration: number,
): [number, number, number] {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0
  if (safeDuration === 0) return [...target]
  const t = Math.min(1, Math.max(0, Number.isFinite(elapsed) ? elapsed / safeDuration : 0))
  const t2 = t * t, t3 = t2 * t
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  return [0, 1, 2].map((axis) => h00 * start[axis]! + h10 * safeDuration * velocity[axis]! + h01 * target[axis]!) as [number, number, number]
}

/**
 * Samples irregular, weighted points from the photo's foreground mask.
 * Stages are assigned from the source image regions and contrast; no face
 * geometry is invented and no image grid is exposed in the output.
 */
export function samplePortraitTargets(source: PortraitPixelSource, count: number, detail: number): PortraitTarget[] {
  const { photoRgba, matteRgba, width, height } = source
  const amount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  if (amount === 0 || !Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) return []
  if (photoRgba.length < width * height * 4 || matteRgba.length < width * height * 4) return []
  const detailScale = Number.isFinite(detail) ? Math.min(2, Math.max(0.5, detail)) : 1
  const candidates: Candidate[][] = [[], [], [], []]
  const desiredStep = Math.floor(Math.sqrt((width * height) / Math.max(1, amount * 2 * detailScale)))
  const maxStep = Math.max(1, Math.floor(Math.min(width, height) / 2))
  const sampleStep = Math.max(1, Math.min(desiredStep, maxStep))
  const toneAt = (index: number) => {
    const offset = index * 4
    return (photoRgba[offset]! * 0.2126 + photoRgba[offset + 1]! * 0.7152 + photoRgba[offset + 2]! * 0.0722) / 255
  }
  const maskAt = (index: number) => {
    const offset = index * 4
    const rgba = matteRgba
    const luminance = Math.max(rgba[offset]!, rgba[offset + 1]!, rgba[offset + 2]!) / 255
    return luminance * rgba[offset + 3]! / 255
  }
  let topForegroundRight = -1
  for (let y = 0; y < Math.max(1, Math.ceil(height * 0.025)); y++) for (let x = 0; x < width; x++) {
    if (maskAt(y * width + x) >= 0.16) topForegroundRight = Math.max(topForegroundRight, x)
  }
  for (let y = Math.floor(sampleStep / 2); y < height; y += sampleStep) for (let x = Math.floor(sampleStep / 2); x < width; x += sampleStep) {
    const index = y * width + x
    const tone = toneAt(index)
    const mask = maskAt(index)
    if (mask < 0.16) continue
    const stride = sampleStep
    const left = y * width + Math.max(0, x - stride)
    const right = y * width + Math.min(width - 1, x + stride)
    const above = Math.max(0, y - stride) * width + x
    const below = Math.min(height - 1, y + stride) * width + x
    const maskEdge = Math.max(Math.abs(mask - maskAt(left)), Math.abs(mask - maskAt(right)), Math.abs(mask - maskAt(above)), Math.abs(mask - maskAt(below)))
    const contrast = (Math.abs(tone - toneAt(left)) + Math.abs(tone - toneAt(right))
      + Math.abs(tone - toneAt(above)) + Math.abs(tone - toneAt(below))) * 0.25
    let localTone = 0
    for (const dy of [-stride, 0, stride]) for (const dx of [-stride, 0, stride]) {
      const sampleX = Math.min(width - 1, Math.max(0, x + dx))
      const sampleY = Math.min(height - 1, Math.max(0, y + dy))
      localTone += toneAt(sampleY * width + sampleX) / 9
    }
    const u = (x + 0.5) / width, v = (y + 0.5) / height
    const raisedArm = topForegroundRight >= 0 && u <= (topForegroundRight + 1) / width + 0.03 && v < 0.72
    const headHairContour = maskEdge >= 0.2 && tone < 0.72 && v < 0.68 && !raisedArm
    const faceDetail = !raisedArm && v <= 0.68 && mask > 0.5 && maskEdge < 0.35
      && localTone >= 0.23 && localTone <= 0.82 && contrast >= 0.075 * Math.sqrt(Math.min(sampleStep, 16))
    const remainingSilhouette = raisedArm || (tone < 0.28 && v < 0.82) || (maskEdge >= 0.12 && v < 0.92)
    const stage = headHairContour ? 0
      : faceDetail ? 1
        : remainingSilhouette ? 2 : 3
    const contrastWeight = 0.35 + contrast * (1.4 + detailScale * 0.9)
    const silhouetteWeight = 0.4 + maskEdge * 1.8
    const toneWeight = 0.78 + (1 - tone) * 0.22
    const facialContrastWeight = faceDetail ? 1 + Math.min(2.5, contrast * 10) : 1
    const weight = Math.max(0.0001, Math.pow(mask, 1.25) * (0.3 + silhouetteWeight * 0.45 + contrastWeight) * toneWeight * facialContrastWeight)
    candidates[stage]!.push({ x, y, uv: [u, v], stage, tone, contrast: clamp(contrast * 3, 0, 1), seed: 0, weight, cumulative: 0 })
  }
  if (candidates.every((stage) => stage.length === 0)) return []

  for (const stage of candidates) {
    let total = 0
    for (const candidate of stage) {
      total += candidate.weight
      candidate.cumulative = total
    }
  }

  const stageTotals = candidates.map((stage) => stage.at(-1)?.cumulative ?? 0)
  const targets: PortraitTarget[] = []
  const stageCounts = STAGE_QUOTAS.map((quota) => Math.floor(amount * quota))
  stageCounts[stageCounts.length - 1]! += amount - stageCounts.reduce((sum, value) => sum + value, 0)
  let ordinal = 0
  for (let stageIndex = 0; stageIndex < candidates.length; stageIndex++) {
    const stage = candidates[stageIndex]!
    const totalWeight = stageTotals[stageIndex]!
    const stageCount = stageCounts[stageIndex]!
    if (!stage.length || totalWeight <= 0) continue
    for (let i = 0; i < stageCount; i++) {
      const choice = random01(ordinal, 0x4f1bbcdc + stageIndex * 7919) * totalWeight
      let low = 0, high = stage.length - 1
      while (low < high) {
        const middle = (low + high) >>> 1
        if (stage[middle]!.cumulative < choice) low = middle + 1
        else high = middle
      }
      const candidate = stage[low]!
      const jitterX = (random01(ordinal, 0x218a9b27) - 0.5) * sampleStep * 0.9
      const jitterY = (random01(ordinal, 0x6a09e667) - 0.5) * sampleStep * 0.9
      let x = Math.min(width - 0.01, Math.max(0.01, candidate.x + 0.5 + jitterX))
      let y = Math.min(height - 0.01, Math.max(0.01, candidate.y + 0.5 + jitterY))
      if (maskAt(Math.floor(y) * width + Math.floor(x)) < 0.16) { x = candidate.x + 0.5; y = candidate.y + 0.5 }
      targets.push({
        uv: [x / width, y / height],
        stage: stageIndex,
        tone: candidate.tone,
        contrast: candidate.contrast,
        seed: random01(ordinal, 0x3c6ef372),
      })
      ordinal++
    }
  }

  // Redistribute a missing semantic region across source pixels when a crop or
  // mask does not contain enough candidates for every staged pool.
  const available = candidates.flat().filter((candidate) => candidate.weight > 0)
  const availableCumulative: number[] = []
  let availableWeight = 0
  for (const candidate of available) {
    availableWeight += candidate.weight
    availableCumulative.push(availableWeight)
  }
  while (targets.length < amount) {
    if (!available.length) break
    const choice = random01(ordinal, 0x510e527f) * availableWeight
    let low = 0, high = available.length - 1
    while (low < high) {
      const middle = (low + high) >>> 1
      if (availableCumulative[middle]! < choice) low = middle + 1
      else high = middle
    }
    const pick = available[low]!
    const x = pick.x + 0.5, y = pick.y + 0.5
    targets.push({ uv: [x / width, y / height], stage: pick.stage, tone: pick.tone, contrast: pick.contrast, seed: random01(ordinal, 0x3c6ef372) })
    ordinal++
  }
  return targets
}

/** Selects unique ids while reserving 70% for near, right-to-left candidates when available. */
export function selectPortraitCandidates(candidates: readonly PortraitRouteCandidate[], count: number): number[] {
  const amount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  if (amount === 0) return []
  const unique = [...new Map(candidates.filter((candidate) => Number.isFinite(candidate.depth)
    && Number.isFinite(candidate.screenDeltaX) && Number.isInteger(candidate.index))
    .map((candidate) => [candidate.index, candidate])).values()]
  const selectedCount = Math.min(amount, unique.length)
  if (!selectedCount) return []
  const depths = unique.map((candidate) => candidate.depth).sort((a, b) => a - b)
  const medianDepth = depths[Math.floor((depths.length - 1) / 2)]!
  const preferred = unique.filter((candidate) => candidate.screenDeltaX < -1e-4 && candidate.depth <= medianDepth)
  const preferredCount = Math.min(preferred.length, Math.ceil(selectedCount * 0.7))
  const preferenceKey = (candidate: PortraitRouteCandidate) => random01(candidate.index, 0x1f83d9ab)
  const chosen = preferred.slice().sort((a, b) => preferenceKey(a) - preferenceKey(b)).slice(0, preferredCount)
  const chosenIndices = new Set(chosen.map((candidate) => candidate.index))
  const minDepth = depths[0]!, depthRange = Math.max(0.001, depths.at(-1)! - minDepth)
  const remaining = unique.filter((candidate) => !chosenIndices.has(candidate.index))
  remaining.sort((a, b) => {
    const score = (candidate: PortraitRouteCandidate) => (candidate.depth - minDepth) / depthRange
      + (candidate.screenDeltaX < -1e-4 ? 0 : 1)
      - Math.min(0.5, Math.abs(candidate.screenDeltaX)) * 0.15
    return score(a) - score(b) || preferenceKey(a) - preferenceKey(b)
  })
  for (const candidate of remaining.slice(0, selectedCount - chosen.length)) chosen.push(candidate)
  return chosen.map((candidate) => candidate.index)
}

function random01(index: number, salt: number) {
  let value = (Math.imul(index + 1, 0x9e3779b1) + salt) | 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  value ^= value >>> 16
  return (value >>> 0) / 0x100000000
}

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)) }
function add(a: readonly [number, number, number], b: readonly [number, number, number]): [number, number, number] { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
function subtract(a: readonly [number, number, number], b: readonly [number, number, number]): [number, number, number] { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
function multiply(a: readonly [number, number, number], scalar: number): [number, number, number] { return [a[0] * scalar, a[1] * scalar, a[2] * scalar] }
function dot(a: readonly [number, number, number], b: readonly [number, number, number]) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
function cross(a: readonly [number, number, number], b: readonly [number, number, number]): [number, number, number] { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
function normalize(value: readonly [number, number, number], fallback: [number, number, number]): [number, number, number] {
  const length = Math.hypot(...value)
  return length > 1e-8 ? multiply(value, 1 / length) : fallback
}
