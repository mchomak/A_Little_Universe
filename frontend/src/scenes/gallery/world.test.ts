import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { GALLERY } from './content'
import { GALLERY_WORLD, getGalleryCloudMasses, getGalleryCloudWisps, getGalleryHazeMasses, getGalleryMoonScatteringLayers } from './world'

describe('moonlit gallery world layout', () => {
  it('leaves the declarative moon light target attached across StrictMode effect replay', () => {
    const moonlitWorld = readFileSync(new URL('./MoonlitWorld.tsx', import.meta.url), 'utf8')
    expect(moonlitWorld).not.toContain('moonLightTarget.removeFromParent()')
  })

  it('keeps the floor under the route and the elevated moon fixed beyond its end', () => {
    const routeEnd = GALLERY.startZ - GALLERY.travel
    const floorStart = GALLERY_WORLD.floor.centerZ + GALLERY_WORLD.floor.depth / 2
    const floorEnd = GALLERY_WORLD.floor.centerZ - GALLERY_WORLD.floor.depth / 2

    expect(GALLERY_WORLD.floor.y).toBe(-2.35)
    expect(floorStart).toBeGreaterThan(GALLERY.startZ)
    expect(floorEnd).toBeLessThan(routeEnd - 20)
    expect(GALLERY_WORLD.moon.position[0]).toBeCloseTo(0.2)
    expect(GALLERY_WORLD.moon.position[1]).toBeGreaterThan(10)
    expect(GALLERY_WORLD.moon.position[2]).toBe(-126)
    expect(GALLERY_WORLD.moon.position[2]).toBeLessThan(routeEnd - 40)
    expect(GALLERY_WORLD.moon.radius).toBeGreaterThan(2)
    expect(GALLERY_WORLD.moon.radius).toBeLessThan(2.5)
  })

  it('uses world-space cloud masses and a separate set of distant haze volumes', () => {
    const clouds = getGalleryCloudMasses('standard')
    const zPositions = clouds.map(({ position }) => position[2])
    const skyClouds = clouds.filter(({ id }) => id.startsWith('far-') || id.startsWith('deep-'))
    const sideClouds = clouds.filter(({ id }) => id.startsWith('side-'))
    const haze = getGalleryHazeMasses('standard')

    expect(clouds.length).toBeGreaterThanOrEqual(8)
    expect(Math.max(...zPositions) - Math.min(...zPositions)).toBeGreaterThan(90)
    expect(clouds.some(({ id, position }) => id === 'moon-veil' && position[2] > GALLERY_WORLD.moon.position[2])).toBe(true)
    expect(skyClouds.length).toBeGreaterThanOrEqual(4)
    expect(skyClouds.every(({ position }) => position[2] < GALLERY.startZ - GALLERY.travel - 30)).toBe(true)
    expect(sideClouds.length).toBeGreaterThanOrEqual(4)
    expect(sideClouds.every(({ position, radii }) => Math.abs(position[0]) - radii[0] > 5)).toBe(true)
    expect(haze.length).toBeGreaterThanOrEqual(3)
    expect(haze.every(({ position, radii }) => position[1] < 1 && radii[1] < 6)).toBe(true)
  })

  it('places procedural cloud masses at several fixed depths outside the photo corridor', () => {
    const masses = getGalleryCloudMasses('standard')
    const zPositions = masses.map(({ position }) => position[2])
    const sideMasses = masses.filter(({ id }) => id.startsWith('side-'))
    const moonVeil = masses.find(({ id }) => id === 'moon-veil')

    expect(masses.length).toBeGreaterThanOrEqual(8)
    expect(Math.max(...zPositions) - Math.min(...zPositions)).toBeGreaterThan(80)
    expect(new Set(zPositions).size).toBeGreaterThanOrEqual(5)
    expect(sideMasses.length).toBeGreaterThanOrEqual(4)
    expect(sideMasses.every(({ position, radii }) => Math.abs(position[0]) - radii[0] > 5)).toBe(true)
    expect(moonVeil).toBeDefined()
    expect(Math.abs(moonVeil!.position[1] - GALLERY_WORLD.moon.position[1])).toBeLessThan(3)
    expect(masses.every(({ radii }) => radii[0] > radii[2] && radii[2] > 0)).toBe(true)
    expect(getGalleryCloudMasses('low').length).toBeLessThan(masses.length)
  })

  it('places sparse scattering pools along the fixed moon-to-gallery direction', () => {
    const layers = getGalleryMoonScatteringLayers()
    expect(layers).toHaveLength(4)
    expect(layers[0]!.position[1]).toBeLessThan(GALLERY_WORLD.moon.position[1])
    expect(layers[3]!.position[2]).toBeGreaterThan(layers[0]!.position[2])
    expect(layers[0]!.position[2] - GALLERY_WORLD.moon.position[2]).toBeGreaterThan(20)
    expect(layers.every(({ size, intensity }) => size > 19 && size < 30 && intensity > 0 && intensity < 0.2)).toBe(true)
  })

  it('scales decorative atmosphere in low quality while keeping the moon veil', () => {
    expect(getGalleryCloudMasses('low').length).toBeLessThan(getGalleryCloudMasses('standard').length)
    expect(getGalleryCloudMasses('low').some(({ id }) => id === 'moon-veil')).toBe(true)
    expect(getGalleryHazeMasses('low').length).toBeLessThan(getGalleryHazeMasses('standard').length)
  })

  it('expands each selected cloud bank into three standard or two low-quality wisps', () => {
    const banks = getGalleryCloudMasses('standard').slice(0, 3)
    const wisps = getGalleryCloudWisps('standard', 3)

    expect(wisps).toEqual(getGalleryCloudWisps('standard', 3))
    expect([...new Set(wisps.map(({ bankId }) => bankId))]).toEqual(banks.map(({ id }) => id))
    expect(getGalleryCloudWisps('standard').length).toBeLessThanOrEqual(27)
    expect(getGalleryCloudWisps('standard').length).toBe(getGalleryCloudMasses('standard').length * 3)
    for (const bank of banks) {
      const daughters = wisps.filter(({ bankId }) => bankId === bank.id)
      expect(daughters).toHaveLength(3)
      expect(new Set(daughters.map(({ position }) => position.join(','))).size).toBe(daughters.length)
      expect(daughters.every(({ opacity }) => opacity < bank.opacity)).toBe(true)
      const furthestLobeOffset = Math.max(...daughters.map(({ position }) => Math.hypot(
        (position[0] - bank.position[0]) / bank.radii[0],
        (position[1] - bank.position[1]) / bank.radii[1],
      )))
      expect(furthestLobeOffset).toBeGreaterThan(0.38)
    }

    const standardFirstBank = getGalleryCloudWisps('standard', 1)
    const lowFirstBank = getGalleryCloudWisps('low', 1)
    expect(standardFirstBank).toHaveLength(3)
    expect(lowFirstBank).toHaveLength(2)
    expect(lowFirstBank.every(({ bankId }) => bankId === banks[0]!.id)).toBe(true)
    expect(getGalleryCloudWisps('low').length).toBe(getGalleryCloudMasses('low').length * 2)
  })
})
