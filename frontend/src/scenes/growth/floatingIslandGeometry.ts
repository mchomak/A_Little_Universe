import { Color } from 'three'

const EDGE_SEGMENTS = 112
const TOP_RINGS = 24
const topPalette = ['#514033', '#5d4936', '#3e4034', '#6a5238', '#484339'].map((value) => new Color(value))
const sidePalette = ['#49372d', '#5a4435', '#3b332d', '#654b37', '#473d34'].map((value) => new Color(value))
const grassPalette = ['#284a32', '#3c6339', '#647845', '#315641', '#78834c', '#487146'].map((value) => new Color(value))

type SideProfile = { radius: number; depth: number }

function sideProfile(thickness: number, depth: number): SideProfile[] {
  return [
    { radius: 1, depth: 0 },
    { radius: 1.002, depth: thickness * 0.12 },
    { radius: 1.01, depth: thickness * 0.58 },
    { radius: 0.985, depth: thickness },
    { radius: 1.035, depth: thickness + depth * 0.08 },
    { radius: 0.97, depth: thickness + depth * 0.19 },
    { radius: 0.83, depth: thickness + depth * 0.38 },
    { radius: 0.69, depth: thickness + depth * 0.58 },
    { radius: 0.5, depth: thickness + depth * 0.76 },
    { radius: 0.29, depth: thickness + depth * 0.9 },
    { radius: 0.12, depth: thickness + depth * 0.98 },
    { radius: 0.035, depth: thickness + depth },
  ]
}

export interface IslandGeometryData {
  positions: Float32Array
  colors: Float32Array
  uvs: Float32Array
  indices: Uint32Array
}

export interface GrassBladeData {
  roots: Float32Array
  heights: Float32Array
  phases: Float32Array
  yaws: Float32Array
  widths: Float32Array
  bends: Float32Array
  colors: Float32Array
}

function seededRandom(seed: number) {
  let value = seed >>> 0 || 1
  return () => {
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    return (value >>> 0) / 0x100000000
  }
}

function edgeNoise(angle: number, roughness = 0.5) {
  const broad = 0.044 * Math.sin(angle * 3 + 0.8) + 0.03 * Math.sin(angle * 7 - 1.3)
    + 0.019 * Math.sin(angle * 13 + 0.2) + 0.011 * Math.sin(angle * 23 - 2.1)
  return 1 + (0.35 + roughness * 1.25) * broad
}

function bodyNoise(angle: number, depthFraction: number, roughness: number) {
  return roughness * (
    0.041 * Math.sin(angle * 3 + depthFraction * 4.2 + 0.3)
    + 0.026 * Math.sin(angle * 5 - depthFraction * 10.1 + 1.2)
    + 0.017 * Math.sin(angle * 9 + depthFraction * 15.4)
    + 0.009 * Math.sin(angle * 17 - depthFraction * 21.7)
  )
}

function surfaceHeight(x: number, z: number, radius: number, roughness: number, thickness: number) {
  const distance = Math.min(1, Math.hypot(x, z) / radius)
  const angle = Math.atan2(z, x)
  const bevel = Math.max(0, (distance - 0.78) / 0.22)
  const micro = (0.0035 + roughness * 0.012) * (
    Math.sin(x * 31 + z * 19) * 0.52 + Math.sin(x * 67 - z * 43) * 0.27 + Math.sin(x * 117 + z * 83) * 0.12
  )
  const undulation = roughness * 0.012 * Math.sin(angle * 5 + distance * 9) * distance
  return -0.006 * distance + micro * distance + undulation - bevel * thickness * 0.12
}

function writeColor(target: number[], palette: Color[], selector: number, variation: number) {
  const color = palette[Math.floor(selector * palette.length) % palette.length]!
  const factor = 0.82 + variation * 0.34
  target.push(color.r * factor, color.g * factor, color.b * factor)
}

function addVertex(positions: number[], colors: number[], uvs: number[], x: number, y: number, z: number, color: [number, number, number], u: number, v: number) {
  positions.push(x, y, z)
  colors.push(...color)
  uvs.push(u, v)
  return positions.length / 3 - 1
}

function crackColor(index: number): [number, number, number] {
  const shades: Array<[number, number, number]> = [[0.19, 0.13, 0.085], [0.25, 0.17, 0.11], [0.3, 0.2, 0.13]]
  return shades[index % shades.length]!
}

/** Uneven topsoil with a softly rolled perimeter and narrow, tapered surface fissures. */
export function createIslandTopGeometryData(radius: number, roughness = 0.5, thickness = 0.24): IslandGeometryData {
  const positions: number[] = [0, 0, 0]
  const colors: number[] = [0.27, 0.25, 0.2]
  const uvs: number[] = [0.5, 0.5]
  const indices: number[] = []
  const random = seededRandom(18341)

  for (let ring = 1; ring <= TOP_RINGS; ring += 1) {
    const radial = ring / TOP_RINGS
    for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
      const angle = (segment / EDGE_SEGMENTS) * Math.PI * 2
      const dist = radius * radial * edgeNoise(angle, roughness)
      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist
      const y = surfaceHeight(x, z, radius, roughness, thickness)
      writeColor(colors, topPalette, random(), random())
      uvs.push(x / radius * 3.7 + 0.5, z / radius * 3.7 + 0.5)
      positions.push(x, y, z)
    }
  }

  for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
    const next = (segment + 1) % EDGE_SEGMENTS
    indices.push(0, 1 + next, 1 + segment)
  }
  for (let ring = 0; ring < TOP_RINGS - 1; ring += 1) {
    const inner = 1 + ring * EDGE_SEGMENTS
    const outer = inner + EDGE_SEGMENTS
    for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
      const next = (segment + 1) % EDGE_SEGMENTS
      indices.push(inner + segment, inner + next, outer + next, inner + segment, outer + next, outer + segment)
    }
  }

  // Cracks run from occasional exposed roots toward the softened outer lip.
  const crackCount = Math.round(5 + roughness * 7)
  for (let crack = 0; crack < crackCount; crack += 1) {
    const angle = random() * Math.PI * 2
    const start = 0.2 + random() * 0.34
    const end = 0.7 + random() * 0.22
    const drift = (random() - 0.5) * 0.32
    const steps = 7
    const first = positions.length / 3
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps
      const a = angle + drift * t + Math.sin(t * Math.PI * 2 + crack) * 0.035
      const r = radius * (start + (end - start) * t)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const sideWidth = radius * (0.0014 + roughness * 0.0028) * (1 - t * 0.83)
      const nx = -Math.sin(a)
      const nz = Math.cos(a)
      const y = surfaceHeight(x, z, radius, roughness, thickness) + 0.0015
      const color = crackColor(crack)
      addVertex(positions, colors, uvs, x - nx * sideWidth, y, z - nz * sideWidth, color, x / radius * 3.7 + 0.5, z / radius * 3.7 + 0.5)
      addVertex(positions, colors, uvs, x + nx * sideWidth, y, z + nz * sideWidth, color, x / radius * 3.7 + 0.5, z / radius * 3.7 + 0.5)
    }
    for (let step = 0; step < steps; step += 1) {
      const a = first + step * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }

  return { positions: Float32Array.from(positions), colors: Float32Array.from(colors), uvs: Float32Array.from(uvs), indices: Uint32Array.from(indices) }
}

function profileAtAngle(profile: SideProfile[], radius: number, angle: number, roughness: number, t: number) {
  const edgeRadius = radius * edgeNoise(angle, roughness)
  const edgeX = Math.cos(angle) * edgeRadius
  const edgeZ = Math.sin(angle) * edgeRadius
  const thickness = profile[1]!.depth / 0.12
  const seamY = surfaceHeight(edgeX, edgeZ, radius, roughness, thickness)
  if (t === 0) return { x: edgeX, y: seamY, z: edgeZ, radial: edgeRadius }
  const last = profile.length - 1
  const scaled = t * last
  const segment = Math.min(last - 1, Math.floor(scaled))
  const mix = scaled - segment
  const a = profile[segment]!
  const b = profile[segment + 1]!
  const depth = a.depth + (b.depth - a.depth) * mix
  const fraction = depth / Math.max(0.001, profile[last]!.depth)
  const edgeBlend = Math.max(0, 1 - t / 0.24)
  const radial = radius * (a.radius + (b.radius - a.radius) * mix + bodyNoise(angle, fraction, roughness)
    + (edgeNoise(angle, roughness) - 1) * edgeBlend)
  return { x: Math.cos(angle) * radial, y: seamY - depth, z: Math.sin(angle) * radial, radial }
}

function appendRoots(positions: number[], colors: number[], uvs: number[], indices: number[], radius: number, thickness: number, depth: number, roughness: number, random: () => number) {
  const profile = sideProfile(thickness, depth)
  const rootCount = Math.round(6 + roughness * 7)
  const radialSegments = 5
  const steps = 7
  for (let root = 0; root < rootCount; root += 1) {
    const angle = (root / rootCount) * Math.PI * 2 + (random() - 0.5) * 0.3
    const start = 0.3 + random() * 0.13
    const end = 0.52 + random() * 0.31
    const drift = (random() - 0.5) * 0.18
    const width = radius * (0.0024 + random() * 0.0024)
    const first = positions.length / 3
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps
      const profileT = start + (end - start) * t
      const a = angle + drift * t + Math.sin(t * Math.PI * 2 + root) * 0.045
      const center = profileAtAngle(profile, radius, a, roughness, profileT)
      const taper = Math.max(0.12, (1 - t) ** 1.15)
      const tubeRadius = width * taper
      const colorFactor = 0.72 + (random() - 0.5) * 0.1
      for (let side = 0; side < radialSegments; side += 1) {
        const around = (side / radialSegments) * Math.PI * 2
        const radialOffset = tubeRadius * Math.cos(around)
        const tangentOffset = tubeRadius * Math.sin(around)
        const radial = center.radial + 0.006 + radialOffset
        positions.push(Math.cos(a) * radial - Math.sin(a) * tangentOffset, center.y + radialOffset * 0.25, Math.sin(a) * radial + Math.cos(a) * tangentOffset)
        colors.push(0.18 * colorFactor, 0.14 * colorFactor, 0.09 * colorFactor)
        uvs.push((root / rootCount) * 5, profileT * 5)
      }
    }
    for (let step = 0; step < steps; step += 1) {
      for (let side = 0; side < radialSegments; side += 1) {
        const a = first + step * radialSegments + side
        const next = first + step * radialSegments + (side + 1) % radialSegments
        const lower = first + (step + 1) * radialSegments + side
        const lowerNext = first + (step + 1) * radialSegments + (side + 1) % radialSegments
        indices.push(a, next, lowerNext, a, lowerNext, lower)
      }
    }
  }
}

function appendSoilFragments(positions: number[], colors: number[], uvs: number[], indices: number[], radius: number, thickness: number, depth: number, roughness: number, random: () => number) {
  const profile = sideProfile(thickness, depth)
  const count = Math.round(5 + roughness * 7)
  for (let fragment = 0; fragment < count; fragment += 1) {
    const angle = random() * Math.PI * 2
    const t = 0.46 + random() * 0.37
    const center = profileAtAngle(profile, radius, angle, roughness, t)
    const size = radius * (0.028 + random() * 0.038)
    const vertices = 6 + Math.floor(random() * 4)
    const first = positions.length / 3
    const hue = 0.82 + random() * 0.35
    const radial = center.radial + size * 0.12
    positions.push(center.x + Math.cos(angle) * size * 0.42, center.y + size * 0.28, center.z + Math.sin(angle) * size * 0.42)
    colors.push(0.34 * hue, 0.25 * hue, 0.16 * hue)
    uvs.push(angle / (Math.PI * 2) * 6, t * 6)
    for (let vertex = 0; vertex < vertices; vertex += 1) {
      const a = (vertex / vertices) * Math.PI * 2
      const jitter = 0.72 + random() * 0.55
      const tangent = Math.cos(a) * size * jitter
      const vertical = (random() - 0.42) * size * 0.78
      positions.push(Math.cos(angle) * radial - Math.sin(angle) * tangent, center.y + vertical, Math.sin(angle) * radial + Math.cos(angle) * tangent)
      const variation = 0.7 + random() * 0.4
      colors.push(0.38 * hue * variation, 0.29 * hue * variation, 0.19 * hue * variation)
      uvs.push((angle / (Math.PI * 2) + tangent / radius) * 6, t * 6 + vertical * 4)
    }
    for (let vertex = 0; vertex < vertices; vertex += 1) {
      const next = (vertex + 1) % vertices
      indices.push(first, first + 1 + vertex, first + 1 + next)
    }
  }
}

/** Rounded, thick soil mantle flowing into an asymmetric tapered floating mass. */
export function createIslandSideGeometryData(radius: number, thickness = 0.24, depth = 0.58, roughness = 0.5): IslandGeometryData {
  const profile = sideProfile(thickness, depth)
  const positions: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const random = seededRandom(7069)
  const totalDepth = profile[profile.length - 1]!.depth

  for (let ring = 0; ring < profile.length; ring += 1) {
    for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
      const angle = (segment / EDGE_SEGMENTS) * Math.PI * 2
      const point = profileAtAngle(profile, radius, angle, roughness, ring / (profile.length - 1))
      const micro = roughness * 0.004 * Math.min(1, ring / 2) * (Math.sin(angle * 31 + ring) + Math.cos(angle * 47 - ring * 2))
      positions.push(point.x, point.y + micro, point.z)
      writeColor(colors, sidePalette, random(), random())
      uvs.push(segment / EDGE_SEGMENTS * 6, -point.y / totalDepth * 5)
    }
  }

  for (let ring = 0; ring < profile.length - 1; ring += 1) {
    const upper = ring * EDGE_SEGMENTS
    const lower = upper + EDGE_SEGMENTS
    for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
      const next = (segment + 1) % EDGE_SEGMENTS
      indices.push(upper + segment, lower + next, lower + segment, upper + segment, upper + next, lower + next)
    }
  }
  const centerIndex = positions.length / 3
  positions.push(radius * 0.035, -totalDepth - thickness * 0.035, -radius * 0.025)
  colors.push(0.24, 0.19, 0.14)
  uvs.push(0.5, 5)
  const lastRing = (profile.length - 1) * EDGE_SEGMENTS
  for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
    const next = (segment + 1) % EDGE_SEGMENTS
    indices.push(lastRing + segment, centerIndex, lastRing + next)
  }

  appendRoots(positions, colors, uvs, indices, radius, thickness, depth, roughness, random)
  appendSoilFragments(positions, colors, uvs, indices, radius, thickness, depth, roughness, random)
  return { positions: Float32Array.from(positions), colors: Float32Array.from(colors), uvs: Float32Array.from(uvs), indices: Uint32Array.from(indices) }
}

function normalSample(random: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-7, random()))) * Math.cos(random() * Math.PI * 2)
}

/** Reproducible clustered grass with a bare planting pocket and varied blade profiles. */
export function createGrassBladeData(count: number, radius: number, seed: number, averageHeight = 0.14, roughness = 0.5, thickness = 0.24): GrassBladeData {
  const roots = new Float32Array(count * 3)
  const heights = new Float32Array(count)
  const phases = new Float32Array(count)
  const yaws = new Float32Array(count)
  const widths = new Float32Array(count)
  const bends = new Float32Array(count)
  const colors = new Float32Array(count * 3)
  const random = seededRandom(seed)
  const inner = radius * 0.245
  const outer = radius * 0.9
  const clusterCount = Math.max(1, Math.round(count / 9))
  const clusterCenters = Array.from({ length: clusterCount }, () => {
    const angle = random() * Math.PI * 2
    const distance = Math.sqrt(inner * inner + random() * (outer * outer - inner * inner))
    return [Math.cos(angle) * distance, Math.sin(angle) * distance] as const
  })

  const assign = (index: number, x: number, z: number) => {
    const distance = Math.hypot(x, z)
    if (distance < inner || distance > outer) return false
    roots[index * 3] = x
    roots[index * 3 + 1] = surfaceHeight(x, z, radius, roughness, thickness) + 0.004
    roots[index * 3 + 2] = z
    heights[index] = averageHeight * (0.62 + random() * 0.78)
    phases[index] = random() * Math.PI * 2
    yaws[index] = random() * Math.PI * 2
    widths[index] = radius * (0.008 + random() * 0.008)
    bends[index] = (random() - 0.46) * averageHeight * 0.24
    const palette = grassPalette[Math.floor(random() * grassPalette.length)]!
    const factor = 0.78 + random() * 0.38
    colors[index * 3] = palette.r * factor
    colors[index * 3 + 1] = palette.g * factor
    colors[index * 3 + 2] = palette.b * factor
    return true
  }

  let index = 0
  let attempts = 0
  while (index < count && attempts < count * 32) {
    attempts += 1
    let x: number
    let z: number
    if (random() < 0.78) {
      const center = clusterCenters[Math.floor(random() * clusterCenters.length)]!
      x = center[0] + normalSample(random) * radius * (0.04 + random() * 0.025)
      z = center[1] + normalSample(random) * radius * (0.04 + random() * 0.025)
    } else {
      const angle = random() * Math.PI * 2
      const distance = Math.sqrt(inner * inner + random() * (outer * outer - inner * inner))
      x = Math.cos(angle) * distance
      z = Math.sin(angle) * distance
    }
    if (assign(index, x, z)) index += 1
  }

  // Saturated edge cases (very small count or exaggerated cluster overlap) still fill deterministically.
  while (index < count) {
    const angle = random() * Math.PI * 2
    const distance = Math.sqrt(inner * inner + random() * (outer * outer - inner * inner))
    if (assign(index, Math.cos(angle) * distance, Math.sin(angle) * distance)) index += 1
  }

  return { roots, heights, phases, yaws, widths, bends, colors }
}
