import { describe, expect, it } from 'vitest'
import { GALLERY } from './content'
import { GALLERY_CLOUD_RENDER_LIMIT, GALLERY_WORLD, getGalleryAtmosphereStepCount, getGalleryAtmosphereVisibilityFade, getGalleryCloudDrift, getGalleryCloudMasses, getGalleryCloudMassesForLayerCounts, getGalleryCloudPosition, getGalleryCloudRadii, getGalleryCloudRenderOrder, getGalleryHazeCameraFade, getGalleryHazeMasses, getGalleryMoonScatteringLayers } from './world'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'

const cloudLayers = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery.cloudLayers

describe('moonlit gallery world layout', () => {
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
  })

  it('renders four separately counted layers within quality budgets and preserves moon wisps', () => {
    const standard = getGalleryCloudMassesForLayerCounts('standard', cloudLayers)
    const low = getGalleryCloudMassesForLayerCounts('low', cloudLayers)
    const counts = Object.fromEntries(['far', 'mid', 'nearLow', 'waterline'].map((layer) => [
      layer,
      standard.filter((mass) => mass.layer === layer).length,
    ]))

    expect(counts).toEqual({ far: 3, mid: 3, nearLow: 8, waterline: 10 })
    expect(standard).toHaveLength(GALLERY_CLOUD_RENDER_LIMIT.standard)
    expect(low).toHaveLength(GALLERY_CLOUD_RENDER_LIMIT.low)
    expect(new Set(low.map((mass) => mass.layer))).toEqual(new Set(['far', 'mid', 'nearLow', 'waterline']))
    expect(Object.fromEntries(['far', 'mid', 'nearLow', 'waterline'].map((layer) => [
      layer, low.filter((mass) => mass.layer === layer).length,
    ]))).toEqual({ far: 3, mid: 1, nearLow: 6, waterline: 6 })
    expect(standard.filter((mass) => mass.moonInteraction)).toHaveLength(2)
    expect(standard.filter((mass) => mass.moonInteraction).every((mass) => mass.opacity < 0.5)).toBe(true)
    expect(low.filter((mass) => mass.moonInteraction)).toHaveLength(2)
    const moonWisps = standard.filter((mass) => mass.moonInteraction)
    expect(moonWisps).toHaveLength(2)
    expect(moonWisps.every((mass) => mass.position[2] > GALLERY_WORLD.moon.position[2])).toBe(true)
    expect(moonWisps.every((mass) => Math.abs(mass.position[0] - GALLERY_WORLD.moon.position[0]) < mass.radii[0])).toBe(true)
    expect(moonWisps.some((mass) => {
      const dx = (GALLERY_WORLD.moon.position[0] - mass.position[0]) / mass.radii[0]
      const dy = (GALLERY_WORLD.moon.position[1] - mass.position[1]) / mass.radii[1]
      return dx * dx + dy * dy < 1
    })).toBe(true)

    const oversized = Object.fromEntries(Object.entries(cloudLayers).map(([layer, settings]) => [layer, { ...settings, count: 24 }])) as typeof cloudLayers
    expect(getGalleryCloudMassesForLayerCounts('standard', oversized)).toHaveLength(GALLERY_CLOUD_RENDER_LIMIT.standard)
    expect(getGalleryCloudMassesForLayerCounts('low', oversized)).toHaveLength(GALLERY_CLOUD_RENDER_LIMIT.low)
  })

  it('spends more ray samples on close corridor clouds and fewer in the water reflection', () => {
    const sampleBudget = (quality: 'low' | 'standard', reflection = false) => {
      const clouds = getGalleryCloudMassesForLayerCounts(quality, cloudLayers)
      const haze = getGalleryHazeMasses(quality)
      return [
        ...clouds.map((mass) => getGalleryAtmosphereStepCount(quality, mass.layer, 0, reflection)),
        ...haze.map(() => getGalleryAtmosphereStepCount(quality, 'haze', 0, reflection)),
      ].reduce((sum, steps) => sum + steps, 0)
    }

    expect(sampleBudget('standard')).toBe(261)
    expect(sampleBudget('standard', true)).toBe(90)
    expect(sampleBudget('low')).toBe(66)
    expect(sampleBudget('low', true)).toBe(48)
    expect(getGalleryAtmosphereStepCount('standard', 'nearLow', 18)).toBe(12)
    expect(getGalleryAtmosphereStepCount('standard', 'nearLow', 50)).toBeGreaterThan(5)
    expect(getGalleryAtmosphereStepCount('standard', 'nearLow', 50)).toBeLessThan(12)
    expect(getGalleryAtmosphereStepCount('standard', 'nearLow', 90)).toBe(5)
  })

  it('fades distant clouds continuously before removing fully transparent masses', () => {
    expect(getGalleryAtmosphereVisibilityFade(92, 'far')).toBe(1)
    expect(getGalleryAtmosphereVisibilityFade(114, 'far')).toBeCloseTo(0.5)
    expect(getGalleryAtmosphereVisibilityFade(136, 'far')).toBe(0)
    expect(getGalleryAtmosphereVisibilityFade(154, 'nearLow')).toBeCloseTo(0.5)
    expect(getGalleryAtmosphereVisibilityFade(1000, 'far', true)).toBe(1)
    expect(getGalleryAtmosphereVisibilityFade(Number.NaN, 'nearLow')).toBe(0)
  })

  it('places near-low and waterline masses on both sides along the whole route, outside the photo corridor', () => {
    const routeEnd = GALLERY.startZ - GALLERY.travel
    const selected = getGalleryCloudMassesForLayerCounts('standard', cloudLayers)
    const low = getGalleryCloudMassesForLayerCounts('low', cloudLayers)
    const nearPhotoLayers = selected.filter((mass) => mass.layer === 'nearLow' || mass.layer === 'waterline')

    for (const layer of ['nearLow', 'waterline'] as const) {
      const masses = nearPhotoLayers.filter((mass) => mass.layer === layer)
      expect(masses.some((mass) => mass.position[0] < 0)).toBe(true)
      expect(masses.some((mass) => mass.position[0] > 0)).toBe(true)
      expect(Math.max(...masses.map((mass) => mass.position[2]))).toBeGreaterThan(GALLERY.startZ)
      expect(Math.min(...masses.map((mass) => mass.position[2]))).toBeLessThan(routeEnd)
      expect(masses.every((mass) => Math.abs(mass.position[0]) - mass.radii[0] > 5.33)).toBe(true)

      for (const side of [-1, 1]) {
        const sideMasses = masses.filter((mass) => Math.sign(mass.position[0]) === side)
        for (let z = GALLERY.startZ; z >= routeEnd; z -= 3) {
          const gap = Math.min(...sideMasses.map((mass) => Math.max(0, Math.abs(mass.position[2] - z) - getGalleryCloudRadii(mass, cloudLayers[layer])[2])))
          expect(gap, `${layer} ${side < 0 ? 'west' : 'east'} coverage at z=${z}`).toBeLessThanOrEqual(3)
        }
      }

      const lowLayer = low.filter((mass) => mass.layer === layer)
      for (const side of [-1, 1]) {
        const sideMasses = lowLayer.filter((mass) => Math.sign(mass.position[0]) === side)
        expect(sideMasses.length, `${layer} low-quality ${side < 0 ? 'west' : 'east'} masses`).toBeGreaterThanOrEqual(2)
        for (let z = GALLERY.startZ; z >= routeEnd; z -= 3) {
          const gap = Math.min(...sideMasses.map((mass) => Math.max(0, Math.abs(mass.position[2] - z) - getGalleryCloudRadii(mass, cloudLayers[layer], 'low')[2])))
          expect(gap, `${layer} low-quality ${side < 0 ? 'west' : 'east'} coverage at z=${z}`).toBeLessThanOrEqual(layer === 'nearLow' ? 10 : 6)
        }
      }
    }

    const centerSafe = selected.filter((mass) => mass.layer === 'mid' || (mass.layer === 'far' && !mass.moonInteraction))
    expect(centerSafe.every((mass) => Math.abs(mass.position[0]) - mass.radii[0] > 5.33)).toBe(true)

    const waterline = nearPhotoLayers.filter((mass) => mass.layer === 'waterline')
    expect(waterline.every((mass) => mass.position[1] - mass.radii[1] <= GALLERY_WORLD.floor.y)).toBe(true)
    expect(waterline.every((mass) => mass.position[1] + mass.radii[1] > 1.5)).toBe(true)
    expect(waterline.every((mass) => mass.position[1] + mass.radii[1] >= 3.5)).toBe(true)
    expect(nearPhotoLayers.filter((mass) => mass.layer === 'nearLow').every((mass) => mass.position[1] + mass.radii[1] > 4)).toBe(true)
    expect(nearPhotoLayers.filter((mass) => mass.layer === 'nearLow').every((mass) => mass.position[1] + mass.radii[1] >= 5)).toBe(true)
  })

  it('supports live layer height and distance tuning without mutating the shared layout', () => {
    const mass = getGalleryCloudMasses('standard').find((candidate) => candidate.layer === 'nearLow')!
    const adjusted = getGalleryCloudPosition(mass, { ...cloudLayers.nearLow, height: 2.5, distance: 4 })
    const scaled = getGalleryCloudRadii(mass, { ...cloudLayers.nearLow, scale: 1.25 })

    expect(adjusted[0]).toBe(mass.position[0] + Math.sign(mass.position[0]) * 4)
    expect(adjusted[1]).toBe(mass.position[1] + 2.5)
    expect(adjusted[2]).toBe(mass.position[2])
    expect(scaled).toEqual(mass.radii.map((radius) => radius * 1.25))
    expect(mass.position[1]).not.toBe(adjusted[1])
    expect(getGalleryCloudRadii(mass, cloudLayers.nearLow, 'low')[2]).toBeGreaterThan(getGalleryCloudRadii(mass, cloudLayers.nearLow)[2])
  })

  it('draws waterline clouds after the transparent floor while preserving photo depth occlusion', () => {
    expect(getGalleryCloudRenderOrder({ layer: 'far' })).toBe(-3)
    expect(getGalleryCloudRenderOrder({ layer: 'mid' })).toBe(-3)
    expect(getGalleryCloudRenderOrder({ layer: 'nearLow' })).toBe(-0.5)
    expect(getGalleryCloudRenderOrder({ layer: 'waterline' })).toBe(-0.5)
    expect(getGalleryCloudRenderOrder({ layer: 'far', moonInteraction: true })).toBe(1)
  })

  it('keeps moon scattering anchored to the current moon-to-gallery light direction', () => {
    const layers = getGalleryMoonScatteringLayers([3, 18, -120], [5, -1, -30])
    expect(layers).toHaveLength(4)
    layers[0]!.position.forEach((value, index) => expect(value).toBeCloseTo([3.88, 9.64, -80.4][index]!))
    layers[3]!.position.forEach((value, index) => expect(value).toBeCloseTo([4.72, 1.66, -42.6][index]!))
    expect(layers.every(({ size, intensity }) => size > 19 && size < 30 && intensity > 0 && intensity < 0.2)).toBe(true)
  })

  it('keeps a calm deterministic drift and preserves the independent floor haze', () => {
    const mass = getGalleryCloudMasses('standard')[0]!
    expect(getGalleryCloudDrift(mass, 12)).toEqual(getGalleryCloudDrift(mass, 12))
    expect(getGalleryCloudDrift(mass, 12)).not.toEqual(getGalleryCloudDrift(mass, 13))
    expect(Math.hypot(...getGalleryCloudDrift(mass, 12))).toBeLessThan(2)
    expect(getGalleryCloudDrift(mass, Number.NaN)).toEqual([0, 0, 0])
    expect(getGalleryCloudDrift(mass, 12, 0)).toEqual([0, 0, 0])
    expect(getGalleryHazeMasses('standard').length).toBeGreaterThanOrEqual(3)
    expect(getGalleryHazeMasses('low').length).toBeLessThan(getGalleryHazeMasses('standard').length)
    expect(getGalleryHazeMasses('standard').every(({ position, radii }) => position[1] < 1 && radii[1] < 6)).toBe(true)
  })

  it('expands waterline haze across the horizon while keeping it soft and covering the full water plane', () => {
    const haze = GALLERY_WORLD.haze
    const floorY = GALLERY_WORLD.floor.y
    expect(haze[0]!.position[1] - haze[0]!.radii[1]).toBeLessThan(floorY)
    expect(haze.every(({ position, radii, opacity }) => position[1] + radii[1] > 2 && opacity < 0.25)).toBe(true)
    expect(haze[0]!.radii[2]).toBeGreaterThan(17)
  })

  it('smoothly clears the camera from haze volumes across travel, focus, exit, and maximum drift', () => {
    const start = GALLERY.startZ
    const routeEnd = start - GALLERY.travel - 2
    const haze = GALLERY_WORLD.haze
    const routePositions = Array.from({ length: 48 }, (_, index) => [0, 0, start + (routeEnd - start) * index / 47] as const)
    const focusPositions = Array.from({ length: 12 }, (_, order) => {
      const z = GALLERY.firstZ - order * GALLERY.spacing
      return [0, 0.12, z + Math.cos(1.15) * 4.8] as const
    })

    let cameraEntersHaze = false
    for (let time = 0; time <= 48; time += 2) {
      for (const camera of [...routePositions, ...focusPositions]) {
        for (const mass of haze) {
          const drift = getGalleryCloudDrift(mass, time, 3 * 2.5, 0.35)
          const center = [mass.position[0] + drift[0], mass.position[1] + drift[1], mass.position[2] + drift[2]] as const
          const fade = getGalleryHazeCameraFade(camera, center, mass.radii)
          const normalizedDistance = Math.hypot((camera[0] - center[0]) / mass.radii[0], (camera[1] - center[1]) / mass.radii[1], (camera[2] - center[2]) / mass.radii[2])
          if (normalizedDistance <= 1) {
            cameraEntersHaze = true
            expect(fade, `${mass.id} contains camera at ${camera.join(',')} time=${time}`).toBe(0)
          }
          expect(fade).toBeGreaterThanOrEqual(0)
          expect(fade).toBeLessThanOrEqual(1)
        }
      }
    }
    expect(cameraEntersHaze).toBe(true)

    const sample = haze[0]!
    const center = sample.position
    const justOutside = [center[0], center[1], center[2] + sample.radii[2] + 4] as const
    expect(getGalleryHazeCameraFade(justOutside, center, sample.radii)).toBeGreaterThan(0)
    expect(getGalleryHazeCameraFade(justOutside, center, sample.radii)).toBeLessThan(1)
    expect(getGalleryHazeCameraFade([center[0], center[1], center[2] + sample.radii[2] + 12], center, sample.radii)).toBe(1)
  })

  it('keeps a continuous haze contribution on the water horizon after camera-proximity fades', () => {
    const start = GALLERY.startZ
    const routeEnd = start - GALLERY.travel - 2
    const routePositions = Array.from({ length: 48 }, (_, index) => [0, 0, start + (routeEnd - start) * index / 47] as const)
    const focusPositions = Array.from({ length: 12 }, (_, order) => [0, 0.12, GALLERY.firstZ - order * GALLERY.spacing + Math.cos(1.15) * 4.8] as const)
    const horizonSamples = Array.from({ length: 21 }, (_, index) => -108 - index * 2)
    const hazeDensity = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery.hazeDensity
    let minimumCoverage = Number.POSITIVE_INFINITY

    for (const quality of ['low', 'standard'] as const) {
      const haze = getGalleryHazeMasses(quality)
      for (let time = 0; time <= 48; time += 2) {
        for (const camera of [...routePositions, ...focusPositions]) {
          const centers = haze.map((mass) => {
            const drift = getGalleryCloudDrift(mass, time, 3 * 2.5, 0.35)
            return {
              mass,
              center: [mass.position[0] + drift[0], mass.position[1] + drift[1], mass.position[2] + drift[2]] as const,
            }
          })

          for (const z of horizonSamples) {
            const horizonPoint = [0, GALLERY_WORLD.floor.y, z] as const
            const coverage = centers.reduce((sum, { mass, center }) => {
              const cameraFade = getGalleryHazeCameraFade(camera, center, mass.radii)
              const cameraDistance = Math.hypot(camera[0] - center[0], camera[1] - center[1], camera[2] - center[2])
              const distanceFade = getGalleryAtmosphereVisibilityFade(cameraDistance, 'haze')
              const localRadius = Math.hypot((horizonPoint[0] - center[0]) / mass.radii[0], (horizonPoint[1] - center[1]) / mass.radii[1], (horizonPoint[2] - center[2]) / mass.radii[2])
              const edgeT = Math.max(0, Math.min(1, (localRadius - 0.5) / 0.5))
              const edgeFade = 1 - edgeT * edgeT * (3 - 2 * edgeT)
              return sum + mass.opacity * hazeDensity * cameraFade * distanceFade * edgeFade
            }, 0)
            minimumCoverage = Math.min(minimumCoverage, coverage)
          }
        }
      }
    }

    expect(minimumCoverage).toBeGreaterThan(0.003)
  })

  it('supports faster drift while preserving zero as a deliberate stop', () => {
    const mass = getGalleryCloudMasses('standard')[0]!
    expect(getGalleryCloudDrift(mass, 12, 0)).toEqual([0, 0, 0])
    expect(getGalleryCloudDrift(mass, 12, 3)).not.toEqual(getGalleryCloudDrift(mass, 12, 2))
    expect(Math.hypot(...getGalleryCloudDrift(mass, 12, 3))).toBeLessThan(2)
  })
})
