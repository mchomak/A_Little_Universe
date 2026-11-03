import { BackSide, NormalBlending, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { getConfig } from '../../systems/scene-config/config'
import { getGrowthFrames, getSeedFallDistance } from './seedProcedure'
import {
  createGrowthCloudVolumeMaterial,
  getGrowthCloudDrift,
  getGrowthCloudMasses,
  getGrowthCloudMotionTime,
  getGrowthCloudVisibility,
  setGrowthCloudMoonPosition,
} from './growthCloudMath'

describe('Scene 02 independent clouds', () => {
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
    expect(fullField.some(({ position }) => position[1] < -1.45)).toBe(true)
    expect(fullField.filter(({ pathCrossing }) => pathCrossing).length).toBeGreaterThanOrEqual(8)
    expect(defaultField.filter(({ pathCrossing }) => pathCrossing).length).toBeGreaterThanOrEqual(6)
    expect(defaultField.filter(({ persistent }) => persistent).length).toBeGreaterThanOrEqual(3)
    expect(defaultField.every(({ position, radii }) => position[1] + radii[1] < initialViewportBottom)).toBe(true)
    expect(masses.filter(({ pathCrossing }) => pathCrossing).every(({ position, radii }) =>
      (position[0] / radii[0]) ** 2 + (position[2] / radii[2]) ** 2 < 1,
    )).toBe(true)
    expect(fullField.filter(({ pathCrossing }) => !pathCrossing)
      .every(({ position, radii }) => Math.abs(position[0]) - radii[0] > 0.18)).toBe(true)
    expect(new Set(fullField.map(({ position }) => position[0].toFixed(2))).size).toBeGreaterThan(20)
    expect(new Set(fullField.map(({ radii }) => radii[0].toFixed(2))).size).toBeGreaterThan(18)
    expect(Math.max(...maxDistanceField.map(({ position }) => position[1])))
      .toBeGreaterThan(Math.max(...defaultField.map(({ position }) => position[1])) + 3)
    expect(maxDistanceField.every(({ position, radii }) => position[1] + radii[1]
      < 15.3 - flight.viewportHeight / 2)).toBe(true)
    expect(minimumDistanceField.every(({ position, radii }) => position[1] + radii[1]
      < minimumFallDistance - flight.viewportHeight / 2)).toBe(true)
    expect(minimumDistanceField.filter(({ pathCrossing }) => pathCrossing).length).toBeGreaterThan(0)
    expect(minimumDistanceField.filter(({ pathCrossing }) => pathCrossing).every(({ position }) =>
      position[1] > 0 && position[1] < minimumFallDistance * 0.5,
    )).toBe(true)
    expect(reducedMotionField.filter(({ pathCrossing }) => pathCrossing)).toHaveLength(0)
    expect(reducedMotionField.every(({ position, radii }) => position[1] + radii[1]
      < getSeedFallDistance(flight.viewportHeight) - flight.viewportHeight / 2)).toBe(true)
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
    expect(Math.max(...deepField.map(({ position }) => Math.abs(position[2]))))
      .toBeGreaterThan(Math.max(...shallowField.map(({ position }) => Math.abs(position[2]))))
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
    expect(getGrowthCloudMasses(99, 2)).toHaveLength(24)
    expect(getGrowthCloudMasses(-2, 1)).toHaveLength(0)
    for (const scale of [0.4, 1, 2]) {
      const masses = getGrowthCloudMasses(24, scale)
      expect(masses.filter(({ pathCrossing }) => !pathCrossing)
        .every(({ position, radii }) => Math.abs(position[0]) - radii[0] > 0.18)).toBe(true)
    }
    expect(getGrowthCloudMasses(1, Number.NaN)[0]!.radii[0]).toBeCloseTo(getGrowthCloudMasses(1, 1)[0]!.radii[0])
  })

  it('keeps clouds at full strength from the opening and fades them only for the scene handoff', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const fallStart = frames.fall[0]
    const opacity = getGrowthCloudVisibility(fallStart + 0.2, frames, 0.42, 1)

    expect(getGrowthCloudVisibility(0, frames, 0.42, 1)).toBe(0.42)
    expect(opacity).toBe(0.42)
    expect(getGrowthCloudVisibility(frames.handoff[0] + 0.05, frames, 0.42, 1)).toBe(0.42)
    expect(getGrowthCloudVisibility(frames.handoff[1] - 0.2, frames, 0.42, 1)).toBeLessThan(0.42)
    expect(getGrowthCloudVisibility(frames.handoff[1], frames, 0.42, 1)).toBe(0)
    expect(getGrowthCloudVisibility(0.5, frames, 0.42, 0)).toBe(0)
    expect(getGrowthCloudVisibility(0.5, frames, 0, 1)).toBe(0)
    expect(getGrowthCloudVisibility(Number.NaN, frames, 0.42, 1)).toBe(0)
    expect(getGrowthCloudVisibility(0.5, frames, 0.42, 0.5))
      .toBeCloseTo(getGrowthCloudVisibility(0.5, frames, 0.42, 1) * 0.5)
  })

  it('keeps only the sparse far island clouds through lily growth, then fades them before the next scene', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const handoffEnd = frames.handoff[1]

    expect(getGrowthCloudVisibility(handoffEnd + 0.4, frames, 0.42, 1)).toBe(0)
    expect(getGrowthCloudVisibility(handoffEnd + 0.4, frames, 0.42, 1, true)).toBeGreaterThan(0)
    expect(getGrowthCloudVisibility(frames.duration - 0.45, frames, 0.42, 1, true)).toBeGreaterThan(0)
    expect(getGrowthCloudVisibility(frames.duration, frames, 0.42, 1, true)).toBe(0)
    expect(getGrowthCloudVisibility(handoffEnd + 0.4, frames, 0.42, 0.5, true))
      .toBeCloseTo(getGrowthCloudVisibility(handoffEnd + 0.4, frames, 0.42, 1, true) * 0.5)
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

  it('keeps moon scattering aligned with the centered vertical source', () => {
    const target = new Vector3()
    setGrowthCloudMoonPosition(target, new Vector3(-2, -1.45, 3), 5.5)
    expect(target.toArray()).toEqual([-2, 4.05, 3])
    setGrowthCloudMoonPosition(target, new Vector3(0, 0, 0), Number.NaN)
    expect(target.toArray()).toEqual([0, 5.5, 0])
  })

  it('creates a soft silver ellipsoid volume with bounded raymarch cost', () => {
    const material = createGrowthCloudVolumeMaterial({ seed: 2 })

    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(material.depthTest).toBe(true)
    expect(material.side).toBe(BackSide)
    expect(material.blending).toBe(NormalBlending)
    expect(material.defines?.CLOUD_STEPS).toBe(12)
    expect(material.uniforms.uMoonPosition!.value.toArray()).toEqual([0, 5.5, 0])
    expect(material.uniforms.uShapeVariation!.value).toBe(0.65)
    expect(material.fragmentShader).toContain('float discriminant = b * b - a * c')
    expect(material.fragmentShader).toContain('float cloudDensity = cloudBody * erosion')
    expect(material.fragmentShader).toContain('float lobeD =')
    expect(material.fragmentShader).toContain('sampleColor += silverBlue * silverRim')
    expect(material.fragmentShader).toContain('float erosion = 0.25 + coverage * 0.75')
    expect(material.fragmentShader).toContain('uMoonPosition')
    expect(material.fragmentShader).toContain('uLightIntensity')
    expect(material.fragmentShader).toContain('float shapeX = sin(uSeed * 0.19) * 0.15 * uShapeVariation')
    expect(material.fragmentShader).toContain('transmittance *= 1.0 - sampleAlpha')
    material.dispose()
  })
})
