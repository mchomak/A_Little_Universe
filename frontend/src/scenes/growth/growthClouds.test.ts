import { BackSide, NormalBlending, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { getConfig } from '../../systems/scene-config/config'
import { getGrowthCameraPose, getGrowthFrames, getGrowthViewportHeight, getSeedFallDistance, SEED_ROOT } from './seedProcedure'
import {
  createGrowthCloudVolumeMaterial,
  getGrowthCloudDrift,
  getGrowthCloudLunarLight,
  getGrowthCloudMasses,
  getGrowthCloudMotionTime,
  getGrowthCloudVisibility,
  setGrowthCloudMoonPosition,
} from './growthCloudMath'

describe('Scene 02 independent clouds', () => {
  it('frames a side cloud during early fall with the saved long-fall configuration', () => {
    const settings = {
      ...getConfig().scenes.growth,
      formationDuration: 3.5, seedFallDuration: 8, seedFallAcceleration: 5, seedFallHeight: 6.4,
      seedCameraLag: 0.15, seedCameraFollowSpeed: 3, cloudCount: 18, cloudScale: 1,
      cloudSizeVariation: 0.72, cloudPathDensity: 0.65, cloudDepthVariation: 0.65,
    }
    const viewportHeight = getGrowthViewportHeight(1280, 720)
    const camera = getGrowthCameraPose(7.47, false, settings, viewportHeight)
    const masses = getGrowthCloudMasses(settings.cloudCount, settings.cloudScale, {
      fallDistance: getSeedFallDistance(viewportHeight) * settings.seedFallHeight,
      viewportHeight, sizeVariation: settings.cloudSizeVariation,
      pathDensity: settings.cloudPathDensity, depthVariation: settings.cloudDepthVariation,
    })
    const visibleSide = masses.some((mass) => {
      if (mass.pathCrossing || mass.position[2] <= 0) return false
      const halfHeight = (camera.z - mass.position[2]) * Math.tan(19 * Math.PI / 180)
      const halfWidth = halfHeight * 1280 / 720
      const worldY = mass.position[1] + SEED_ROOT[1]
      return Math.abs(mass.position[0] - camera.x) < halfWidth + mass.radii[0] * 0.5
        && worldY + mass.radii[1] * 0.5 > camera.y - halfHeight
        && worldY - mass.radii[1] < camera.y + halfHeight
    })
    expect(visibleSide).toBe(true)
  })
  it('keeps a near cloud mass in the camera frame around the middle of the falling seed', () => {
    const settings = getConfig().scenes.growth
    const viewportHeight = getGrowthViewportHeight(1280, 720)
    const camera = getGrowthCameraPose(7.76, false, settings, viewportHeight)
    const masses = getGrowthCloudMasses(settings.cloudCount, settings.cloudScale, {
      fallDistance: getSeedFallDistance(viewportHeight) * settings.seedFallHeight,
      viewportHeight, sizeVariation: settings.cloudSizeVariation,
      pathDensity: settings.cloudPathDensity, depthVariation: settings.cloudDepthVariation,
    })
    const visibleNearBank = masses.some((mass) => {
      if (mass.pathCrossing || mass.position[2] <= 0) return false
      const halfHeight = (camera.z - mass.position[2]) * Math.tan(19 * Math.PI / 180)
      return mass.position[1] + SEED_ROOT[1] + mass.radii[1] * 0.75 > camera.y - halfHeight
        && mass.position[1] + SEED_ROOT[1] - mass.radii[1] < camera.y + halfHeight
    })
    expect(visibleNearBank).toBe(true)
  })
  it('keeps directional cloud illumination off until the impact cue and rewinds it with the scene', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const sample = (time: number) => getGrowthCloudLunarLight(time, frames, 0.7, 1.2, 1)
    expect(sample(frames.fall[1] - 0.01)).toBe(0)
    expect(sample(frames.fall[1])).toBe(0)
    expect(sample((frames.moonlight[0] + frames.moonlight[1]) / 2)).toBeCloseTo(0.42)
    expect(sample(frames.moonlight[1])).toBeCloseTo(0.84)
    expect(sample(frames.fall[0])).toBe(0)
    expect(getGrowthCloudLunarLight(frames.moonlight[1], frames, 0.7, 0, 1)).toBe(0)
  })
  it('defaults to a denser set of soft layers that leave the flower center open', () => {
    const settings = getConfig().scenes.growth
    const field = getGrowthCloudMasses(settings.cloudCount, settings.cloudScale, {
      depthVariation: settings.cloudDepthVariation,
    })
    const persistent = field.filter(({ persistent }) => persistent)
    const depthRange = Math.max(...persistent.map(({ position }) => position[2]))
      - Math.min(...persistent.map(({ position }) => position[2]))

    expect(settings).toMatchObject({
      cloudCount: 24, cloudDensity: 0.9, cloudOpacity: 0.48, cloudDriftSpeed: 0.28,
      cloudShapeVariation: 0.72, cloudDepthVariation: 0.8,
    })
    expect(field).toHaveLength(24)
    expect(persistent).toHaveLength(12)
    expect(depthRange).toBeGreaterThan(1.5)
    expect(field.filter(({ pathCrossing, persistent }) => !pathCrossing && !persistent).every(({ position, radii }) =>
      Math.abs(position[0]) - radii[0] > 0.18,
    )).toBe(true)
    const settledGroups = persistent.filter(({ cloudLayer }) => cloudLayer)
    expect(settledGroups).toHaveLength(12)
    expect(settledGroups.every(({ position }) => position[1] > -1.6)).toBe(true)
  })

  it('places the settled cloud groups around the island and tunes each group independently', () => {
    const settings = getConfig().scenes.growth
    const options = { sizeVariation: 0, lightVariation: 0, depthVariation: 0, cloudLayers: settings.cloudLayers }
    const field = getGrowthCloudMasses(settings.cloudCount, settings.cloudScale, options)
    const settled = field.filter((mass) => mass.cloudLayer)
    const far = settled.filter((mass) => mass.cloudLayer === 'far')
    const sides = settled.filter((mass) => mass.cloudLayer === 'sides')
    const foreground = settled.filter((mass) => mass.cloudLayer === 'foreground')

    expect([far, sides, foreground].map((group) => group.length)).toEqual([4, 4, 4])
    expect(far.every((mass) => mass.position[2] <= -8 && mass.position[1] > -1.6 && mass.raySteps === 5)).toBe(true)
    expect(sides.map((mass) => Math.sign(mass.position[0])).sort()).toEqual([-1, -1, 1, 1])
    expect(sides.every((mass) => Math.abs(mass.position[0]) >= 4 && mass.position[1] > -1.4)).toBe(true)
    expect(foreground.every((mass) => mass.position[2] >= 2 && mass.radii[0] >= 2.2)).toBe(true)

    const adjustedLayers = {
      ...settings.cloudLayers,
      far: { ...settings.cloudLayers.far, count: 0 },
      foreground: { ...settings.cloudLayers.foreground, count: 1, offsetX: 3, height: 1.25, depth: 4, distance: 1.2, scale: 0.75 },
    }
    const adjusted = getGrowthCloudMasses(settings.cloudCount, settings.cloudScale, { ...options, cloudLayers: adjustedLayers })
    const adjustedForeground = adjusted.filter((mass) => mass.cloudLayer === 'foreground')
    expect(adjusted.filter((mass) => mass.cloudLayer === 'far')).toHaveLength(0)
    expect(adjustedForeground).toHaveLength(1)
    const defaultMatchingMass = foreground.find((mass) => mass.id === adjustedForeground[0]!.id)!
    expect(adjustedForeground[0]!.position[0] - defaultMatchingMass.position[0]).toBeCloseTo(4)
    expect(adjustedForeground[0]!.position[1] - defaultMatchingMass.position[1]).toBeCloseTo(1.35)
    expect(adjustedForeground[0]!.position[2]).toBeGreaterThan(defaultMatchingMass.position[2])
    expect(adjustedForeground[0]!.radii[0]).toBeLessThan(foreground[0]!.radii[0])
  })

  it('builds a layered deterministic set outside the flower center', () => {
    const flight = { fallDistance: 7.65, viewportHeight: 3.856, sizeVariation: 0.72, lightVariation: 0.55, pathDensity: 0.65 }
    const masses = getGrowthCloudMasses(4, 1, flight)
    const mainClouds = getGrowthCloudMasses(3, 1, flight)
    const fullField = getGrowthCloudMasses(24, 1, flight)
    const defaultField = getGrowthCloudMasses(18, 1, flight)
    const maxDistanceField = getGrowthCloudMasses(18, 1, { ...flight, fallDistance: 15.3 })
    const minimumFallDistance = getSeedFallDistance(flight.viewportHeight) * 2
    const minimumDistanceField = getGrowthCloudMasses(24, 2, {
      ...flight, fallDistance: minimumFallDistance, sizeVariation: 1, pathDensity: 1,
    })
    const reducedMotionField = getGrowthCloudMasses(24, 1, {
      ...flight, fallDistance: getSeedFallDistance(flight.viewportHeight), pathDensity: 0,
    })
    const verticalSpan = Math.max(...fullField.map(({ position }) => position[1]))
      - Math.min(...fullField.map(({ position }) => position[1]))
    const initialViewportBottom = flight.fallDistance - flight.viewportHeight / 2

    expect(masses).toHaveLength(4)
    expect(verticalSpan).toBeGreaterThan(4)
    expect(mainClouds).toHaveLength(3)
    expect(new Set(fullField.map(({ position }) => position[2] < 0 ? 'background' : 'foreground')).size).toBe(2)
    expect(fullField.every(({ position }) => position[1] > -1.45)).toBe(true)
    expect(fullField.filter(({ pathCrossing }) => pathCrossing).length).toBeGreaterThanOrEqual(8)
    expect(defaultField.filter(({ pathCrossing }) => pathCrossing).length).toBeGreaterThanOrEqual(6)
    expect(defaultField.filter(({ persistent }) => persistent).length).toBeGreaterThanOrEqual(3)
    expect(defaultField.filter(({ pathCrossing }) => pathCrossing)
      .every(({ position, radii }) => position[1] + radii[1] < initialViewportBottom)).toBe(true)
    expect(masses.filter(({ pathCrossing }) => pathCrossing).every(({ position, radii }) =>
      (position[0] / radii[0]) ** 2 + (position[2] / radii[2]) ** 2 < 1,
    )).toBe(true)
    expect(fullField.filter(({ pathCrossing, persistent }) => !pathCrossing && !persistent)
      .every(({ position, radii }) => Math.abs(position[0]) - radii[0] > 0.18)).toBe(true)
    expect(new Set(fullField.map(({ position }) => position[0].toFixed(2))).size).toBeGreaterThan(20)
    expect(new Set(fullField.map(({ radii }) => radii[0].toFixed(2))).size).toBeGreaterThan(18)
    expect(Math.max(...maxDistanceField.map(({ position }) => position[1])))
      .toBeGreaterThan(Math.max(...defaultField.map(({ position }) => position[1])) + 3)
    expect(maxDistanceField.filter(({ pathCrossing }) => pathCrossing).every(({ position, radii }) => position[1] + radii[1]
      < 15.3 - flight.viewportHeight / 2)).toBe(true)
    expect(minimumDistanceField.filter(({ cloudLayer }) => !cloudLayer).every(({ position, radii }) => position[1] + radii[1]
      < minimumFallDistance - flight.viewportHeight / 2)).toBe(true)
    expect(minimumDistanceField.filter(({ pathCrossing }) => pathCrossing).length).toBeGreaterThan(0)
    expect(minimumDistanceField.filter(({ pathCrossing }) => pathCrossing).every(({ position }) =>
      position[1] > 0 && position[1] < minimumFallDistance * 0.5,
    )).toBe(true)
    expect(reducedMotionField.filter(({ pathCrossing }) => pathCrossing)).toHaveLength(0)
    expect(reducedMotionField.filter(({ persistent }) => persistent)
      .every(({ position }) => position[1] > -1.45)).toBe(true)
    expect(getGrowthCloudMasses(4, 1, flight)).toEqual(masses)
    expect(getGrowthCloudMasses(0, 1)).toEqual([])
  })

  it('uses the three diversity controls to change placement, volume sizes, and cloud lighting', () => {
    const options = { fallDistance: 7.65, viewportHeight: 3.856, sizeVariation: 0, lightVariation: 0, pathDensity: 0 }
    const uniformField = getGrowthCloudMasses(18, 1, options)
    const variedField = getGrowthCloudMasses(18, 1, { ...options, sizeVariation: 1, lightVariation: 1, pathDensity: 1 })
    const shallowField = getGrowthCloudMasses(18, 1, { ...options, depthVariation: 0 })
    const deepField = getGrowthCloudMasses(18, 1, { ...options, depthVariation: 1 })
    const uniformById = new Map(uniformField.map((mass) => [mass.id, mass]))

    expect(uniformField.some(({ pathCrossing }) => pathCrossing)).toBe(false)
    expect(variedField.filter(({ pathCrossing }) => pathCrossing)).toHaveLength(8)
    expect(uniformField.every(({ lightScale }) => lightScale === 1)).toBe(true)
    expect(new Set(variedField.map(({ lightScale }) => lightScale.toFixed(2))).size).toBeGreaterThan(10)
    expect(variedField.some(({ id, radii }) => {
      const baseline = uniformById.get(id)!.radii
      return radii.some((radius, axis) => Math.abs(radius - baseline[axis]!) > 0.01)
    })).toBe(true)
    expect(Math.max(...deepField.filter(({ cloudLayer }) => !cloudLayer).map(({ position }) => Math.abs(position[2]))))
      .toBeGreaterThan(Math.max(...shallowField.filter(({ cloudLayer }) => !cloudLayer).map(({ position }) => Math.abs(position[2]))))
  })

  it('honors path density when only one cloud is requested', () => {
    const base = { fallDistance: 7.65, viewportHeight: 3.856, sizeVariation: 0.72 }
    const backgroundOnly = getGrowthCloudMasses(1, 1, { ...base, pathDensity: 0 })
    const pathFocused = getGrowthCloudMasses(1, 1, { ...base, pathDensity: 0.8 })

    expect(backgroundOnly).toHaveLength(1)
    expect(backgroundOnly[0]!.pathCrossing).not.toBe(true)
    expect(pathFocused).toHaveLength(1)
    expect(pathFocused[0]!.pathCrossing).toBe(true)
  })

  it('bounds count and scale without allowing dense clouds to cover the center', () => {
    expect(getGrowthCloudMasses(99, 2)).toHaveLength(30)
    expect(getGrowthCloudMasses(-2, 1)).toHaveLength(0)
    for (const scale of [0.4, 1, 2]) {
      const masses = getGrowthCloudMasses(24, scale)
      expect(masses.filter(({ pathCrossing, persistent }) => !pathCrossing && !persistent)
        .every(({ position, radii }) => Math.abs(position[0]) - radii[0] > 0.18)).toBe(true)
    }
    expect(getGrowthCloudMasses(1, Number.NaN)[0]!.radii[0]).toBeCloseTo(getGrowthCloudMasses(1, 1)[0]!.radii[0])
  })

  it('reveals clouds over normalized fall progress and fades transient clouds for the scene handoff', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const atProgress = (progress: number) => frames.fall[0] + (frames.fall[1] - frames.fall[0]) * progress

    expect(getGrowthCloudVisibility(atProgress(0.2), frames, 0.42, 1)).toBe(0)
    expect(getGrowthCloudVisibility(atProgress(0.4), frames, 0.42, 1)).toBe(0)
    expect(getGrowthCloudVisibility(atProgress(0.55), frames, 0.42, 1)).toBeCloseTo(0.21)
    expect(getGrowthCloudVisibility(atProgress(0.75), frames, 0.42, 1)).toBe(0.42)
    expect(getGrowthCloudVisibility(atProgress(1), frames, 0.42, 1)).toBe(0.42)
    expect(getGrowthCloudVisibility(frames.handoff[0] + 0.05, frames, 0.42, 1)).toBe(0.42)
    expect(getGrowthCloudVisibility(frames.handoff[1] - 0.2, frames, 0.42, 1)).toBeLessThan(0.42)
    expect(getGrowthCloudVisibility(frames.handoff[1], frames, 0.42, 1)).toBe(0)
    expect(getGrowthCloudVisibility(0.5, frames, 0.42, 0)).toBe(0)
    expect(getGrowthCloudVisibility(0.5, frames, 0, 1)).toBe(0)
    expect(getGrowthCloudVisibility(Number.NaN, frames, 0.42, 1)).toBe(0)
    expect(getGrowthCloudVisibility(0.5, frames, 0.42, 0.5))
      .toBeCloseTo(getGrowthCloudVisibility(0.5, frames, 0.42, 1) * 0.5)
  })

  it('limits each path wisp to a short approach and pass around its world-space crossing', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const atTimelineFraction = (fraction: number) => frames.fall[0] + (frames.fall[1] - frames.fall[0]) * fraction
    const visibility = (fraction: number) => getGrowthCloudVisibility(
      atTimelineFraction(fraction), frames, 0.42, 1, false, false, 0.64,
    )

    expect(visibility(0.5)).toBe(0)
    expect(visibility(0.594)).toBeGreaterThan(0.4)
    expect(visibility(0.8)).toBe(0)
  })

  it('keeps only the sparse far island clouds through growth and lets the environment own their handoff fade', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const handoffEnd = frames.handoff[1]

    expect(getGrowthCloudVisibility(handoffEnd + 0.4, frames, 0.42, 1)).toBe(0)
    expect(getGrowthCloudVisibility(handoffEnd + 0.4, frames, 0.42, 1, true)).toBeGreaterThan(0)
    expect(getGrowthCloudVisibility(frames.duration - 0.45, frames, 0.42, 1, true)).toBeGreaterThan(0)
    expect(getGrowthCloudVisibility(frames.duration, frames, 0.42, 1, true)).toBe(0.42)
    expect(getGrowthCloudVisibility(frames.duration, frames, 0.42, 0, true)).toBe(0)
    expect(getGrowthCloudVisibility(handoffEnd + 0.4, frames, 0.42, 0.5, true))
      .toBeCloseTo(getGrowthCloudVisibility(handoffEnd + 0.4, frames, 0.42, 1, true) * 0.5)
  })

  it('uses an established night for direct entry and restores the fall reveal after reset', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)

    expect(getGrowthCloudVisibility(0, frames, 0.42, 1, true, false, undefined, true)).toBe(0.42)
    expect(getGrowthCloudVisibility(0, frames, 0.42, 1, true, false, undefined, false)).toBe(0)
    expect(getGrowthCloudVisibility(0, frames, 0.42, 0.5, true, false, undefined, true)).toBe(0.21)
    expect(getGrowthCloudVisibility(0, frames, 0.42, 1, false, false, undefined, true)).toBe(0)
  })

  it('introduces only persistent background clouds after the midpoint in reduced motion', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const midpoint = (frames.fall[0] + frames.fall[1]) / 2
    const revealEnd = Math.min(frames.handoff[0], frames.fall[1] + 0.45)

    expect(getGrowthCloudVisibility(0, frames, 0.42, 1, true, true)).toBe(0)
    expect(getGrowthCloudVisibility(midpoint, frames, 0.42, 1, true, true)).toBe(0)
    expect(getGrowthCloudVisibility(midpoint + 0.1, frames, 0.42, 1, true, true)).toBeGreaterThan(0)
    expect(getGrowthCloudVisibility(revealEnd, frames, 0.42, 1, true, true)).toBe(0.42)
    expect(getGrowthCloudVisibility(revealEnd, frames, 0.42, 1, false, true)).toBe(0)
    expect(getGrowthCloudVisibility(frames.handoff[1] + 0.4, frames, 0.42, 1, true, true)).toBeGreaterThan(0)
  })

  it('uses absolute time for bounded cloud drift and stops it at zero speed', () => {
    const mass = getGrowthCloudMasses(1, 1)[0]!
    const first = getGrowthCloudDrift(mass, 8, 0.3)

    expect(getGrowthCloudDrift(mass, 8, 0.3)).toEqual(first)
    expect(getGrowthCloudDrift(mass, 8, 0)).toEqual([0, 0, 0])
    expect(getGrowthCloudDrift(mass, Number.NaN, 0.3)).toEqual([0, 0, 0])
    expect(Math.hypot(...first)).toBeLessThan(0.15)
    expect(getGrowthCloudDrift(mass, 9, 0.3)).not.toEqual(first)
    expect(getGrowthCloudMotionTime(9, false)).toBe(9)
    expect(getGrowthCloudMotionTime(9, true)).toBe(0)
    expect(getGrowthCloudMotionTime(Number.NaN, false)).toBe(0)
  })

  it('holds the settled cloud sea at one world-space pose across the growth-to-bloom seam', () => {
    const seaMass = getGrowthCloudMasses(24, 1).find(({ cloudLayer }) => cloudLayer === 'sides')!

    expect(getGrowthCloudDrift(seaMass, 8, 0.3)).toEqual([0, 0, 0])
  })

  it('keeps moon scattering aligned with the centered vertical source', () => {
    const target = new Vector3()
    setGrowthCloudMoonPosition(target, new Vector3(-2, -1.45, 3), 5.5)
    expect(target.toArray()).toEqual([-2, 4.05, 3])
    setGrowthCloudMoonPosition(target, new Vector3(0, 0, 0), Number.NaN)
    expect(target.toArray()).toEqual([0, 5.5, 0])
  })

  it('creates a soft silver ellipsoid volume with bounded raymarch cost', () => {
    const material = createGrowthCloudVolumeMaterial({ seed: 2 })
    const distantMaterial = createGrowthCloudVolumeMaterial({ seed: 3, raySteps: 5 })

    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(material.depthTest).toBe(true)
    expect(material.side).toBe(BackSide)
    expect(material.blending).toBe(NormalBlending)
    expect(material.defines?.CLOUD_STEPS).toBe(12)
    expect(distantMaterial.defines?.CLOUD_STEPS).toBe(5)
    expect(material.uniforms.uMoonPosition!.value.toArray()).toEqual([0, 5.5, 0])
    expect(material.uniforms.uShapeVariation!.value).toBe(0.65)
    expect(material.uniforms.uSeaEdgeFade!.value).toBe(0)
    expect(material.fragmentShader).toContain('float discriminant = b * b - a * c')
    expect(material.fragmentShader).toContain('float cloudDensity = cloudBody * erosion')
    expect(material.fragmentShader).toContain('float lobeD =')
    expect(material.fragmentShader).toContain('sampleColor += silverBlue * silverRim')
    expect(material.fragmentShader).toContain('vec3 midnightBlue = vec3(0.085, 0.12, 0.2) * innerShade')
    expect(material.fragmentShader).toContain('vec3 silverBlue = mix(vec3(0.38, 0.49, 0.68), uMoonColor, 0.45)')
    expect(material.fragmentShader).toContain('float erosion = 0.25 + coverage * 0.75')
    expect(material.fragmentShader).toContain('uMoonPosition')
    expect(material.fragmentShader).toContain('uLightIntensity')
    expect(material.fragmentShader).toContain('cloudDensity *= mix(1.0, seaEdgeFade, uSeaEdgeFade)')
    expect(material.fragmentShader).toContain('float shapeX = sin(uSeed * 0.19) * 0.15 * uShapeVariation')
    expect(material.fragmentShader).toContain('transmittance *= 1.0 - sampleAlpha')
    material.dispose()
  })
})
