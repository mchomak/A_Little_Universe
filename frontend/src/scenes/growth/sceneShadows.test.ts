import { BufferGeometry, DirectionalLight, Group, Mesh, MeshBasicMaterial, PCFShadowMap, PCFSoftShadowMap } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import { getGrowthFrames, getGrowthViewportHeight, getSeedPose } from './seedProcedure'
import { getGrowthMoonlightLevels } from './moonlight'
import { createGrowthShadowMapLease, createGrowthShadowSceneController, enableGrowthObjectShadows, getGrowthShadowStrength, shouldUseGrowthShadows } from './sceneShadows'

describe('Scene 02 shadow resources', () => {
  it('fades the added shadows before the 03→04 boundary and restores renderer state', () => {
    const light = new DirectionalLight()
    const shadowMap = { enabled: false, type: PCFShadowMap, needsUpdate: false }
    const controller = createGrowthShadowSceneController(light, shadowMap)
    const levels = { key: 1.2, shadow: 1 }
    const duration = 24
    controller.sync(levels, getGrowthShadowStrength('growth', 20, duration))
    expect(light.shadow.intensity).toBe(1)
    controller.sync(levels, getGrowthShadowStrength('bloom', 0, duration))
    expect(light.shadow.intensity).toBe(1)
    controller.sync(levels, getGrowthShadowStrength('bloom', duration - 0.6, duration))
    expect(light.shadow.intensity).toBeCloseTo(0.5)
    controller.sync(levels, getGrowthShadowStrength('bloom', duration, duration))
    expect(light.shadow.intensity).toBe(0)
    expect(light.intensity).toBe(1.2)
    expect(getGrowthShadowStrength('identity', 0, duration)).toBe(0)
    controller.dispose()
    expect([light.castShadow, light.shadow.intensity, shadowMap.enabled, shadowMap.type]).toEqual([false, 1, false, PCFShadowMap])
    light.dispose()
  })
  it('samples the real impact timeline, rewinds and restores light, renderer and model flags at scene 04', () => {
    const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth
    const frames = getGrowthFrames(settings)
    const viewport = getGrowthViewportHeight(1280, 720)
    const light = new DirectionalLight()
    const shadowMap = { enabled: false, type: PCFShadowMap, needsUpdate: false }
    const root = new Group()
    const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial())
    root.add(mesh)
    const restoreMesh = enableGrowthObjectShadows(root)
    const controller = createGrowthShadowSceneController(light, shadowMap)
    const sample = (time: number) => {
      const pose = getSeedPose(time, viewport, false, settings)
      controller.sync(getGrowthMoonlightLevels(settings.moonLightIntensity, settings.moonBeamIntensity, pose.moonlight, 1, settings.moonScatteringIntensity))
    }

    sample(frames.fall[1] - 0.01)
    expect([light.intensity, light.castShadow, shadowMap.enabled]).toEqual([0, false, false])
    sample(frames.fall[1])
    expect([light.intensity, light.castShadow, shadowMap.enabled]).toEqual([0, false, false])
    sample((frames.moonlight[0] + frames.moonlight[1]) / 2)
    expect(light.intensity).toBeGreaterThan(0)
    expect(light.castShadow && shadowMap.enabled && mesh.castShadow).toBe(true)
    sample(frames.fall[0])
    expect([light.intensity, light.castShadow, shadowMap.enabled]).toEqual([0, false, false])
    sample(frames.duration)
    expect(shouldUseGrowthShadows('bloom') && light.castShadow && shadowMap.enabled).toBe(true)
    expect(shouldUseGrowthShadows('identity')).toBe(false)
    controller.dispose()
    restoreMesh()
    expect([light.castShadow, shadowMap.enabled, shadowMap.type, mesh.castShadow]).toEqual([false, false, PCFShadowMap, false])
    mesh.geometry.dispose()
    mesh.material.dispose()
    light.dispose()
  })
  it('enables lily mesh shadows for the scene and restores their original flags on exit', () => {
    const root = new Group()
    const branch = new Group()
    const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial())
    mesh.castShadow = false
    mesh.receiveShadow = true
    root.add(branch)
    branch.add(mesh)

    const restore = enableGrowthObjectShadows(root)
    expect(mesh.castShadow).toBe(true)
    expect(mesh.receiveShadow).toBe(true)
    restore()
    expect(mesh.castShadow).toBe(false)
    expect(mesh.receiveShadow).toBe(true)
    mesh.geometry.dispose()
    mesh.material.dispose()
  })

  it('uses PCF soft shadows while Scene 02 is active and restores prior renderer state', () => {
    const shadowMap = { enabled: false, type: PCFShadowMap, needsUpdate: false }
    const lease = createGrowthShadowMapLease(shadowMap)
    expect(shadowMap.type).toBe(PCFSoftShadowMap)
    expect(shadowMap.enabled).toBe(false)
    lease.setEnabled(true)
    expect(shadowMap.enabled).toBe(true)
    lease.setEnabled(false)
    lease.restore()
    expect(shadowMap).toMatchObject({ enabled: false, type: PCFShadowMap, needsUpdate: true })
  })
})
