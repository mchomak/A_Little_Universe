import { BufferAttribute, BufferGeometry, Color, Sphere, Vector3 } from 'three'
import type { SeedQuality } from '../../systems/scene-config/config'
import type { GalaxyRenderPalette } from './palette'

export interface GalaxyGeometrySettings {
  seed: string
  starCount: number
  arms: number
  radius: number
  spin: number
  armWidth: number
  randomness: number
  randomnessPower: number
  coreSize: number
  coreDensity: number
  thickness: number
  distribution: 'balanced' | 'core' | 'arms'
  brightStarCount: number
  backgroundStarCount: number
  backgroundDepth: number
  quality: SeedQuality
  globalQuality: 'standard' | 'low'
  palette: GalaxyRenderPalette
}

export interface GalaxyGeometrySet {
  disk: BufferGeometry
  bright: BufferGeometry
  background: BufferGeometry
  count: number
}

export function updateGalaxyColors(geometry: BufferGeometry, palette: GalaxyRenderPalette) {
  const radii = geometry.getAttribute('aRadius')
  const regions = geometry.getAttribute('aRegion')
  const accents = geometry.getAttribute('aAccent')
  const accentMix = geometry.getAttribute('aAccentMix')
  const brightness = geometry.getAttribute('aBrightness')
  const colors = geometry.getAttribute('aColor')
  const coreColor = new Color(palette.coreColor)
  const innerColor = new Color(palette.innerColor)
  const outerColor = new Color(palette.outerColor)
  const hotColor = new Color(palette.hotColor)
  const redColor = new Color('#FF5A6E')
  const pinkColor = new Color('#FF6EC7')
  const goldColor = new Color('#FFD27A')
  const scratch = new Color()

  for (let index = 0; index < colors.count; index += 1) {
    const radius = radii.getX(index)
    const region = regions.getX(index)
    scratch.lerpColors(region > 0.5 ? coreColor : innerColor, region > 0.5 ? innerColor : outerColor, radius)
    const amount = accentMix.getX(index)
    switch (Math.round(accents.getX(index))) {
      case 1: scratch.lerp(redColor, amount); break
      case 2: scratch.lerp(pinkColor, amount); break
      case 3: scratch.lerp(goldColor, amount); break
      case 4: scratch.lerp(hotColor, amount); break
    }
    scratch.multiplyScalar(brightness.getX(index))
    colors.setXYZ(index, scratch.r, scratch.g, scratch.b)
  }
  colors.needsUpdate = true
}

/** Seed hashing and Mulberry32 sampler adapted from procedural-galaxy/src/rng.js. */
export function createGalaxyRandom(seed: string) {
  const value = String(seed)
  let hash = 1779033703 ^ value.length
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353)
    hash = (hash << 13) | (hash >>> 19)
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507)
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
  const seedValue = (hash ^ (hash >>> 16)) >>> 0
  let state = seedValue
  let spareGaussian: number | null = null
  const next = () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let result = Math.imul(state ^ (state >>> 15), 1 | state)
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range(min: number, max: number) { return min + (max - min) * next() },
    int(min: number, max: number) { return Math.floor(min + (max - min + 1) * next()) },
    sign() { return next() < 0.5 ? -1 : 1 },
    gauss() {
      if (spareGaussian !== null) {
        const value = spareGaussian
        spareGaussian = null
        return value
      }
      let x: number; let y: number; let square: number
      do {
        x = next() * 2 - 1
        y = next() * 2 - 1
        square = x * x + y * y
      } while (square >= 1 || square === 0)
      const factor = Math.sqrt(-2 * Math.log(square) / square)
      spareGaussian = y * factor
      return x * factor
    },
  }
}

function setPointAttributes(geometry: BufferGeometry, positions: Float32Array, colors: Float32Array, sizes: Float32Array, seeds: Float32Array) {
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aColor', new BufferAttribute(colors, 3))
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
}

function createDisk(settings: GalaxyGeometrySettings, count: number) {
  const geometry = new BufferGeometry()
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const seeds = new Float32Array(count)
  const radii = new Float32Array(count)
  const regions = new Float32Array(count)
  const accents = new Float32Array(count)
  const accentMixes = new Float32Array(count)
  const brightnesses = new Float32Array(count)
  const rng = createGalaxyRandom(settings.seed)
  const coreCount = Math.floor(count * settings.coreDensity)
  const diskCount = count - coreCount
  const distributionPower = settings.distribution === 'core' ? 1.8 : settings.distribution === 'arms' ? 0.95 : 1.3
  let cursor = 0

  // Source algorithm: center-weighted radius, indexed arm branch, logarithmic winding,
  // power-compressed scatter and a flattened Gaussian bulge. The target's disk is XY,
  // so source XZ maps to XY and source height maps to Z.
  for (let index = 0; index < diskCount; index += 1) {
    const radius = Math.pow(rng.next(), distributionPower) * settings.radius
    const arm = index % settings.arms
    const branch = arm / settings.arms * Math.PI * 2
    const winding = radius / settings.radius * settings.spin
    const angle = branch + winding
    const armScatterX = Math.pow(rng.next(), settings.randomnessPower) * rng.sign() * settings.armWidth * radius
    const armScatterY = Math.pow(rng.next(), settings.randomnessPower) * rng.sign() * settings.armWidth * radius
    const fuzzX = (rng.next() - 0.5) * settings.randomness * radius
    const fuzzY = (rng.next() - 0.5) * settings.randomness * radius
    const height = Math.pow(rng.next(), settings.randomnessPower) * rng.sign() * settings.thickness * settings.radius * (1 - 0.4 * radius / settings.radius)
    positions[cursor * 3] = Math.cos(angle) * radius + armScatterX + fuzzX
    positions[cursor * 3 + 1] = Math.sin(angle) * radius + armScatterY + fuzzY
    positions[cursor * 3 + 2] = height

    const normalizedRadius = Math.min(radius / settings.radius, 1)
    const roll = rng.next()
    let knot = false
    if (roll < 0.05) { accents[cursor] = 1; accentMixes[cursor] = rng.range(0.5, 0.9); knot = true }
    else if (roll < 0.1) { accents[cursor] = 2; accentMixes[cursor] = rng.range(0.5, 0.85); knot = true }
    else if (roll < 0.18) { accents[cursor] = 3; accentMixes[cursor] = rng.range(0.4, 0.8) }
    else if (roll < 0.4) { accents[cursor] = 4; accentMixes[cursor] = rng.range(0.4, 0.85) }
    const brightness = rng.range(0.55, 1.15)
    radii[cursor] = normalizedRadius
    regions[cursor] = 0
    brightnesses[cursor] = brightness
    let size = rng.range(0.7, 1.3)
    if (knot) size *= rng.range(1.4, 2.2)
    else if (rng.next() < 0.03) size *= rng.range(2, 3.4)
    sizes[cursor] = size
    seeds[cursor] = rng.next()
    cursor += 1
  }

  const coreRadius = settings.coreSize * settings.radius
  for (let index = 0; index < coreCount; index += 1) {
    const x = rng.gauss() * coreRadius * 0.62
    const y = rng.gauss() * coreRadius * 0.62
    const z = rng.gauss() * coreRadius * 0.15
    positions[cursor * 3] = x
    positions[cursor * 3 + 1] = y
    positions[cursor * 3 + 2] = z
    const normalizedRadius = Math.min(Math.hypot(x, y) / coreRadius, 1)
    const brightness = rng.range(0.85, 1.45) * (1 + (1 - normalizedRadius) * 0.5)
    radii[cursor] = normalizedRadius
    regions[cursor] = 1
    brightnesses[cursor] = brightness
    let size = rng.range(0.9, 1.7)
    if (rng.next() < 0.05) size *= rng.range(1.6, 2.6)
    sizes[cursor] = size
    seeds[cursor] = rng.next()
    cursor += 1
  }

  setPointAttributes(geometry, positions, colors, sizes, seeds)
  geometry.setAttribute('aRadius', new BufferAttribute(radii, 1))
  geometry.setAttribute('aRegion', new BufferAttribute(regions, 1))
  geometry.setAttribute('aAccent', new BufferAttribute(accents, 1))
  geometry.setAttribute('aAccentMix', new BufferAttribute(accentMixes, 1))
  geometry.setAttribute('aBrightness', new BufferAttribute(brightnesses, 1))
  updateGalaxyColors(geometry, settings.palette)
  geometry.boundingSphere = new Sphere(new Vector3(), settings.radius * 1.8)
  return geometry
}

function createSuns(settings: GalaxyGeometrySettings, count: number) {
  const geometry = new BufferGeometry()
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const seeds = new Float32Array(count)
  const rng = createGalaxyRandom(`${settings.seed}::suns`)
  const color = new Color()

  for (let index = 0; index < count; index += 1) {
    const radius = rng.range(0.3, 0.95) * settings.radius
    const arm = rng.int(0, settings.arms - 1)
    const branch = arm / settings.arms * Math.PI * 2
    const winding = radius / settings.radius * settings.spin
    const angle = branch + winding + rng.gauss() * settings.armWidth * 0.5
    const jitter = settings.armWidth * 0.4 * radius
    positions[index * 3] = Math.cos(angle) * radius + rng.gauss() * jitter
    positions[index * 3 + 1] = Math.sin(angle) * radius + rng.gauss() * jitter
    positions[index * 3 + 2] = rng.gauss() * settings.thickness * settings.radius * 0.6

    const roll = rng.next()
    let hue: number; let saturation: number; let lightness: number
    if (roll < 0.72) { hue = rng.range(0.02, 0.09); saturation = rng.range(0.85, 1); lightness = rng.range(0.48, 0.58) }
    else if (roll < 0.88) { hue = rng.range(0.1, 0.15); saturation = rng.range(0.75, 0.95); lightness = rng.range(0.55, 0.64) }
    else { hue = rng.range(0.55, 0.63); saturation = rng.range(0.45, 0.75); lightness = rng.range(0.6, 0.7) }
    color.setHSL(hue, saturation, lightness)
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
    sizes[index] = rng.range(2.6, 5.6)
    seeds[index] = rng.next()
  }

  setPointAttributes(geometry, positions, colors, sizes, seeds)
  geometry.boundingSphere = new Sphere(new Vector3(), settings.radius * 1.8)
  return geometry
}

function createBackgroundField(settings: GalaxyGeometrySettings, count: number) {
  const geometry = new BufferGeometry()
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const seeds = new Float32Array(count)
  const rng = createGalaxyRandom(`${settings.seed}::field`)
  const color = new Color()
  const shell = settings.backgroundDepth
  for (let index = 0; index < count; index += 1) {
    const u = rng.next()
    const v = rng.next()
    const theta = u * Math.PI * 2
    const phi = Math.acos(2 * v - 1)
    const radius = shell * (0.7 + rng.next() * 0.3)
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
    positions[index * 3 + 1] = radius * Math.cos(phi)
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
    const neutralStar = rng.next() < 0.92
    const hue = neutralStar ? rng.range(0.55, 0.66) : rng.range(0.05, 0.12)
    color.setHSL(hue, rng.range(0, neutralStar ? 0.12 : 0.08), rng.range(0.72, 0.98))
    const brightness = rng.range(0.4, 1.05)
    colors[index * 3] = color.r * brightness
    colors[index * 3 + 1] = color.g * brightness
    colors[index * 3 + 2] = color.b * brightness
    sizes[index] = 1.6
    seeds[index] = rng.next()
  }
  setPointAttributes(geometry, positions, colors, sizes, seeds)
  geometry.boundingSphere = new Sphere(new Vector3(), shell * 1.1)
  return geometry
}

export function createGalaxyGeometry(settings: GalaxyGeometrySettings): GalaxyGeometrySet {
  const qualityScale = settings.quality === 'low' ? 0.42 : settings.quality === 'high' ? 1.35 : 1
  const deviceScale = settings.globalQuality === 'low' ? 0.62 : 1
  const count = Math.max(3000, Math.floor(settings.starCount * qualityScale * deviceScale))
  const backgroundCount = Math.floor(settings.backgroundStarCount * qualityScale * deviceScale)
  return {
    disk: createDisk(settings, count),
    bright: createSuns(settings, Math.floor(settings.brightStarCount * deviceScale)),
    background: createBackgroundField(settings, backgroundCount),
    count,
  }
}
