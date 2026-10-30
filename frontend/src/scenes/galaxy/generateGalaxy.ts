import { BufferAttribute, BufferGeometry } from 'three'
import type { SeedQuality } from '../../systems/scene-config/config'

export interface GalaxyGeometrySettings {
  seed: number
  starCount: number
  arms: number
  radius: number
  spin: number
  armWidth: number
  scatter: number
  coreSize: number
  coreDensity: number
  thickness: number
  distribution: 'balanced' | 'core' | 'arms'
  brightStarCount: number
  backgroundStarCount: number
  backgroundDepth: number
  quality: SeedQuality
  globalQuality: 'standard' | 'low'
}

export interface GalaxyGeometrySet {
  disk: BufferGeometry
  bright: BufferGeometry
  background: BufferGeometry
  count: number
}

/** A small integer hash keeps procedural placements repeatable without storing a PRNG. */
export function createSeededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6D2B79F5) >>> 0
    let n = value
    n = Math.imul(n ^ (n >>> 15), n | 1)
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

function normal(random: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-8, random()))) * Math.cos(Math.PI * 2 * random())
}

function smoothstep(min: number, max: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return t * t * (3 - 2 * t)
}

function makeGeometry(count: number, settings: GalaxyGeometrySettings, type: 'disk' | 'bright' | 'background', seedOffset = 0) {
  const geometry = new BufferGeometry()
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  const radii = new Float32Array(count)
  const random = createSeededRandom((settings.seed + seedOffset) | 0)

  for (let index = 0; index < count; index += 1) {
    let x: number
    let y: number
    let z: number
    let normalizedRadius: number
    if (type === 'background') {
      const radius = settings.radius * (1.65 + random() * 2.8)
      const angle = random() * Math.PI * 2
      x = Math.cos(angle) * radius
      y = Math.sin(angle) * radius
      z = -(settings.backgroundDepth * (0.45 + random() * 0.55))
      normalizedRadius = random() * 0.86
    } else {
      const armIndex = Math.floor(random() * settings.arms)
      const radialBias = settings.distribution === 'core' ? 1.85 : settings.distribution === 'arms' ? 0.72 : 1.2
      let radius = Math.pow(random(), radialBias) * settings.radius
      if (type === 'bright') radius = settings.radius * (0.14 + random() * 0.83)
      if (type === 'disk' && random() < settings.coreDensity * 0.62) radius *= 0.34
      normalizedRadius = radius / settings.radius
      // Keep the central bulge angularly diffuse, then smoothly merge into the spiral arms.
      const baseArmAngle = armIndex / settings.arms * Math.PI * 2 + normalizedRadius * settings.spin
      const randomBulgeAngle = random() * Math.PI * 2
      const coreFraction = settings.coreSize / settings.radius
      const armInfluence = smoothstep(coreFraction * 0.8, coreFraction * 2, normalizedRadius)
      const angularDifference = Math.atan2(Math.sin(baseArmAngle - randomBulgeAngle), Math.cos(baseArmAngle - randomBulgeAngle))
      const armAngle = randomBulgeAngle + angularDifference * armInfluence
      const scatter = normal(random) * settings.armWidth * (0.14 + normalizedRadius * 0.5) * settings.scatter
      const angle = armAngle + scatter / Math.max(radius, 0.35) + (random() - 0.5) * settings.armWidth * 0.48
      const radialScatter = normal(random) * settings.armWidth * settings.scatter
      const finalRadius = Math.max(0.06, radius + radialScatter)
      x = Math.cos(angle) * finalRadius
      y = Math.sin(angle) * finalRadius
      const coreWeight = Math.exp(-radius * radius / Math.max(0.1, settings.coreSize * settings.coreSize))
      z = normal(random) * settings.thickness * (0.28 + coreWeight * 0.34) * (1 - normalizedRadius * 0.2)
    }

    const offset = index * 3
    positions[offset] = x
    positions[offset + 1] = y
    positions[offset + 2] = z
    seeds[index] = random()
    sizes[index] = type === 'bright' ? 1.4 + random() * 1.6 : 0.48 + random() * 1.22
    radii[index] = normalizedRadius
  }

  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1))
  geometry.setAttribute('aRadius', new BufferAttribute(radii, 1))
  return geometry
}

export function createGalaxyGeometry(settings: GalaxyGeometrySettings): GalaxyGeometrySet {
  const qualityScale = settings.quality === 'low' ? 0.42 : settings.quality === 'high' ? 1.35 : 1
  const deviceScale = settings.globalQuality === 'low' ? 0.62 : 1
  const count = Math.max(3000, Math.floor(settings.starCount * qualityScale * deviceScale))
  return {
    disk: makeGeometry(count, settings, 'disk'),
    bright: makeGeometry(Math.floor(settings.brightStarCount * deviceScale), settings, 'bright', 92821),
    background: makeGeometry(Math.floor(settings.backgroundStarCount * deviceScale), settings, 'background', 42173),
    count,
  }
}
