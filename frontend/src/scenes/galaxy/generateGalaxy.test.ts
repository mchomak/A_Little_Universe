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
