import { expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { createGalaxyGeometry, updateGalaxyColors } from './generateGalaxy'
import { getGalaxyRenderPalette, selectGalaxyPalette } from './palette'

const base = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.galaxy
const settings = {
  seed: 'andromeda', starCount: 8000, arms: 5, radius: 8.2, spin: 4.6,
  armWidth: 0.16, randomness: 0.065, randomnessPower: 3.6, coreSize: 0.24,
  coreDensity: 0.2, thickness: 0.05, distribution: 'balanced' as const,
  brightStarCount: 12, backgroundStarCount: 20, backgroundDepth: 42,
  quality: 'standard' as const, globalQuality: 'standard' as const, palette: getGalaxyRenderPalette(base),
}

function dispose(geometry: ReturnType<typeof createGalaxyGeometry>) {
  geometry.disk.dispose(); geometry.bright.dispose(); geometry.background.dispose()
}

it('generates deterministic positions, colors, sizes and seeds from the same string seed', () => {
  const first = createGalaxyGeometry(settings)
  const second = createGalaxyGeometry(settings)
  for (const key of ['position', 'aColor', 'aSize', 'aSeed']) {
    expect(Array.from(first.disk.getAttribute(key).array)).toEqual(Array.from(second.disk.getAttribute(key).array))
  }
  expect(Array.from(first.bright.getAttribute('position').array)).toEqual(Array.from(second.bright.getAttribute('position').array))
  expect(first.count).toBe(8000)
  dispose(first); dispose(second)
})

it('uses the reference logarithmic arm winding and normalized arm-width scatter', () => {
  const geometry = createGalaxyGeometry({ ...settings, armWidth: 0, randomness: 0, coreDensity: 0 })
  const positions = geometry.disk.getAttribute('position').array
  let largestArmAlignmentError = 0

  for (let index = 0; index < geometry.count; index += 1) {
    const offset = index * 3
    const x = positions[offset]
    const y = positions[offset + 1]
    if (x === undefined || y === undefined) throw new Error('Galaxy point data is incomplete')
    const radius = Math.hypot(x, y)
    const angle = Math.atan2(y, x)
    const branch = (index % settings.arms) / settings.arms * Math.PI * 2
    const phase = angle - (radius / settings.radius) * settings.spin
    const error = Math.atan2(Math.sin(phase - branch), Math.cos(phase - branch))
    largestArmAlignmentError = Math.max(largestArmAlignmentError, Math.abs(error))
  }

  expect(largestArmAlignmentError).toBeLessThan(1e-5)
  dispose(geometry)
})

it('keeps the original flat Gaussian bulge and disk thickness in the galaxy plane', () => {
  const geometry = createGalaxyGeometry(settings)
  const positions = geometry.disk.getAttribute('position').array
  const coreCount = Math.floor(geometry.count * settings.coreDensity)
  const coreRadii: number[] = []
  const coreDepths: number[] = []
  for (let index = geometry.count - coreCount; index < geometry.count; index += 1) {
    const offset = index * 3
    const x = positions[offset]
    const y = positions[offset + 1]
    const z = positions[offset + 2]
    if (x === undefined || y === undefined || z === undefined) throw new Error('Galaxy core data is incomplete')
    coreRadii.push(Math.hypot(x, y))
    coreDepths.push(Math.abs(z))
  }
  expect(coreRadii.length).toBe(coreCount)
  expect(Math.max(...coreDepths)).toBeLessThan(settings.radius * settings.coreSize * 0.8)
  expect(Math.max(...coreRadii)).toBeLessThan(settings.radius * settings.coreSize * 3)
  dispose(geometry)
})

it('adds original R/B/Y/V color knots and creates separately seeded sun stars', () => {
  const geometry = createGalaxyGeometry(settings)
  const colors = geometry.disk.getAttribute('aColor').array
  const brightColors = geometry.bright.getAttribute('aColor').array
  expect(colors.length).toBe(geometry.count * 3)
  expect(brightColors.length).toBe(settings.brightStarCount * 3)
  const channels = [0, 0, 0]
  for (let index = 0; index < colors.length; index += 3) {
    channels[0] = Math.max(channels[0]!, colors[index] ?? 0)
    channels[1] = Math.max(channels[1]!, colors[index + 1] ?? 0)
    channels[2] = Math.max(channels[2]!, colors[index + 2] ?? 0)
  }
  expect(channels[0]).toBeGreaterThan(1)
  expect(channels[1]).toBeGreaterThan(1)
  expect(channels[2]).toBeGreaterThan(1)
  expect(geometry.background.getAttribute('position').count).toBe(settings.backgroundStarCount)
  dispose(geometry)
})

it('updates live palette colors without changing the rebuilt galaxy geometry', () => {
  const geometry = createGalaxyGeometry(settings)
  const positions = Array.from(geometry.disk.getAttribute('position').array)
  const previousColors = Array.from(geometry.disk.getAttribute('aColor').array)
  const iceSettings = selectGalaxyPalette(base, 'ice')
  updateGalaxyColors(geometry.disk, getGalaxyRenderPalette(iceSettings))

  expect(Array.from(geometry.disk.getAttribute('position').array)).toEqual(positions)
  expect(Array.from(geometry.disk.getAttribute('aColor').array)).not.toEqual(previousColors)
  dispose(geometry)
})

it('scales galaxy, sun and background point counts with quality without dropping depth', () => {
  const standard = createGalaxyGeometry({ ...settings, starCount: base.starCount, backgroundStarCount: 5200 })
  const low = createGalaxyGeometry({ ...settings, starCount: base.starCount, backgroundStarCount: 5200, quality: 'low' })
  const high = createGalaxyGeometry({ ...settings, starCount: base.starCount, backgroundStarCount: 5200, quality: 'high' })
  const z = standard.disk.getAttribute('position').array.filter((_, index) => index % 3 === 2)
  expect(low.count).toBeLessThan(standard.count)
  expect(low.background.getAttribute('position').count).toBeLessThan(standard.background.getAttribute('position').count)
  expect(high.background.getAttribute('position').count).toBeGreaterThan(standard.background.getAttribute('position').count)
  expect(Math.max(...z.slice(0, 500))).toBeGreaterThan(0)
  expect(Math.min(...z.slice(0, 500))).toBeLessThan(0)
  dispose(standard); dispose(low); dispose(high)
})

it('places enough distant stars inside the standard 45-degree camera frustum', () => {
  const geometry = createGalaxyGeometry({
    ...settings,
    backgroundStarCount: 5200,
    backgroundDepth: 42,
    quality: 'standard',
  })
  const camera = new PerspectiveCamera(38, 1366 / 768, 0.1, 1000)
  camera.position.set(0, Math.sin(Math.PI / 4) * 16, Math.cos(Math.PI / 4) * 16)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()

  const positions = geometry.background.getAttribute('position')
  let inView = 0
  let minRadius = Number.POSITIVE_INFINITY
  let maxRadius = 0
  const point = new Vector3()
  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index)
    const radius = point.length()
    minRadius = Math.min(minRadius, radius)
    maxRadius = Math.max(maxRadius, radius)
    point.project(camera)
    if (Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && point.z >= -1 && point.z <= 1) inView += 1
  }

  expect(positions.count).toBe(5200)
  expect(minRadius).toBeGreaterThanOrEqual(42 * 0.7)
  expect(maxRadius).toBeLessThanOrEqual(42)
  expect(inView).toBeGreaterThanOrEqual(250)
  dispose(geometry)
})

it('keeps the distant field predominantly faint white points', () => {
  const geometry = createGalaxyGeometry({ ...settings, backgroundStarCount: 600 })
  const colors = geometry.background.getAttribute('aColor').array
  let palePoints = 0
  for (let index = 0; index < colors.length; index += 3) {
    const r = colors[index] ?? 0
    const g = colors[index + 1] ?? 0
    const b = colors[index + 2] ?? 0
    if (Math.max(r, g, b) - Math.min(r, g, b) < 0.16) palePoints += 1
  }
  expect(palePoints / 600).toBeGreaterThan(0.9)
  dispose(geometry)
})
