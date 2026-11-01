export type StarPortraitSource = {
  width: number
  height: number
  photoRgba: Uint8ClampedArray
  matteRgba: Uint8ClampedArray
}

export type StarPortraitSamplingSettings = {
  count: number
  detailBoost: number
  fillDensity: number
  contrast: number
  backgroundThreshold: number
  irregularity: number
  seed?: number
}

export type StarPortraitPoint = {
  u: number
  v: number
  tone: number
  contrast: number
  featureWeight: number
  seed: number
  photoColorLinear: readonly [number, number, number]
}

const MAX_PARTICLES = 32_000
const MAX_GRID_EDGE = 640
const DEFAULT_SEED = 0x51a7

type Candidate = {
  gridX: number
  gridY: number
  sourceOffset: number
  tone: number
  coverage: number
  matteEdge: number
  gradient: number
  colorGradient: number
  texture: number
}

/**
 * Samples a deterministic, variable-density star field from an RGBA photo and matte.
 * The matte may be an alpha mask or an opaque grayscale mask.
 */
export function sampleStarPortraitTargets(source: StarPortraitSource, settings: StarPortraitSamplingSettings): StarPortraitPoint[] {
  validateSource(source)
  const requestedCount = clampInteger(settings.count, 0, MAX_PARTICLES)
  if (requestedCount === 0) return []

  const scale = Math.min(1, MAX_GRID_EDGE / Math.max(source.width, source.height))
  const gridWidth = Math.max(1, Math.round(source.width * scale))
  const gridHeight = Math.max(1, Math.round(source.height * scale))
  const gridLength = gridWidth * gridHeight
  const photoLuma = new Float32Array(gridLength)
  const photoColorLinear = new Float32Array(gridLength * 3)
  const coverage = new Float32Array(gridLength)
  const sourceOffsets = new Uint32Array(gridLength)

  let minAlpha = 255
  let maxAlpha = 0
  for (let offset = 3; offset < source.matteRgba.length; offset += 4) {
    const alpha = source.matteRgba[offset]!
    minAlpha = Math.min(minAlpha, alpha)
    maxAlpha = Math.max(maxAlpha, alpha)
  }
  const useAlphaMask = maxAlpha - minAlpha > 1

  for (let gy = 0; gy < gridHeight; gy += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor((gy + 0.5) * source.height / gridHeight))
    for (let gx = 0; gx < gridWidth; gx += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((gx + 0.5) * source.width / gridWidth))
      const sourceOffset = (sourceY * source.width + sourceX) * 4
      const index = gy * gridWidth + gx
      sourceOffsets[index] = sourceOffset
      const red = source.photoRgba[sourceOffset]! / 255
      const green = source.photoRgba[sourceOffset + 1]! / 255
      const blue = source.photoRgba[sourceOffset + 2]! / 255
      const linearRed = srgbToLinear(red)
      const linearGreen = srgbToLinear(green)
      const linearBlue = srgbToLinear(blue)
      const colorOffset = index * 3
      photoColorLinear[colorOffset] = linearRed
      photoColorLinear[colorOffset + 1] = linearGreen
      photoColorLinear[colorOffset + 2] = linearBlue
      photoLuma[index] = linearRed * 0.2126 + linearGreen * 0.7152 + linearBlue * 0.0722

      const maskRed = source.matteRgba[sourceOffset]! / 255
      const maskGreen = source.matteRgba[sourceOffset + 1]! / 255
      const maskBlue = source.matteRgba[sourceOffset + 2]! / 255
      coverage[index] = useAlphaMask
        ? source.matteRgba[sourceOffset + 3]! / 255
        : maskRed * 0.2126 + maskGreen * 0.7152 + maskBlue * 0.0722
    }
  }

  const threshold = clampFinite(settings.backgroundThreshold, 0.05, 0.95, 0.16)
  const contrastGain = clampFinite(settings.contrast, 0, 3, 1)
  const detailGain = clampFinite(settings.detailBoost, 0, 3, 1)
  const fillGain = clampFinite(settings.fillDensity, 0, 3, 1)
  const irregularity = clampFinite(settings.irregularity, 0, 1, 0.55)
  const featureFloor = 0.22 + fillGain * 0.62
  const candidates: Candidate[] = []
  const cumulativeWeights = new Float64Array(gridLength)
  let totalWeight = 0

  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const index = y * gridWidth + x
      const rawCoverage = coverage[index]!
      if (rawCoverage < threshold) continue

      const left = coverage[y * gridWidth + Math.max(0, x - 1)]!
      const right = coverage[y * gridWidth + Math.min(gridWidth - 1, x + 1)]!
      const up = coverage[Math.max(0, y - 1) * gridWidth + x]!
      const down = coverage[Math.min(gridHeight - 1, y + 1) * gridWidth + x]!
      const matteEdge = Math.min(1, (Math.abs(right - left) + Math.abs(down - up)) * 0.5)

      const luma = photoLuma[index]!
      const leftLuma = photoLuma[y * gridWidth + Math.max(0, x - 1)]!
      const rightLuma = photoLuma[y * gridWidth + Math.min(gridWidth - 1, x + 1)]!
      const upLuma = photoLuma[Math.max(0, y - 1) * gridWidth + x]!
      const downLuma = photoLuma[Math.min(gridHeight - 1, y + 1) * gridWidth + x]!
      const gradient = Math.min(1, Math.hypot(rightLuma - leftLuma, downLuma - upLuma) * 0.9)
      const colorGradient = localColorGradient(photoColorLinear, gridWidth, gridHeight, x, y)
      const texture = localTexture(photoLuma, gridWidth, gridHeight, x, y, luma)
      const featureWeight = Math.min(1, Math.max(0, (gradient * 1.15 + colorGradient + texture * 1.7 + matteEdge * 1.25) * contrastGain))
      const visibleCoverage = (rawCoverage - threshold) / Math.max(0.05, 1 - threshold)
      const weight = Math.max(0.0001, visibleCoverage) * (featureFloor + detailGain * featureWeight * 2.8)

      totalWeight += weight
      cumulativeWeights[candidates.length] = totalWeight
      candidates.push({ gridX: x, gridY: y, sourceOffset: sourceOffsets[index]!, tone: luma, coverage: visibleCoverage, matteEdge, gradient, colorGradient, texture })
    }
  }

  if (candidates.length === 0 || totalWeight <= 0) return []

  const random = createRandom(settings.seed)
  const desiredSpacing = Math.max(0.28, Math.sqrt(candidates.length / requestedCount) * 0.3 * (1 - irregularity * 0.45))
  const bucketSize = Math.max(0.28, desiredSpacing)
  const bucketColumns = Math.ceil(gridWidth / bucketSize) + 1
  const buckets = new Map<number, number[]>()
  const acceptedPixels: Array<{ x: number; y: number }> = []
  const points: StarPortraitPoint[] = []
  const maxAttempts = requestedCount * 18
  let attempts = 0

  while (points.length < requestedCount && attempts < maxAttempts) {
    attempts += 1
    const candidateIndex = findWeightedCandidate(cumulativeWeights, candidates, totalWeight, random())
    const candidate = candidates[candidateIndex]!
    const gx = candidate.gridX
    const gy = candidate.gridY
    const jitter = 0.22 + irregularity * 0.68
    const x = gx + (random() - 0.5) * jitter
    const y = gy + (random() - 0.5) * jitter
    const bucketX = Math.floor(x / bucketSize)
    const bucketY = Math.floor(y / bucketSize)
    let crowded = false

    for (let by = bucketY - 1; by <= bucketY + 1 && !crowded; by += 1) {
      for (let bx = bucketX - 1; bx <= bucketX + 1 && !crowded; bx += 1) {
        const nearby = buckets.get(by * bucketColumns + bx)
        if (!nearby) continue
        for (const pointIndex of nearby) {
          const prior = acceptedPixels[pointIndex]!
          if ((prior.x - x) ** 2 + (prior.y - y) ** 2 < desiredSpacing ** 2) {
            crowded = true
            break
          }
        }
      }
    }
    if (crowded) continue

    const pointIndex = points.length
    const bucketKey = bucketY * bucketColumns + bucketX
    const bucket = buckets.get(bucketKey)
    if (bucket) bucket.push(pointIndex)
    else buckets.set(bucketKey, [pointIndex])
    acceptedPixels.push({ x, y })

    const offset = candidate.sourceOffset
    const colorRed = srgbToLinear(source.photoRgba[offset]! / 255)
    const colorGreen = srgbToLinear(source.photoRgba[offset + 1]! / 255)
    const colorBlue = srgbToLinear(source.photoRgba[offset + 2]! / 255)
    const featureWeight = Math.min(1, Math.max(0, (candidate.gradient + candidate.colorGradient) * contrastGain + candidate.texture * detailGain + candidate.matteEdge))
    points.push({
      u: Math.min(1, Math.max(0, (x + 0.5) / gridWidth)),
      v: Math.min(1, Math.max(0, (y + 0.5) / gridHeight)),
      tone: candidate.tone,
      contrast: Math.min(1, Math.max(0, candidate.gradient * contrastGain + candidate.texture * 1.2)),
      featureWeight,
      seed: random(),
      photoColorLinear: [colorRed, colorGreen, colorBlue],
    })
  }

  return points
}

function validateSource(source: StarPortraitSource) {
  if (!Number.isInteger(source.width) || source.width <= 0 || !Number.isInteger(source.height) || source.height <= 0) {
    throw new RangeError('Photo dimensions must be positive integers.')
  }
  const expectedLength = source.width * source.height * 4
  if (source.photoRgba.length !== expectedLength) throw new RangeError('Photo RGBA buffer length does not match its dimensions.')
  if (source.matteRgba.length !== expectedLength) throw new RangeError('Matte RGBA buffer length does not match its dimensions.')
}

function localTexture(values: Float32Array, width: number, height: number, x: number, y: number, center: number) {
  let sum = 0
  let squaredSum = 0
  let samples = 0
  for (let dy = -1; dy <= 1; dy += 1) {
    const sampleY = Math.min(height - 1, Math.max(0, y + dy))
    for (let dx = -1; dx <= 1; dx += 1) {
      const sampleX = Math.min(width - 1, Math.max(0, x + dx))
      const value = values[sampleY * width + sampleX]!
      sum += value
      squaredSum += value * value
      samples += 1
    }
  }
  const mean = sum / samples
  const variance = Math.max(0, squaredSum / samples - mean * mean)
  return Math.min(1, Math.sqrt(variance) + Math.abs(center - mean) * 0.5)
}

function localColorGradient(values: Float32Array, width: number, height: number, x: number, y: number) {
  const centerIndex = (y * width + x) * 3
  const centerRed = values[centerIndex]!
  const centerGreen = values[centerIndex + 1]!
  const centerBlue = values[centerIndex + 2]!
  const left = Math.max(0, x - 1)
  const right = Math.min(width - 1, x + 1)
  const up = Math.max(0, y - 1)
  const down = Math.min(height - 1, y + 1)
  const horizontal = Math.max(
    colorDistance(values, centerRed, centerGreen, centerBlue, (y * width + left) * 3),
    colorDistance(values, centerRed, centerGreen, centerBlue, (y * width + right) * 3),
  )
  const vertical = Math.max(
    colorDistance(values, centerRed, centerGreen, centerBlue, (up * width + x) * 3),
    colorDistance(values, centerRed, centerGreen, centerBlue, (down * width + x) * 3),
  )
  return Math.min(1, Math.hypot(horizontal, vertical) / Math.sqrt(3))
}

function colorDistance(values: Float32Array, red: number, green: number, blue: number, offset: number) {
  return Math.hypot(red - values[offset]!, green - values[offset + 1]!, blue - values[offset + 2]!)
}

function findWeightedCandidate(cumulative: Float64Array, candidates: Candidate[], totalWeight: number, random: number) {
  const target = random * totalWeight
  let low = 0
  let high = candidates.length - 1
  while (low < high) {
    const middle = (low + high) >>> 1
    if (cumulative[middle]! > target) high = middle
    else low = middle + 1
  }
  return low
}

function createRandom(seed?: number) {
  let state = (Number.isFinite(seed) ? seed! : DEFAULT_SEED) >>> 0
  if (state === 0) state = DEFAULT_SEED
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x1_0000_0000
  }
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function clampFinite(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function clampInteger(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : 0
}
