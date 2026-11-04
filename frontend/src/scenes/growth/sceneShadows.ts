import { DirectionalLight, Mesh, Object3D, PCFSoftShadowMap } from 'three'
import type { GrowthMoonlightLevels } from './moonlight'
import type { SceneId } from '../../engine/film'

/** Preserve shadows through the 02→03 handoff and restore them before scene 04. */
export function shouldUseGrowthShadows(scene: SceneId): boolean {
  return scene === 'growth' || scene === 'bloom'
}

/** Fade only the added shadows before the retained island enters scene 04. */
export function getGrowthShadowStrength(scene: SceneId, time: number, bloomDuration: number): number {
  if (scene === 'growth') return 1
  if (scene !== 'bloom') return 0
  const duration = Number.isFinite(bloomDuration) ? Math.max(1.2, bloomDuration) : 1.2
  const elapsed = Number.isFinite(time) ? Math.max(0, time) : 0
  const progress = Math.max(0, Math.min(1, (elapsed - (duration - 1.2)) / 1.2))
  return 1 - progress * progress * (3 - 2 * progress)
}

export interface GrowthShadowMapState {
  enabled: boolean
  type: number
  needsUpdate: boolean
}

export interface GrowthShadowMapLease {
  setEnabled(enabled: boolean): void
  restore(): void
}

export interface GrowthShadowSceneController {
  sync(levels: Pick<GrowthMoonlightLevels, 'key' | 'shadow'>, strength?: number): void
  dispose(): void
}

/** Own the light and renderer shadow state together for the lifetime of scenes 02–03. */
export function createGrowthShadowSceneController(light: DirectionalLight, shadowMap: GrowthShadowMapState): GrowthShadowSceneController {
  const lease = createGrowthShadowMapLease(shadowMap)
  const previousShadowIntensity = light.shadow.intensity
  let disposed = false
  return {
    sync(levels, strength = 1) {
      if (disposed) return
      light.shadow.intensity = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0
      syncGrowthDirectionalShadow(light, lease, levels)
    },
    dispose() {
      if (disposed) return
      disposed = true
      light.castShadow = false
      light.shadow.intensity = previousShadowIntensity
      lease.restore()
    },
  }
}

export function configureGrowthDirectionalShadow(light: DirectionalLight, sourceHeight: number): void {
  light.shadow.mapSize.set(1024, 1024)
  const camera = light.shadow.camera
  camera.left = -2.8
  camera.right = 2.8
  camera.top = 2.8
  camera.bottom = -2.8
  camera.near = 0.1
  camera.far = Math.max(8, (Number.isFinite(sourceHeight) ? sourceHeight : 5.5) + 3)
  camera.updateProjectionMatrix()
  light.shadow.bias = -0.00015
  light.shadow.normalBias = 0.025
  light.shadow.radius = 3
  light.shadow.needsUpdate = true
}

export function syncGrowthDirectionalShadow(
  light: Pick<DirectionalLight, 'intensity' | 'castShadow'>,
  lease: GrowthShadowMapLease | null,
  levels: Pick<GrowthMoonlightLevels, 'key' | 'shadow'>,
): void {
  light.intensity = levels.key
  const enabled = levels.key > 0.001 && levels.shadow > 0.001
  light.castShadow = enabled
  lease?.setEnabled(enabled)
}

/** Enable soft shadow maps for Scene 02 and restore the shared renderer on exit. */
export function createGrowthShadowMapLease(shadowMap: GrowthShadowMapState): GrowthShadowMapLease {
  const previous = { enabled: shadowMap.enabled, type: shadowMap.type }
  let restored = false
  shadowMap.type = PCFSoftShadowMap
  shadowMap.needsUpdate = true

  return {
    setEnabled(enabled) {
      if (restored) return
      const sceneEnabled = previous.enabled || enabled
      if (shadowMap.enabled === sceneEnabled) return
      shadowMap.enabled = sceneEnabled
      shadowMap.needsUpdate = true
    },
    restore() {
      if (restored) return
      restored = true
      shadowMap.enabled = previous.enabled
      shadowMap.type = previous.type
      shadowMap.needsUpdate = true
    },
  }
}

/** Toggle runtime mesh flags without changing the GLB asset, geometry, materials, or clips. */
export function enableGrowthObjectShadows(root: Object3D): () => void {
  const previous: Array<{ mesh: Mesh; castShadow: boolean; receiveShadow: boolean }> = []
  let restored = false
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    previous.push({ mesh: object, castShadow: object.castShadow, receiveShadow: object.receiveShadow })
    object.castShadow = true
    object.receiveShadow = true
  })

  return () => {
    if (restored) return
    restored = true
    for (const { mesh, castShadow, receiveShadow } of previous) {
      mesh.castShadow = castShadow
      mesh.receiveShadow = receiveShadow
    }
  }
}
