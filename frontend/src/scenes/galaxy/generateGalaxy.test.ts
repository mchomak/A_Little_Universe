import { expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { createGalaxyGeometry } from './generateGalaxy'

const base = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.galaxy
const settings = {
  seed: base.seed, starCount: 8000, arms: base.arms, radius: base.radius, spin: base.spin,
  armWidth: base.armWidth, scatter: base.scatter, coreSize: base.coreSize, coreDensity: base.coreDensity,
  thickness: base.thickness, distribution: base.distribution, brightStarCount: 12,
  backgroundStarCount: 20, backgroundDepth: base.backgroundDepth, quality: 'standard' as const,
  globalQuality: 'standard' as const,
}

it('generates deterministic point positions from the same seed and settings', () => {
  const first = createGalaxyGeometry(settings)
  const second = createGalaxyGeometry(settings)
  expect(Array.from(first.disk.getAttribute('position').array)).toEqual(Array.from(second.disk.getAttribute('position').array))
  expect(Array.from(first.bright.getAttribute('aSeed').array)).toEqual(Array.from(second.bright.getAttribute('aSeed').array))
  expect(first.count).toBe(8000)
  first.disk.dispose(); first.bright.dispose(); first.background.dispose()
  second.disk.dispose(); second.bright.dispose(); second.background.dispose()
})

it('scales geometry with the selected quality and keeps full depth coordinates', () => {
  const standard = createGalaxyGeometry(settings)
  const low = createGalaxyGeometry({ ...settings, quality: 'low' })
  const z = standard.disk.getAttribute('position').array.filter((_, index) => index % 3 === 2)
  expect(low.count).toBeLessThan(standard.count)
  expect(Math.max(...z.slice(0, 500))).toBeGreaterThan(0)
  expect(Math.min(...z.slice(0, 500))).toBeLessThan(0)
  standard.disk.dispose(); standard.bright.dispose(); standard.background.dispose()
  low.disk.dispose(); low.bright.dispose(); low.background.dispose()
})

it('interprets spin as radians of total winding across the disk radius', () => {
  const spin = 4.6
  const geometry = createGalaxyGeometry({ ...settings, spin, armWidth: 0, scatter: 0, coreDensity: 0 })
  const positions = geometry.disk.getAttribute('position').array
  const radii = geometry.disk.getAttribute('aRadius').array
  const armStep = Math.PI * 2 / settings.arms
  let largestArmAlignmentError = 0

  for (let index = 0; index < geometry.count; index += 1) {
    const offset = index * 3
    const x = positions[offset]
    const y = positions[offset + 1]
    const radius = radii[index]
    if (x === undefined || y === undefined || radius === undefined) throw new Error('Galaxy point data is incomplete')
    if (radius < settings.coreSize / settings.radius * 2) continue
    const angle = Math.atan2(y, x)
    const phase = ((angle - radius * spin) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
    const nearestArmPhase = Math.round(phase / armStep) * armStep
    const error = Math.atan2(Math.sin(phase - nearestArmPhase), Math.cos(phase - nearestArmPhase))
    largestArmAlignmentError = Math.max(largestArmAlignmentError, Math.abs(error))
  }

  expect(largestArmAlignmentError).toBeLessThan(1e-5)
  geometry.disk.dispose(); geometry.bright.dispose(); geometry.background.dispose()
})

it('keeps the inner bulge angularly diffuse instead of collapsing into axial arm spokes', () => {
  const geometry = createGalaxyGeometry({ ...settings, starCount: 8000 })
  const positions = geometry.disk.getAttribute('position').array
  const radii = geometry.disk.getAttribute('aRadius').array
  let coreCount = 0
  let armX = 0
  let armY = 0

  for (let index = 0; index < geometry.count; index += 1) {
    const radius = radii[index]
    if (radius === undefined || radius >= 0.1) continue
    const offset = index * 3
    const x = positions[offset]
    const y = positions[offset + 1]
    if (x === undefined || y === undefined) throw new Error('Galaxy point data is incomplete')
    const angle = Math.atan2(y, x)
    armX += Math.cos(angle * settings.arms)
    armY += Math.sin(angle * settings.arms)
    coreCount += 1
  }

  expect(coreCount).toBeGreaterThan(500)
  expect(Math.hypot(armX, armY) / coreCount).toBeLessThan(0.15)
  geometry.disk.dispose(); geometry.bright.dispose(); geometry.background.dispose()
})
