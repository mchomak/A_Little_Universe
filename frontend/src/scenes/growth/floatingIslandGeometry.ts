import { Color } from 'three'

const EDGE_SEGMENTS = 96
const TOP_RINGS = 18
const SIDE_PROFILE = [
  { radius: 1, depth: 0 },
  { radius: 0.94, depth: 0.1 },
  { radius: 0.79, depth: 0.34 },
  { radius: 0.58, depth: 0.57 },
  { radius: 0.35, depth: 0.73 },
  { radius: 0.07, depth: 0.78 },
] as const
const topPalette = ['#49392f', '#554432', '#354238', '#66503a'].map((value) => new Color(value))
const sidePalette = ['#45352f', '#584235', '#362f2c', '#66503b'].map((value) => new Color(value))
const grassPalette = ['#284832', '#3d633a', '#617845', '#31523e', '#71834b'].map((value) => new Color(value))

export interface IslandGeometryData {
  positions: Float32Array
  colors: Float32Array
  indices: Uint32Array
}

export interface GrassBladeData {
  roots: Float32Array
  heights: Float32Array
  phases: Float32Array
  yaws: Float32Array
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

function edgeNoise(angle: number) {
  return 1 + 0.035 * Math.sin(angle * 3 + 0.8) + 0.024 * Math.sin(angle * 7 - 1.3)
    + 0.012 * Math.sin(angle * 13 + 0.2)
}

function topHeight(x: number, z: number, radius: number) {
  const distance = Math.hypot(x, z) / radius
  const angle = Math.atan2(z, x)
  return -0.024 * distance + 0.009 * Math.sin(angle * 5 + distance * 8) * distance
    + 0.005 * Math.sin(x * 19 + z * 11) * distance
}

function writeColor(target: Float32Array, index: number, palette: Color[], selector: number, variation: number) {
  const color = palette[Math.floor(selector * palette.length) % palette.length]!
  const factor = 0.88 + variation * 0.18
  target[index * 3] = color.r * factor
  target[index * 3 + 1] = color.g * factor
  target[index * 3 + 2] = color.b * factor
}

/** Organic triangulated topsoil, generated locally for the floating island. */
export function createIslandTopGeometryData(radius: number): IslandGeometryData {
  const vertexCount = 1 + TOP_RINGS * EDGE_SEGMENTS
  const positions = new Float32Array(vertexCount * 3)
  const colors = new Float32Array(vertexCount * 3)
  const indices: number[] = []
  const random = seededRandom(18341)
  const center = new Color('#384137')
  center.toArray(colors, 0)

  for (let ring = 1; ring <= TOP_RINGS; ring += 1) {
    const radial = ring / TOP_RINGS
    for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
      const angle = (segment / EDGE_SEGMENTS) * Math.PI * 2
      const edge = edgeNoise(angle)
      const dist = radius * radial * edge
      const index = 1 + (ring - 1) * EDGE_SEGMENTS + segment
      positions[index * 3] = Math.cos(angle) * dist
      positions[index * 3 + 1] = topHeight(positions[index * 3]!, Math.sin(angle) * dist, radius)
      positions[index * 3 + 2] = Math.sin(angle) * dist
      writeColor(colors, index, topPalette, random(), random())
    }
  }

  const firstRing = 1
  for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
    const next = (segment + 1) % EDGE_SEGMENTS
    indices.push(0, firstRing + next, firstRing + segment)
  }
  for (let ring = 0; ring < TOP_RINGS - 1; ring += 1) {
    const inner = 1 + ring * EDGE_SEGMENTS
    const outer = inner + EDGE_SEGMENTS
    for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
      const next = (segment + 1) % EDGE_SEGMENTS
      indices.push(inner + segment, inner + next, outer + next, inner + segment, outer + next, outer + segment)
    }
  }
  return { positions, colors, indices: Uint32Array.from(indices) }
}

/** Layered taper below the planting surface, with a naturally uneven silhouette. */
export function createIslandSideGeometryData(radius: number): IslandGeometryData {
  const vertexCount = SIDE_PROFILE.length * EDGE_SEGMENTS + 1
  const positions = new Float32Array(vertexCount * 3)
  const colors = new Float32Array(vertexCount * 3)
  const indices: number[] = []
  const random = seededRandom(7069)

  SIDE_PROFILE.forEach((profile, ring) => {
    for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
      const angle = (segment / EDGE_SEGMENTS) * Math.PI * 2
      const noise = edgeNoise(angle)
      const radial = radius * profile.radius * noise
      const index = ring * EDGE_SEGMENTS + segment
      positions[index * 3] = Math.cos(angle) * radial
      positions[index * 3 + 1] = topHeight(positions[index * 3]!, Math.sin(angle) * radial, radius) - profile.depth * radius * 0.74
      positions[index * 3 + 2] = Math.sin(angle) * radial
      writeColor(colors, index, sidePalette, random(), random())
    }
  })

  for (let ring = 0; ring < SIDE_PROFILE.length - 1; ring += 1) {
    const upper = ring * EDGE_SEGMENTS
    const lower = upper + EDGE_SEGMENTS
    for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
      const next = (segment + 1) % EDGE_SEGMENTS
      indices.push(upper + segment, lower + next, lower + segment, upper + segment, upper + next, lower + next)
    }
  }
  const centerIndex = vertexCount - 1
  positions[centerIndex * 3 + 1] = -SIDE_PROFILE[SIDE_PROFILE.length - 1]!.depth * radius * 0.74
  writeColor(colors, centerIndex, sidePalette, random(), random())
  const lastRing = (SIDE_PROFILE.length - 1) * EDGE_SEGMENTS
  for (let segment = 0; segment < EDGE_SEGMENTS; segment += 1) {
    const next = (segment + 1) % EDGE_SEGMENTS
    indices.push(lastRing + segment, lastRing + next, centerIndex)
  }
  return { positions, colors, indices: Uint32Array.from(indices) }
}

/** Deterministic grass placements with an open center and a small outer margin. */
export function createGrassBladeData(count: number, radius: number, seed: number): GrassBladeData {
  const roots = new Float32Array(count * 3)
  const heights = new Float32Array(count)
  const phases = new Float32Array(count)
  const yaws = new Float32Array(count)
  const colors = new Float32Array(count * 3)
  const random = seededRandom(seed)

  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2
    const inner = radius * 0.23
    const outer = radius * 0.91
    const distance = Math.sqrt(inner * inner + random() * (outer * outer - inner * inner)) * edgeNoise(angle)
    const x = Math.cos(angle) * distance
    const z = Math.sin(angle) * distance
    roots[index * 3] = x
    roots[index * 3 + 1] = topHeight(x, z, radius) + 0.004
    roots[index * 3 + 2] = z
    heights[index] = 0.082 + random() * 0.082
    phases[index] = random() * Math.PI * 2
    yaws[index] = random() * Math.PI * 2
    writeColor(colors, index, grassPalette, random(), random())
  }
  return { roots, heights, phases, yaws, colors }
}
