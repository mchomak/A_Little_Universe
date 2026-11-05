import { DirectionalLight, Group, Object3D, PCFShadowMap, PCFSoftShadowMap, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  getGrowthIslandLocalLightIntensity, getGrowthMoonlightBeamLayout, getGrowthMoonlightBeamRadius,
  getGrowthMoonlightLevels, getGrowthMoonlightRigGains, syncGrowthDirectionalKeyPose,
} from './moonlight'
import { configureGrowthDirectionalShadow, createGrowthShadowMapLease, shouldUseGrowthShadows, syncGrowthDirectionalShadow } from './sceneShadows'

const defaultSettings = {
  islandRadius: 0.82,
  moonPositionX: -0.65,
  moonPositionY: 5.5,
  moonPositionZ: 1,
  moonBeamRadius: 2,
}

describe('Scene 02 moonlight', () => {
  it('keeps every lunar contribution off before impact and raises it smoothly afterward', () => {
    const beforeImpact = getGrowthMoonlightLevels(1.2, 0.55, 0, 1, 0.35)
    const earlyRamp = getGrowthMoonlightLevels(1.2, 0.55, 0.25, 1, 0.35)
    const lateRamp = getGrowthMoonlightLevels(1.2, 0.55, 0.75, 1, 0.35)
    const afterImpact = getGrowthMoonlightLevels(1.2, 0.55, 1, 1, 0.35)
    const duringHandoff = getGrowthMoonlightLevels(1.2, 0.55, 1, 0.35, 0.35)

    expect(beforeImpact).toEqual({ key: 0, fill: 0, beam: 0, scattering: 0, shadow: 0 })
    expect(earlyRamp.key).toBeCloseTo(0.3)
    expect(earlyRamp.beam).toBeCloseTo(0.1375)
    expect(lateRamp.key).toBeCloseTo(0.9)
    expect(lateRamp.beam).toBeCloseTo(0.4125)
    expect(afterImpact.key).toBeCloseTo(1.2)
    expect(afterImpact.beam).toBeCloseTo(0.55)
    expect(afterImpact.shadow).toBe(1)
    expect(duringHandoff.key).toBeCloseTo(afterImpact.key * 0.35)
    expect(getGrowthMoonlightLevels(1.2, 0.55, 1, 0, 0.35).beam).toBe(0)
    expect(getGrowthMoonlightLevels(1.2, 0.55, 1, 0, 0.35).shadow).toBe(0)
  })

  it('focuses Scene 02 key light while limiting broad fill without lighting before impact', () => {
    const beforeImpact = getGrowthMoonlightLevels(1.2, 0.55, 0, 1, 0.35, 2, 0.65)
    const focused = getGrowthMoonlightLevels(1.2, 0.55, 1, 1, 0.35, 2, 0.65)

    expect(beforeImpact.key).toBe(0)
    expect(beforeImpact.fill).toBe(0)
    expect(focused.key).toBeCloseTo(2.4)
    expect(focused.fill).toBeCloseTo(0.312)
    expect(getGrowthMoonlightLevels(1.2, 0.55, 1, 1, 0.35).fill).toBeCloseTo(0.48)
    expect(getGrowthMoonlightLevels(1.2, 0.55, 1, 1, 0.35).key).toBeCloseTo(1.2)
  })

  it('returns the focused key, fill, local island light and beam radius to shared levels during settle', () => {
    const atStart = getGrowthMoonlightRigGains(0, true)
    const atHalfSettle = getGrowthMoonlightRigGains(0.5, true)
    const atHandoff = getGrowthMoonlightRigGains(1, true)

    expect(atStart).toEqual({ key: 2, fill: 0.65 })
    expect(atHalfSettle.key).toBeCloseTo(1.5)
    expect(atHalfSettle.fill).toBeCloseTo(0.825)
    expect(atHandoff).toEqual({ key: 1, fill: 1 })
    expect(getGrowthMoonlightRigGains(0, false)).toEqual({ key: 1, fill: 1 })

    expect(getGrowthIslandLocalLightIntensity(0)).toBeCloseTo(0.12)
    expect(getGrowthIslandLocalLightIntensity(0.5)).toBeCloseTo(0.37)
    expect(getGrowthIslandLocalLightIntensity(1)).toBeCloseTo(0.62)
    expect(getGrowthIslandLocalLightIntensity(Number.NaN)).toBeCloseTo(0.12)

    expect(getGrowthMoonlightBeamRadius(0.82, 0, true)).toBeCloseTo(0.82 * 0.72)
    expect(getGrowthMoonlightBeamRadius(0.82, 0.5, true)).toBeCloseTo(0.82 * 0.86)
    expect(getGrowthMoonlightBeamRadius(0.82, 1, true)).toBeCloseTo(0.82)
    expect(getGrowthMoonlightBeamRadius(0.82, 0, false)).toBeCloseTo(0.82)
  })

  it('aims the soft shaft from the configured source toward the island', () => {
    const layout = getGrowthMoonlightBeamLayout(defaultSettings)
    const shaftAxis = new Vector3(0, 1, 0).applyQuaternion(layout.quaternion)
    const sourceDirection = new Vector3(...layout.source).normalize()

    expect(layout.start).toEqual([0, 0, 0])
    expect(layout.source).toEqual([-0.65, 5.5, 1])
    expect(layout.end).toEqual(layout.source)
    expect(layout.position).toEqual([-0.325, 2.75, 0.5])
    expect(layout.radius).toBeCloseTo(0.82)
    expect(layout.width).toBeCloseTo(0.82 * 12)
    expect(layout.height).toBeCloseTo(Math.hypot(0.65, 5.5, 1))
    expect(shaftAxis.distanceTo(sourceDirection)).toBeLessThan(1e-6)

    const movedLegacySettings = {
      ...defaultSettings,
      moonPositionX: 3.5,
      moonPositionZ: -3,
    }
    const movedLegacySource = getGrowthMoonlightBeamLayout(movedLegacySettings)
    expect(movedLegacySource.position).toEqual([1.75, 2.75, -1.5])
    expect(movedLegacySource.source).toEqual([3.5, 5.5, -3])
  })

  it('aims the physical key from the configured source to the island origin in world space', () => {
    const root = new Group()
    root.position.set(0, -1.45, 0)
    const target = new Object3D()
    const light = new DirectionalLight()
    root.add(target, light)
    const layout = getGrowthMoonlightBeamLayout(defaultSettings)

    syncGrowthDirectionalKeyPose(light, target, layout)
    root.updateMatrixWorld(true)

    expect(light.target).toBe(target)
    expect(light.getWorldPosition(new Vector3()).toArray()).toEqual([-0.65, 4.05, 1])
    expect(target.getWorldPosition(new Vector3()).toArray()).toEqual([0, -1.45, 0])
    expect(target.getWorldPosition(new Vector3()).sub(light.getWorldPosition(new Vector3())).y).toBeLessThan(0)
  })

  it('keeps the beam radius proportional to the island size and its full height tied to source Y', () => {
    const layout = getGrowthMoonlightBeamLayout({
      ...defaultSettings,
      islandRadius: 1.05,
      moonPositionY: 8,
      moonBeamRadius: 3,
    })

    expect(layout.source).toEqual([-0.65, 8, 1])
    expect(layout.start).toEqual([0, 0, 0])
    expect(layout.end).toEqual(layout.source)
    expect(layout.position).toEqual([-0.325, 4, 0.5])
    expect(layout.height).toBeCloseTo(Math.hypot(0.65, 8, 1))
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

  it('uses a local default scattering level without turning on lunar light before impact', () => {
    const legacySettings = getGrowthMoonlightLevels(1.2, 0.55, 0, 1)
    expect(legacySettings.scattering).toBe(0)
  })

  it('rewinds the shadow ramp, keeps the Bloom handoff, and restores the renderer before Identity', () => {
    const initiallyOff = { enabled: false, type: PCFShadowMap, needsUpdate: false }
    const lease = createGrowthShadowMapLease(initiallyOff)
    const light = { intensity: 0, castShadow: false }
    expect(initiallyOff.type).toBe(PCFSoftShadowMap)
    expect(initiallyOff.enabled).toBe(false)

    syncGrowthDirectionalShadow(light, lease, getGrowthMoonlightLevels(1.2, 0.55, 0, 1, 0.35))
    expect(light).toEqual({ intensity: 0, castShadow: false })
    expect(initiallyOff.enabled).toBe(false)

    syncGrowthDirectionalShadow(light, lease, getGrowthMoonlightLevels(1.2, 0.55, 0.25, 1, 0.35))
    expect(light.intensity).toBeGreaterThan(0)
    expect(light.castShadow).toBe(true)
    expect(initiallyOff.enabled).toBe(true)
    expect(initiallyOff.needsUpdate).toBe(true)

    syncGrowthDirectionalShadow(light, lease, getGrowthMoonlightLevels(1.2, 0.55, 0, 1, 0.35))
    expect(light).toEqual({ intensity: 0, castShadow: false })
    expect(initiallyOff.enabled).toBe(false)

    expect(shouldUseGrowthShadows('growth')).toBe(true)
    const atGrowthEnd = getGrowthMoonlightLevels(1.2, 0.55, 1, 1, 0.35)
    syncGrowthDirectionalShadow(light, lease, atGrowthEnd)
    expect(shouldUseGrowthShadows('bloom')).toBe(true)
    const firstBloomFrame = getGrowthMoonlightLevels(1.2, 0.55, 1, 1, 0.35)
    syncGrowthDirectionalShadow(light, lease, firstBloomFrame)
    expect(light.castShadow).toBe(true)
    expect(initiallyOff.enabled).toBe(true)

    expect(shouldUseGrowthShadows('identity')).toBe(false)
    lease.restore()
    expect(initiallyOff).toMatchObject({ enabled: false, type: PCFShadowMap, needsUpdate: true })

    const initiallyOn = { enabled: true, type: PCFShadowMap, needsUpdate: false }
    const onLease = createGrowthShadowMapLease(initiallyOn)
    onLease.setEnabled(false)
    expect(initiallyOn.enabled).toBe(true)
    onLease.restore()
    expect(initiallyOn).toMatchObject({ enabled: true, type: PCFShadowMap, needsUpdate: true })
  })

  it('updates the directional shadow frustum when the source height changes while paused', () => {
    const light = new DirectionalLight()
    configureGrowthDirectionalShadow(light, 5.5)
    expect(light.shadow.camera.far).toBeCloseTo(8.5)
    configureGrowthDirectionalShadow(light, 8)
    expect(light.shadow.camera.far).toBeCloseTo(11)
    expect(light.shadow.needsUpdate).toBe(true)
  })
})
