import { readFileSync } from 'node:fs'
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  getGrowthMoonlightBeamLayout, getGrowthMoonlightLevels, growthContactShadowFragmentShader,
  growthMoonBeamFragmentShader,
} from './moonlight'

const defaultSettings = {
  moonPositionX: -0.65,
  moonPositionY: 5.5,
  moonPositionZ: 1,
  moonBeamRadius: 2,
}

describe('Scene 02 moonlight', () => {
  it('keeps a soft lunar base before impact, adds the existing growth accent, and fades with the environment', () => {
    const beforeImpact = getGrowthMoonlightLevels(1.2, 0.55, 0, 1)
    const afterImpact = getGrowthMoonlightLevels(1.2, 0.55, 1, 1)
    const duringHandoff = getGrowthMoonlightLevels(1.2, 0.55, 1, 0.35)

    expect(beforeImpact.key).toBeGreaterThan(0)
    expect(afterImpact.key).toBeGreaterThan(beforeImpact.key)
    expect(afterImpact.beam).toBeGreaterThan(beforeImpact.beam)
    expect(beforeImpact.shadow).toBe(0)
    expect(afterImpact.shadow).toBe(1)
    expect(duringHandoff.key).toBeCloseTo(afterImpact.key * 0.35)
    expect(getGrowthMoonlightLevels(1.2, 0.55, 1, 0).beam).toBe(0)
    expect(getGrowthMoonlightLevels(1.2, 0.55, 1, 0).shadow).toBe(0)
  })

  it('aligns the shaft from the visible island center toward the configured source in all axes', () => {
    const layout = getGrowthMoonlightBeamLayout(defaultSettings)
    const sourceAxis = new Vector3(
      defaultSettings.moonPositionX,
      defaultSettings.moonPositionY,
      defaultSettings.moonPositionZ,
    ).normalize()
    const shaftAxis = new Vector3(0, 1, 0).applyQuaternion(layout.quaternion)

    expect(layout.start).toEqual([0, 0, 0])
    expect(layout.end).toEqual(layout.source)
    const midpoint = new Vector3(...layout.start).add(new Vector3(...layout.end).multiplyScalar(0.5))
    const sheetOffset = new Vector3(...layout.position).sub(midpoint)
    const sheetNormal = new Vector3(...layout.planeNormal)
    expect(sheetOffset.dot(sheetNormal)).toBeCloseTo(-layout.depthOffset)
    expect(sheetOffset.clone().cross(sheetNormal).length()).toBeCloseTo(0)
    expect(layout.width).toBe(8)
    expect(layout.height).toBeCloseTo(Math.hypot(-0.65, 5.5, 1))
    expect(shaftAxis.dot(sourceAxis)).toBeCloseTo(1)
  })

  it('moves and widens the actual beam when its DEV source and radius settings change', () => {
    const layout = getGrowthMoonlightBeamLayout({
      moonPositionX: 1.4,
      moonPositionY: 7,
      moonPositionZ: -2.2,
      moonBeamRadius: 3,
    })

    expect(layout.source).toEqual([1.4, 7, -2.2])
    expect(layout.start).toEqual([0, 0, 0])
    expect(layout.end).toEqual(layout.source)
    const midpoint = new Vector3(...layout.start).add(new Vector3(...layout.end).multiplyScalar(0.5))
    const sheetOffset = new Vector3(...layout.position).sub(midpoint)
    const sheetNormal = new Vector3(...layout.planeNormal)
    expect(sheetOffset.dot(sheetNormal)).toBeCloseTo(-layout.depthOffset)
    expect(sheetOffset.clone().cross(sheetNormal).length()).toBeCloseTo(0)
    expect(new Vector3(0, 1, 0).applyQuaternion(layout.quaternion).dot(new Vector3(...layout.end).normalize())).toBeCloseTo(1)
    expect(layout.width).toBe(12)
  })

  it('keeps radial and vertical scatter edges softly feathered without a hard rectangular shaft', () => {
    expect(growthMoonBeamFragmentShader).toContain('exp(-across * across')
    expect(growthMoonBeamFragmentShader).toContain('smoothstep(0.0, 0.08, vUv.y)')
    expect(growthMoonBeamFragmentShader).toContain('smoothstep(0.94, 1.0, vUv.y)')
    expect(growthMoonBeamFragmentShader).toContain('uSoftness')
    expect(growthMoonBeamFragmentShader).toContain('energy / (1.0 + energy)')
    expect(growthMoonBeamFragmentShader).not.toContain('min(0.09')
    expect(growthMoonBeamFragmentShader).not.toMatch(/if\s*\(.*vUv/)
  })

  it('uses one soft local contact shadow and does not enable renderer-wide shadow maps', () => {
    expect(growthContactShadowFragmentShader).toContain('exp(-radiusSquared * 3.4)')
    expect(growthContactShadowFragmentShader).toContain('smoothstep(0.36, 1.0, radiusSquared)')
    const source = readFileSync(new URL('./GrowthMoonlight.tsx', import.meta.url), 'utf8')
    expect(source).toContain('rotation={[-Math.PI / 2, 0, 0]}')
    expect(source).toContain('blending={NormalBlending}')
    expect(source).not.toContain('gl.shadowMap')
  })

  it('replaces the old post-landing-only spotlight with the scene-local configurable moonlight component', () => {
    const source = readFileSync(new URL('../GrowthScene.tsx', import.meta.url), 'utf8')
    expect(source).toContain('<GrowthMoonlight')
    expect(source).not.toContain('pose.moonlight * 4')
    expect(source).not.toContain('<spotLight')
  })
})
