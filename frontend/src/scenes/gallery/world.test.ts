import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { GALLERY } from './content'
import { GALLERY_WORLD, getGalleryCloudDrift, getGalleryCloudMasses, getGalleryCloudMassesForCount, getGalleryCloudRegionAmount, getGalleryHazeMasses, getGalleryMoonScatteringLayers } from './world'

describe('moonlit gallery world layout', () => {
  it('leaves the declarative moon light target attached across StrictMode effect replay', () => {
    const moonlitWorld = readFileSync(new URL('./MoonlitWorld.tsx', import.meta.url), 'utf8')
    expect(moonlitWorld).not.toContain('moonLightTarget.removeFromParent()')
  })

  it('keeps moon scattering smooth instead of quantizing its haze into UV cells', () => {
    const moonlitWorld = readFileSync(new URL('./MoonlitWorld.tsx', import.meta.url), 'utf8')
    expect(moonlitWorld).not.toMatch(/hash\s*\(\s*floor\s*\(\s*vUv/)
    expect(moonlitWorld).toContain('halo * uIntensity * breath')
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

  it('surrounds the gallery route with world-space cloud volumes while keeping photos clear', () => {
    const clouds = getGalleryCloudMasses('standard')
    const zPositions = clouds.map(({ position }) => position[2])
    const sideClouds = clouds.filter(({ id }) => id.startsWith('side-'))
    const haze = getGalleryHazeMasses('standard')

    expect(clouds).toHaveLength(24)
    expect(Math.max(...zPositions) - Math.min(...zPositions)).toBeGreaterThan(100)
    expect(sideClouds).toHaveLength(6)
    expect(sideClouds.filter(({ position }) => position[0] < 0)).toHaveLength(3)
    expect(sideClouds.filter(({ position }) => position[0] > 0)).toHaveLength(3)
    expect(sideClouds.every(({ position, radii }) => Math.abs(position[0]) - radii[0] > 5)).toBe(true)
    expect(clouds.filter(({ region }) => region === 'foreground' || region === 'midground')
      .every(({ position, radii }) => Math.abs(position[0]) - radii[0] > 5.33)).toBe(true)
    expect(clouds.filter(({ region }) => region === 'near-floor')).toHaveLength(5)
    expect(clouds.filter(({ region }) => region === 'foreground')).toHaveLength(6)
    expect(clouds.filter(({ region }) => region === 'midground')).toHaveLength(6)
    expect(clouds.filter(({ region }) => region === 'background')).toHaveLength(7)
    const floorBanks = getGalleryCloudMassesForCount('standard', 18).filter(({ region }) => region === 'near-floor')
    expect(floorBanks.every(({ position, radii }) => {
      const bottom = position[1] - radii[1]
      const top = position[1] + radii[1]
      return bottom <= GALLERY_WORLD.floor.y && top >= GALLERY_WORLD.floor.y
    })).toBe(true)
    expect(Math.max(...floorBanks.map(({ position }) => position[2]))).toBeGreaterThan(-10)
    expect(floorBanks.every(({ opacity }) => opacity >= 0.45)).toBe(true)
    for (let z = GALLERY.startZ; z >= GALLERY.startZ - GALLERY.travel; z -= 5) {
      const closestFloorGap = Math.min(...floorBanks.map(({ position, radii }) => Math.max(0, Math.abs(position[2] - z) - radii[2])))
      expect(closestFloorGap, `floor cloud coverage at z=${z}`).toBeLessThanOrEqual(1)
    }
    expect(haze.length).toBeGreaterThanOrEqual(3)
    expect(haze.every(({ position, radii }) => position[1] < 1 && radii[1] < 6)).toBe(true)
  })

  it('places cloud volumes beside, above, and around the moon at varied depths', () => {
    const masses = getGalleryCloudMasses('standard')
    const zPositions = masses.map(({ position }) => position[2])
    const sideMasses = masses.filter(({ id }) => id.startsWith('side-'))
    expect(masses).toHaveLength(24)
    expect(Math.max(...zPositions) - Math.min(...zPositions)).toBeGreaterThan(100)
    expect(new Set(zPositions).size).toBeGreaterThanOrEqual(5)
    expect(sideMasses).toHaveLength(6)
    expect(sideMasses.every(({ position, radii }) => Math.abs(position[0]) - radii[0] > 5)).toBe(true)
    expect(masses.every(({ radii }) => radii.every((radius) => radius > 0))).toBe(true)
    expect(masses.filter(({ id }) => id.startsWith('upper-'))).toHaveLength(4)
    expect(Math.max(...masses.map(({ position }) => position[1]))).toBeGreaterThan(20)
    expect(getGalleryCloudMasses('low')).toHaveLength(20)
    expect(getGalleryCloudMasses('low').filter(({ region }) => region === 'foreground')).toHaveLength(6)
    expect(getGalleryCloudMasses('low').filter(({ region }) => region === 'near-floor')).toHaveLength(5)
    expect(getGalleryCloudMasses('low').filter(({ region }) => region === 'background')).toHaveLength(3)
  })

  it('places sparse scattering pools along the fixed moon-to-gallery direction', () => {
    const layers = getGalleryMoonScatteringLayers()
    expect(layers).toHaveLength(4)
    expect(layers[0]!.position[1]).toBeLessThan(GALLERY_WORLD.moon.position[1])
    expect(layers[3]!.position[2]).toBeGreaterThan(layers[0]!.position[2])
    expect(layers[0]!.position[2] - GALLERY_WORLD.moon.position[2]).toBeGreaterThan(20)
    expect(layers.every(({ size, intensity }) => size > 19 && size < 30 && intensity > 0 && intensity < 0.2)).toBe(true)
  })

  it('rebuilds the same sparse light path from Inspector moon and target coordinates', () => {
    const layers = getGalleryMoonScatteringLayers([3, 18, -120], [5, -1, -30])
    expect(layers[0]!.position[0]).toBeCloseTo(3.88)
    expect(layers[0]!.position[1]).toBeCloseTo(9.64)
    expect(layers[0]!.position[2]).toBeCloseTo(-80.4)
    expect(layers[3]!.position[0]).toBeCloseTo(4.72)
    expect(layers[3]!.position[1]).toBeCloseTo(1.66)
    expect(layers[3]!.position[2]).toBeCloseTo(-42.6)
  })

  it('scales cloud and haze layers for low quality without losing either side of the corridor', () => {
    expect(getGalleryCloudMasses('low').length).toBeLessThan(getGalleryCloudMasses('standard').length)
    expect(new Set(getGalleryCloudMasses('low').map(({ region }) => region))).toEqual(new Set(['foreground', 'midground', 'background', 'near-floor']))
    expect(getGalleryHazeMasses('low').length).toBeLessThan(getGalleryHazeMasses('standard').length)
  })

  it('keeps cloud planes represented when the DEV layer count is reduced', () => {
    expect(getGalleryCloudMassesForCount('standard', 1)).toHaveLength(1)
    expect(getGalleryCloudMassesForCount('standard', 0)).toHaveLength(0)
    expect(getGalleryCloudMassesForCount('standard', 4).map(({ region }) => region)).toEqual([
      'foreground', 'background', 'midground', 'near-floor',
    ])
    expect(new Set(getGalleryCloudMassesForCount('standard', 8).map(({ region }) => region))).toEqual(new Set([
      'foreground', 'background', 'midground', 'near-floor',
    ]))
    const standardRenderSet = getGalleryCloudMassesForCount('standard', 99)
    const lowRenderSet = getGalleryCloudMassesForCount('low', 99)
    expect(standardRenderSet).toHaveLength(18)
    expect(lowRenderSet).toHaveLength(14)
    expect(standardRenderSet.filter(({ region }) => region === 'near-floor')).toHaveLength(5)
    expect(lowRenderSet.filter(({ region }) => region === 'near-floor')).toHaveLength(5)
    const lowMidground = lowRenderSet.filter(({ region }) => region === 'midground')
    expect(lowMidground.map(({ position }) => position[2])).toEqual([2, -35, -73])
    for (let z = GALLERY.startZ; z >= GALLERY.startZ - GALLERY.travel; z -= 5) {
      const closestMidgroundGap = Math.min(...lowMidground.map(({ position, radii }) => Math.max(0, Math.abs(position[2] - z) - radii[2])))
      expect(closestMidgroundGap, `low-quality midground coverage at z=${z}`).toBeLessThanOrEqual(1)
    }
    expect(getGalleryCloudMassesForCount('standard', 24)).toHaveLength(18)
  })

  it('drifts each volume smoothly and deterministically from scene time', () => {
    const mass = getGalleryCloudMasses('standard')[0]!
    expect(getGalleryCloudDrift(mass, 12)).toEqual(getGalleryCloudDrift(mass, 12))
    expect(getGalleryCloudDrift(mass, 12)).not.toEqual(getGalleryCloudDrift(mass, 13))
    expect(Math.hypot(...getGalleryCloudDrift(mass, 12))).toBeLessThan(2)
    expect(getGalleryCloudDrift(mass, Number.NaN)).toEqual([0, 0, 0])
    expect(getGalleryCloudDrift(mass, 12, 0)).toEqual([0, 0, 0])
    expect(getGalleryCloudDrift(mass, 12, 0.8, 0)).not.toEqual(getGalleryCloudDrift(mass, 12, 0.8, 1))
    expect(getGalleryCloudDrift(mass, 12, 0.8, 1).some((value, index) => value !== getGalleryCloudDrift(getGalleryCloudMasses('standard')[1]!, 12, 0.8, 1)[index])).toBe(true)
  })

  it('changes cloud regions independently without affecting the mid corridor', () => {
    const amounts = { foreground: 1.2, background: 0.4, nearFloor: 0.7 }
    expect(getGalleryCloudRegionAmount('foreground', amounts)).toBe(1.2)
    expect(getGalleryCloudRegionAmount('background', amounts)).toBe(0.4)
    expect(getGalleryCloudRegionAmount('near-floor', amounts)).toBe(0.7)
    expect(getGalleryCloudRegionAmount('midground', amounts)).toBe(1)
    expect(getGalleryCloudRegionAmount('foreground', { ...amounts, foreground: 9 })).toBe(1.6)
  })
})
