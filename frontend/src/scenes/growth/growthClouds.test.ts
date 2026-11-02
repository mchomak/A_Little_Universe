import { BackSide, NormalBlending, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { getConfig } from '../../systems/scene-config/config'
import { getGrowthFrames } from './seedProcedure'
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
    const masses = getGrowthCloudMasses(4, 1)
    const mainClouds = getGrowthCloudMasses(3, 1)
    const fullField = getGrowthCloudMasses(24, 1)
    const defaultField = getGrowthCloudMasses(18, 1)
    const verticalSpan = Math.max(...fullField.map(({ position }) => position[1]))
      - Math.min(...fullField.map(({ position }) => position[1]))

    expect(masses).toHaveLength(4)
    expect(verticalSpan).toBeGreaterThan(7.5)
    expect(mainClouds.every(({ radii }) => radii[1] >= 0.58)).toBe(true)
    expect(new Set(fullField.map(({ position }) => position[2] < 0 ? 'background' : 'foreground')).size).toBe(2)
    expect(fullField.some(({ position }) => position[1] < -1.45)).toBe(true)
    expect(fullField.some(({ position }) => position[1] > 1.7)).toBe(true)
    expect(masses.every(({ pathCrossing, densityScale }) => pathCrossing && densityScale! < 0.35)).toBe(true)
    expect(masses.every(({ position, radii }) => (position[0] / radii[0]) ** 2 + (position[2] / radii[2]) ** 2 < 1)).toBe(true)
    expect(defaultField.filter(({ pathCrossing }) => pathCrossing)).toHaveLength(4)
    expect(defaultField.filter(({ persistent }) => persistent)).toHaveLength(4)
    expect(fullField.filter(({ pathCrossing }) => pathCrossing)).toHaveLength(4)
    expect(fullField.filter(({ pathCrossing }) => !pathCrossing)
      .every(({ position, radii }) => Math.abs(position[0]) - radii[0] > 0.2)).toBe(true)
    expect(new Set(fullField.map(({ position }) => position[0].toFixed(2))).size).toBeGreaterThan(20)
    expect(new Set(fullField.map(({ radii }) => radii[0].toFixed(2))).size).toBeGreaterThan(18)
    expect(getGrowthCloudMasses(4, 1)).toEqual(masses)
    expect(getGrowthCloudMasses(0, 1)).toEqual([])
  })

  it('bounds count and scale without allowing dense clouds to cover the center', () => {
    expect(getGrowthCloudMasses(99, 2)).toHaveLength(24)
    expect(getGrowthCloudMasses(-2, 1)).toHaveLength(0)
    for (const scale of [0.4, 1, 2]) {
      const masses = getGrowthCloudMasses(24, scale)
      expect(masses.filter(({ pathCrossing }) => !pathCrossing)
        .every(({ position, radii }) => Math.abs(position[0]) - radii[0] > 0.2)).toBe(true)
      expect(masses.filter(({ pathCrossing, densityScale }) => pathCrossing && densityScale! <= 0.32)).toHaveLength(4)
    }
    expect(getGrowthCloudMasses(1, Number.NaN)[0]!.radii[0]).toBeCloseTo(getGrowthCloudMasses(1, 1)[0]!.radii[0])
  })

  it('reveals from the start of seed fall before island reveal and fades by handoff', () => {
    const frames = getGrowthFrames(getConfig().scenes.growth)
    const fallStart = frames.fall[0]
    const opacity = getGrowthCloudVisibility(fallStart + 0.2, frames, 0.42, 1)

    expect(fallStart + 0.2).toBeLessThan(frames.islandReveal[0])
    expect(opacity).toBeGreaterThan(0)
    expect(opacity).toBeLessThan(0.42)
    expect(getGrowthCloudVisibility(frames.handoff[0] + 0.05, frames, 0.42, 1)).toBeGreaterThan(0)
    expect(getGrowthCloudVisibility(frames.handoff[1], frames, 0.42, 1)).toBe(0)
    expect(getGrowthCloudVisibility(fallStart + 0.5, frames, 0.42, 0)).toBe(0)
    expect(getGrowthCloudVisibility(fallStart + 0.5, frames, 0, 1)).toBe(0)
    expect(getGrowthCloudVisibility(Number.NaN, frames, 0.42, 1)).toBe(0)
    expect(getGrowthCloudVisibility(fallStart + 0.5, frames, 0.42, 0.5))
      .toBeCloseTo(getGrowthCloudVisibility(fallStart + 0.5, frames, 0.42, 1) * 0.5)
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
    expect(material.fragmentShader).toContain('float discriminant = b * b - a * c')
    expect(material.fragmentShader).toContain('float cloudDensity = cloudBody * erosion')
    expect(material.fragmentShader).toContain('float lobeD =')
    expect(material.fragmentShader).toContain('sampleColor += silverBlue * silverRim')
    expect(material.fragmentShader).toContain('float erosion = 0.25 + coverage * 0.75')
    expect(material.fragmentShader).toContain('uMoonPosition')
    expect(material.fragmentShader).toContain('uLightIntensity')
    expect(material.fragmentShader).toContain('transmittance *= 1.0 - sampleAlpha')
    material.dispose()
  })
})
