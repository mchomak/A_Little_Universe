export type IrisFiberFieldOptions = { seed?: number; density: number; curvature: number; length: number; thickness?: number; layerSeparation?: number; noiseScale?: number; segments?: number; originX?: number; originY?: number; innerRadius?: number; outerRadius?: number }

export type IrisFiberField = {
  positions: Float32Array
  colors: Float32Array
  alpha: Float32Array
  progress: Float32Array
  seed: Float32Array
  particlePositions: Float32Array
  particleColors: Float32Array
  particleSizes: Float32Array
  particleAlpha: Float32Array
  strandCount: number
  branchCount: number
  layerCount: 4
  groupCounts: { fineBlue: number; electricBlue: number; silver: number }
  depthRange: number
  curveMetrics: { maxDeflection: number; maxSecondDifference: number }
}

type FiberControl = {
  group: 'fineBlue' | 'electricBlue' | 'silver'
  angle: number; start: number; end: number; layer: number; side: number; seed: number
  groupScale: number; color: number[]; strength: number; originX: number; originY: number
}

function createRandom(initialSeed: number) {
  let seed = (initialSeed | 0) || 1
  return () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
    return (seed >>> 0) / 4294967296
  }
}

function smoothNoise(value: number, seed: number): number {
  const whole = Math.floor(value), t = value - whole, smooth = t * t * (3 - 2 * t)
  const a = Math.sin((whole + seed * 17.13) * 127.1) * 43758.5453
  const b = Math.sin((whole + 1 + seed * 17.13) * 127.1) * 43758.5453
  return ((a - Math.floor(a)) * (1 - smooth) + (b - Math.floor(b)) * smooth) * 2 - 1
}

/** Low-cost Fire Eye-inspired fractal domain warp, evaluated once per ribbon vertex. */
function fireEyeFbm(t: number, seed: number, scale: number): number {
  let value = 0, amplitude = 0.5, total = 0, frequency = Math.max(1, scale)
  for (let octave = 0; octave < 4; octave++) {
    value += smoothNoise(t * frequency, seed + octave * 9.73) * amplitude
    total += amplitude
    amplitude *= 0.5
    frequency *= 2.03
  }
  return value / total
}

/**
 * Create tapered, alpha-faded triangle ribbons and accent particles sampled from
 * those same curves. Fibers are clustered into four depth layers and three light groups.
 */
export function createIrisFiberField(options: IrisFiberFieldOptions): IrisFiberField {
  const rand = createRandom(options.seed ?? 6013)
  const density = Math.min(1, Math.max(0.05, options.density))
  const curvature = Math.min(1, Math.max(0, options.curvature))
  const length = Math.min(2, Math.max(0.2, options.length))
  const thickness = Math.min(3, Math.max(0.1, options.thickness ?? 1))
  const layerSeparation = Math.min(0.6, Math.max(0, options.layerSeparation ?? 0.2))
  const noiseScale = Math.min(16, Math.max(1, options.noiseScale ?? 7))
  const originX = options.originX ?? 0, originY = options.originY ?? 0
  const innerRadius = Math.min(0.72, Math.max(0.05, options.innerRadius ?? 0.2))
  const outerRadius = Math.min(1.2, Math.max(innerRadius + 0.1, options.outerRadius ?? 0.88))
  const segments = Math.round(Math.min(32, Math.max(8, options.segments ?? 32)))
  const requested = Math.round(360 + density * 520)
  const sectorCount = 24
  const accentSectors = Array.from({ length: sectorCount }, () => rand() > 0.54)
  const positions: number[] = [], colors: number[] = [], alpha: number[] = [], progress: number[] = [], seeds: number[] = []
  const particlePositions: number[] = [], particleColors: number[] = [], particleSizes: number[] = [], particleAlpha: number[] = []
  const groupCounts = { fineBlue: 0, electricBlue: 0, silver: 0 }
  const layers = [-0.45, -0.125, 0.225, 0.575].map((layer) => layer * layerSeparation)
  let depthMin = Number.POSITIVE_INFINITY, depthMax = Number.NEGATIVE_INFINITY

  const controls = Array.from({ length: requested }, (_, index) => {
    const groupRoll = rand()
    const group = groupRoll < 0.72 ? 'fineBlue' : groupRoll < 0.94 ? 'electricBlue' : 'silver'
    const sector = Math.floor(index / requested * sectorCount)
    if (group !== 'fineBlue' && !accentSectors[sector]) return null
    const sectorJitter = (rand() - 0.5) * 0.86
    const angle = (sector + 0.5 + sectorJitter) / sectorCount * Math.PI * 2 + (rand() - 0.5) * 0.05
    const start = innerRadius + rand() * Math.min(0.085, (outerRadius - innerRadius) * 0.18)
    const projectedOrigin = originX * Math.cos(angle) + originY * Math.sin(angle)
    const boundary = Math.max(start + 0.06, -projectedOrigin + Math.sqrt(Math.max(0, projectedOrigin * projectedOrigin + outerRadius * outerRadius - originX * originX - originY * originY)) - 0.012)
    const desiredEnd = start + (boundary - start) * (0.62 + rand() * 0.38)
    const end = Math.min(boundary, start + (desiredEnd - start) * length)
    const layer = Math.floor(rand() * 4)
    const side = (rand() < 0.5 ? -1 : 1) * (0.08 + rand() * 0.2) * curvature
    const seed = rand() * 1000
    const groupScale = (group === 'fineBlue' ? 0.0015 + rand() * 0.0012 : group === 'electricBlue' ? 0.0026 + rand() * 0.002 : 0.0034 + rand() * 0.0022) * thickness
    const color = group === 'fineBlue'
      ? [0.025 + rand() * 0.025, 0.22 + rand() * 0.22, 0.72 + rand() * 0.28]
      : group === 'electricBlue'
        ? [0.025 + rand() * 0.05, 0.36 + rand() * 0.24, 0.88 + rand() * 0.12]
        : [0.48 + rand() * 0.22, 0.68 + rand() * 0.25, 0.9 + rand() * 0.1]
    const strength = (group === 'fineBlue' ? 0.62 : group === 'electricBlue' ? 1.12 : 1.38) * (0.52 + rand() * 0.48)
    groupCounts[group]++
    return { group, angle, start, end, layer, side, seed, groupScale, color, strength, originX, originY } satisfies FiberControl
  }).filter((fiber): fiber is NonNullable<typeof fiber> => fiber !== null)

  const evaluate = (fiber: FiberControl, t: number) => {
    const envelope = Math.sin(Math.PI * t)
    const warpA = fireEyeFbm(t * 0.72 + fiber.seed * 0.001, fiber.seed, noiseScale * 0.12)
    const warpB = fireEyeFbm(t * 1.1 + warpA * 0.1, fiber.seed + 3.71, noiseScale * 0.1)
    // A broad sinusoidal bend defines the strand. Low-frequency fBm gently varies that arc,
    // while the higher frequencies remain confined to the almost invisible Z microstructure.
    const angle = fiber.angle + fiber.side * (Math.sin(Math.PI * t) + warpA * 0.22 + warpB * 0.06) * envelope
    const desiredRadius = fiber.start + (fiber.end - fiber.start) * t
    const projectedOrigin = fiber.originX * Math.cos(angle) + fiber.originY * Math.sin(angle)
    const rayBoundary = -projectedOrigin + Math.sqrt(Math.max(0, projectedOrigin * projectedOrigin + outerRadius * outerRadius - fiber.originX * fiber.originX - fiber.originY * fiber.originY))
    const radius = Math.min(desiredRadius, Math.max(fiber.start, rayBoundary - 0.018))
    const micro = fireEyeFbm(t * 3.8, fiber.seed + 11.4, noiseScale * 0.34) * 0.0013
    return [fiber.originX + Math.cos(angle) * radius, fiber.originY + Math.sin(angle) * radius, layers[fiber.layer]! + envelope * (0.012 + Math.abs(fiber.side) * 0.16) + micro] as const
  }

  const appendFiber = (fiber: FiberControl, branch = false) => {
    const centers = Array.from({ length: segments + 1 }, (_, step) => evaluate(fiber, step / segments))
    const strandVertices: { x: number; y: number; z: number; t: number }[] = []
    for (let step = 0; step <= segments; step++) {
      const center = centers[step]!, before = centers[Math.max(0, step - 1)]!, after = centers[Math.min(segments, step + 1)]!
      const tangentX = after[0] - before[0], tangentY = after[1] - before[1]
      const tangentLength = Math.hypot(tangentX, tangentY) || 1
      const normalX = -tangentY / tangentLength, normalY = tangentX / tangentLength
      const t = step / segments
      const taper = 0.16 + 0.84 * Math.sin(Math.PI * t) ** 0.7
      const halfWidth = fiber.groupScale * taper * 0.5
      strandVertices.push({ x: center[0] + normalX * halfWidth, y: center[1] + normalY * halfWidth, z: center[2], t })
      strandVertices.push({ x: center[0] - normalX * halfWidth, y: center[1] - normalY * halfWidth, z: center[2], t })
      depthMin = Math.min(depthMin, center[2]); depthMax = Math.max(depthMax, center[2])
    }
    for (let step = 0; step < segments; step++) {
      const a = strandVertices[step * 2]!, b = strandVertices[step * 2 + 1]!, c = strandVertices[step * 2 + 2]!, d = strandVertices[step * 2 + 3]!
      for (const vertex of [a, b, c, b, d, c]) {
        positions.push(vertex.x, vertex.y, vertex.z)
        colors.push(...fiber.color)
        alpha.push(fiber.strength * Math.sin(Math.PI * vertex.t) ** 0.66)
        progress.push(vertex.t); seeds.push(fiber.seed)
      }
    }
    const samples = branch ? 2 : fiber.group === 'fineBlue' ? 4 : fiber.group === 'electricBlue' ? 6 : 8
    for (let i = 0; i < samples; i++) {
      const t = 0.06 + 0.88 * (i + rand() * 0.45) / samples
      const p = evaluate(fiber, t)
      particlePositions.push(...p)
      particleColors.push(...fiber.color)
      particleSizes.push((branch ? 0.55 : fiber.group === 'fineBlue' ? 0.9 : fiber.group === 'electricBlue' ? 1.5 : 1.8) + rand() * (branch ? 0.7 : 1.5))
      particleAlpha.push(fiber.strength * (branch ? 0.45 : 0.62 + rand() * 0.38) * Math.sin(Math.PI * t) ** 0.5)
    }
  }

  let branchCount = 0
  let maxDeflection = 0, maxSecondDifference = 0
  for (const fiber of controls as FiberControl[]) {
    const path = Array.from({ length: 13 }, (_, index) => evaluate(fiber, index / 12))
    const first = path[0]!, last = path[path.length - 1]!
    const dx = last[0] - first[0], dy = last[1] - first[1], chordLength = Math.hypot(dx, dy) || 1
    for (let index = 1; index < path.length - 1; index++) {
      const point = path[index]!
      maxDeflection = Math.max(maxDeflection, Math.abs(dx * (first[1] - point[1]) - (first[0] - point[0]) * dy) / chordLength)
      const before = path[index - 1]!, after = path[index + 1]!
      maxSecondDifference = Math.max(maxSecondDifference, Math.hypot(before[0] - 2 * point[0] + after[0], before[1] - 2 * point[1] + after[1]))
    }
    appendFiber(fiber)
    if (fiber.group !== 'fineBlue' || rand() > 0.3) continue
    const branchAt = 0.62 + rand() * 0.2
    const junction = evaluate(fiber, branchAt)
    const tangent = evaluate(fiber, Math.min(0.98, branchAt + 0.025))
    const tangentAngle = Math.atan2(tangent[1] - junction[1], tangent[0] - junction[0])
    const branchDirection = rand() < 0.5 ? -1 : 1
    const branch: FiberControl = {
      ...fiber,
      angle: tangentAngle + branchDirection * (0.12 + rand() * 0.16),
      start: 0,
      end: 0.12 + rand() * 0.22,
      side: fiber.side * 0.46,
      seed: rand() * 1000,
      groupScale: fiber.groupScale * 0.42,
      strength: fiber.strength * 0.56,
      originX: junction[0],
      originY: junction[1],
    }
    appendFiber(branch, true)
    groupCounts.fineBlue++
    branchCount++
  }

  return {
    positions: new Float32Array(positions), colors: new Float32Array(colors), alpha: new Float32Array(alpha),
    progress: new Float32Array(progress), seed: new Float32Array(seeds),
    particlePositions: new Float32Array(particlePositions), particleColors: new Float32Array(particleColors),
    particleSizes: new Float32Array(particleSizes), particleAlpha: new Float32Array(particleAlpha),
    strandCount: controls.length + branchCount, branchCount, layerCount: 4, groupCounts, depthRange: depthMax - depthMin,
    curveMetrics: { maxDeflection, maxSecondDifference },
  }
}
