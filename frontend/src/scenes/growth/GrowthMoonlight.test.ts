import { readFileSync } from 'node:fs'
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  getGrowthMoonlightBeamLayout, getGrowthMoonlightLevels, growthContactShadowFragmentShader,
  growthMoonBeamFragmentShader,
} from './moonlight'

const defaultSettings = {
  islandRadius: 0.82,
  moonPositionX: -0.65,
  moonPositionY: 5.5,
  moonPositionZ: 1,
  moonBeamRadius: 2,
}

describe('Scene 02 moonlight', () => {
  it('keeps a soft lunar base before impact, adds the existing growth accent, and fades with the environment', () => {
    const beforeImpact = getGrowthMoonlightLevels(1.2, 0.55, 0, 1, 0.35)
    const afterImpact = getGrowthMoonlightLevels(1.2, 0.55, 1, 1, 0.35)
    const duringHandoff = getGrowthMoonlightLevels(1.2, 0.55, 1, 0.35, 0.35)

    expect(beforeImpact.key).toBeGreaterThan(0)
    expect(afterImpact.key).toBeGreaterThan(beforeImpact.key)
    expect(afterImpact.beam).toBeGreaterThan(beforeImpact.beam)
    expect(beforeImpact.shadow).toBe(0)
    expect(afterImpact.shadow).toBe(1)
    expect(duringHandoff.key).toBeCloseTo(afterImpact.key * 0.35)
    expect(getGrowthMoonlightLevels(1.2, 0.55, 1, 0, 0.35).beam).toBe(0)
    expect(getGrowthMoonlightLevels(1.2, 0.55, 1, 0, 0.35).shadow).toBe(0)
  })

  it('uses a centered vertical shaft and ignores legacy horizontal source coordinates', () => {
    const layout = getGrowthMoonlightBeamLayout(defaultSettings)
    const shaftAxis = new Vector3(0, 1, 0).applyQuaternion(layout.quaternion)

    expect(layout.start).toEqual([0, 0, 0])
    expect(layout.source).toEqual([0, 5.5, 0])
    expect(layout.end).toEqual([0, 5.5, 0])
    expect(layout.position).toEqual([0, 2.75, 0])
    expect(layout.width).toBeCloseTo(0.82 * 12)
    expect(layout.height).toBe(5.5)
    expect(shaftAxis.toArray()).toEqual([0, 1, 0])

    const movedLegacySettings = {
      ...defaultSettings,
      moonPositionX: 3.5,
      moonPositionZ: -3,
    }
    const movedLegacySource = getGrowthMoonlightBeamLayout(movedLegacySettings)
    expect(movedLegacySource.position).toEqual(layout.position)
    expect(movedLegacySource.source).toEqual(layout.source)
  })

  it('keeps the beam radius proportional to the island size and its full height tied to source Y', () => {
    const layout = getGrowthMoonlightBeamLayout({
      ...defaultSettings,
      islandRadius: 1.05,
      moonPositionY: 8,
      moonBeamRadius: 3,
    })

    expect(layout.source).toEqual([0, 8, 0])
    expect(layout.start).toEqual([0, 0, 0])
    expect(layout.end).toEqual(layout.source)
    expect(layout.position).toEqual([0, 4, 0])
    expect(layout.height).toBe(8)
    expect(layout.radius).toBeCloseTo(1.05 * 3 / 2)
    expect(layout.width).toBeCloseTo(1.05 * 3 / 2 * 12)
  })

  it('exposes shaft brightness and broad atmospheric scattering as independent controls', () => {
    const mutedScatter = getGrowthMoonlightLevels(1.2, 0.55, 1, 1, 0.1)
    const strongerScatter = getGrowthMoonlightLevels(1.2, 0.55, 1, 1, 1.1)
    const strongerShaft = getGrowthMoonlightLevels(1.2, 1.1, 1, 1, 0.1)

    expect(strongerScatter.beam).toBe(mutedScatter.beam)
    expect(strongerScatter.scattering).toBeGreaterThan(mutedScatter.scattering)
    expect(strongerShaft.scattering).toBe(mutedScatter.scattering)
    expect(strongerShaft.beam).toBeGreaterThan(mutedScatter.beam)
  })

  it('uses a local default scattering level when an older v14 config has no separate setting', () => {
    const legacySettings = getGrowthMoonlightLevels(1.2, 0.55, 0, 1)
    expect(legacySettings.scattering).toBeCloseTo(0.35 * 0.68)
  })

  it('uses a continuous smooth shader with no spatial noise or dither layers', () => {
    expect(growthMoonBeamFragmentShader).toContain('exp(-shaftAcross * shaftAcross')
    expect(growthMoonBeamFragmentShader).toContain('exp(-hazeAcross * hazeAcross')
    expect(growthMoonBeamFragmentShader).toContain('smoothstep(0.0, 0.08, vUv.y)')
    expect(growthMoonBeamFragmentShader).toContain('smoothstep(0.96, 1.0, vUv.y)')
    expect(growthMoonBeamFragmentShader).toContain('uSoftness')
    expect(growthMoonBeamFragmentShader).toContain('uScatteringIntensity')
    expect(growthMoonBeamFragmentShader).toContain('0.34 * shaftEnergy / (0.55 + shaftEnergy)')
    expect(growthMoonBeamFragmentShader).toContain('0.30 * hazeEnergy / (0.4 + hazeEnergy)')
    expect(growthMoonBeamFragmentShader).toContain('#include <colorspace_fragment>')
    expect(growthMoonBeamFragmentShader).not.toContain('sin(')
    expect(growthMoonBeamFragmentShader).not.toContain('noise')
    expect(growthMoonBeamFragmentShader).not.toContain('dither')
    expect(growthMoonBeamFragmentShader).not.toMatch(/if\s*\(.*vUv/)
  })

  it('uses one soft local contact shadow and does not enable renderer-wide shadow maps', () => {
    expect(growthContactShadowFragmentShader).toContain('exp(-radiusSquared * 3.4)')
    expect(growthContactShadowFragmentShader).toContain('smoothstep(0.36, 1.0, radiusSquared)')
    const source = readFileSync(new URL('./GrowthMoonlight.tsx', import.meta.url), 'utf8')
    expect(source).toContain('rotation={[-Math.PI / 2, 0, 0]}')
    expect(source).toContain('blending={NormalBlending}')
    expect(source).toContain('side={DoubleSide}')
    expect(source).not.toContain('gl.shadowMap')
  })

  it('replaces the old post-landing-only spotlight with the scene-local configurable moonlight component', () => {
    const source = readFileSync(new URL('../GrowthScene.tsx', import.meta.url), 'utf8')
    expect(source).toContain('<GrowthMoonlight')
    expect(source).not.toContain('pose.moonlight * 4')
    expect(source).not.toContain('<spotLight')
  })
})
