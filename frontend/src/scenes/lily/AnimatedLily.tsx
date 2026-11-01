import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { LoopOnce, LoopRepeat, Material, Mesh, type Group } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { SceneProps } from '../../engine/sceneTypes'
import { getBloomSceneFrames, getGrowthSceneFrames } from '../../engine/filmConfig'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import { LILY_MODEL_URL } from '../../assets/lily/lilyAsset'
import { getGrowthClipTime, getIdleClosedClipTime, getSyncedBloomClipTime } from './animationTiming'
import { attachLilyAnimationPlayer, LilyAnimationPlayer } from './animationPlayer'
import { subscribeLilyAnimationClock } from './animationClock'
import { createLilyGeometryParticleSource, lilyDissolvePart, type LilySurfaceSource } from './particleSource'
import { patchLilyMaterial, setLilySurfaceBounds, updateLilyDissolve, updateLilyParticleSettings, type LilyDissolveUniforms } from './dissolve'
import {
  applyLilyMaterialVariants,
  cloneEnhancedLilyMaterials,
  disposeLilyEnhancedTextures,
  getLilyMaterialSnapshot,
  loadLilyEnhancedTextures,
  resetLilyMaterialModeOutsideBloom,
  setLilyMaterialStatus,
  shouldUseEnhancedLilyMaterials,
  subscribeLilyMaterialExperiment,
  type LilyMaterialStateSnapshot,
} from './materialPolish'

const MODEL_POSITION: [number, number, number] = [0, -1.45, 0]
const MODEL_SCALE = 3

interface LilyMaterialState {
  material: Material
  opacity: number
  transparent: boolean
  depthWrite: boolean
}

function cloneLilyMaterials(root: Group, uniforms: LilyDissolveUniforms): LilyMaterialState[] {
  const clones = new Map<Material, Map<number, Material>>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const part = lilyDissolvePart(object.name, materials.map((material) => material.name))
    const replace = (material: Material) => {
      let variants = clones.get(material)
      if (!variants) { variants = new Map(); clones.set(material, variants) }
      let clone = variants.get(part)
      if (!clone) {
        clone = material.clone()
        patchLilyMaterial(clone, part, uniforms)
        variants.set(part, clone)
      }
      return clone
    }
    object.material = Array.isArray(object.material) ? object.material.map(replace) : replace(object.material)
  })
  return [...clones.values()].flatMap((variants) => [...variants.values()]).map((material) => ({
    material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite,
  }))
}

function setLilyOpacity(states: LilyMaterialState[], opacity: number) {
  const alpha = Math.min(1, Math.max(0, opacity))
  for (const state of states) {
    const transparent = state.transparent || alpha < 0.999
    state.material.opacity = state.opacity * alpha
    state.material.depthWrite = alpha < 0.999 ? false : state.depthWrite
    if (state.material.transparent !== transparent) {
      state.material.transparent = transparent
      state.material.needsUpdate = true
    }
  }
}

/** A single GLB instance spans scene 02's growth and scene 03's touch gate. */
export function AnimatedLily({ state, runtime, reducedMotion, onParticleSource, dissolveUniforms }: SceneProps & { onParticleSource?: (source: LilySurfaceSource) => void; dissolveUniforms: LilyDissolveUniforms }) {
  const gltf = useGLTF(LILY_MODEL_URL)
  const invalidate = useThree(({ invalidate }) => invalidate)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const materialExperiment = useSyncExternalStore<LilyMaterialStateSnapshot>(subscribeLilyMaterialExperiment, getLilyMaterialSnapshot, getLilyMaterialSnapshot)
  const model = useMemo(() => clone(gltf.scene) as Group, [gltf.scene])
  const stateRef = useRef(state)
  const playerRef = useRef<LilyAnimationPlayer | null>(null)
  const modelRef = useRef<Group | null>(null)
  const materialsRef = useRef<LilyMaterialState[]>([])
  const enhancedMaterialsRef = useRef(new Map<Material, Material>())
  const particleSourceRef = useRef<LilySurfaceSource | null>(null)
  const [textureRevision, setTextureRevision] = useState(0)
  const useEnhancedMaterials = shouldUseEnhancedLilyMaterials(import.meta.env.DEV, state.scene, materialExperiment.mode)
  const waitingForTouch = state.scene === 'bloom' && state.mode === 'waiting'
  useLayoutEffect(() => { stateRef.current = state }, [state])
  useLayoutEffect(() => {
    const materials = cloneLilyMaterials(model, dissolveUniforms)
    materialsRef.current = materials
    return () => {
      for (const { material } of materials) material.dispose()
      if (materialsRef.current === materials) materialsRef.current = []
    }
  }, [model, dissolveUniforms])
  useLayoutEffect(() => attachLilyAnimationPlayer(playerRef, model, gltf.animations), [gltf.animations, model])
  useLayoutEffect(() => {
    applyLilyMaterialVariants(model, enhancedMaterialsRef.current, useEnhancedMaterials)
    invalidate()
  }, [invalidate, model, textureRevision, useEnhancedMaterials])
  useEffect(() => {
    if (!useEnhancedMaterials) return
    let cancelled = false
    let textures: Awaited<ReturnType<typeof loadLilyEnhancedTextures>> | undefined
    let variants = new Map<Material, Material>()
    setLilyMaterialStatus('loading')
    void loadLilyEnhancedTextures().then((loaded) => {
      if (cancelled) {
        disposeLilyEnhancedTextures(loaded)
        return
      }
      textures = loaded
      variants = cloneEnhancedLilyMaterials(materialsRef.current, loaded)
      enhancedMaterialsRef.current = variants
      setLilyMaterialStatus('ready')
      setTextureRevision((revision) => revision + 1)
    }).catch(() => {
      if (!cancelled) setLilyMaterialStatus('error')
    })
    return () => {
      cancelled = true
      for (const material of variants.values()) material.dispose()
      if (enhancedMaterialsRef.current === variants) enhancedMaterialsRef.current = new Map()
      if (textures) disposeLilyEnhancedTextures(textures)
      setLilyMaterialStatus('idle')
    }
  }, [model, useEnhancedMaterials])
  useEffect(() => {
    resetLilyMaterialModeOutsideBloom(state.scene)
  }, [state.scene])
  useLayoutEffect(() => {
    if (state.scene !== 'identity' || particleSourceRef.current || !onParticleSource) return
    const clip = gltf.animations.find((animation) => animation.name === 'Bloom')
    const player = playerRef.current
    if (!clip || !player) return
    // Sample the same posed model at its actual world transform. IdentityScene
    // waits for this one-time capture instead of briefly using mock positions.
    player.play('Bloom', LoopOnce, 1)
    player.seek(clip.duration)
    const source = createLilyGeometryParticleSource(model)
    setLilySurfaceBounds(dissolveUniforms, source)
    particleSourceRef.current = source
    onParticleSource(source)
  }, [dissolveUniforms, gltf.animations, model, onParticleSource, state.scene])

  const draw = useCallback((time: number, presentationTime: number) => {
    const currentState = stateRef.current
    const modelObject = modelRef.current
    const player = playerRef.current
    if (!modelObject || !player) return
    const scene = currentState.scene
    updateLilyDissolve(dissolveUniforms, scene === 'identity', time, config.scenes.identity.dissolveDuration, config.scenes.identity.edgeWidth)
    updateLilyParticleSettings(dissolveUniforms, config.scenes.identity)
    if (scene === 'growth') {
      const frames = getGrowthSceneFrames(config.scenes.growth)
      const clip = gltf.animations.find((animation) => animation.name === 'Growth')
      const visible = time >= frames.model[0]
      modelObject.visible = visible
      setLilyOpacity(materialsRef.current, 1)
      if (visible && clip) {
        player.play('Growth', LoopOnce, 1)
        player.seek(getGrowthClipTime(time, frames, clip.duration))
      }
    } else if (scene === 'bloom') {
      modelObject.visible = true
      setLilyOpacity(materialsRef.current, 1)
      if (currentState.mode === 'waiting') {
        const clip = gltf.animations.find((animation) => animation.name === 'IdleClosed')
        if (clip) {
          player.play('IdleClosed', LoopRepeat, Infinity)
          player.seek(getIdleClosedClipTime(presentationTime, clip.duration, reducedMotion))
        }
      } else {
        const clip = gltf.animations.find((animation) => animation.name === 'Bloom')
        if (clip) {
          const frames = getBloomSceneFrames(config.scenes.bloom)
          player.play('Bloom', LoopOnce, 1)
          player.seek(getSyncedBloomClipTime(
            time, frames.opening, clip.duration, reducedMotion,
            config.scenes.bloom.cameraApproachDuration, config.scenes.bloom.cameraBloomSync,
          ))
        }
      }
    } else if (scene === 'identity') {
      const clip = gltf.animations.find((animation) => animation.name === 'Bloom')
      modelObject.visible = time < config.scenes.identity.dissolveDuration
      setLilyOpacity(materialsRef.current, 1)
      if (clip && modelObject.visible) {
        player.play('Bloom', LoopOnce, 1)
        player.seek(clip.duration)
      } else {
        player.stop()
      }
    } else {
      modelObject.visible = false
      setLilyOpacity(materialsRef.current, 1)
      player.stop()
    }
    invalidate()
  }, [config.scenes.bloom, config.scenes.growth, config.scenes.identity, dissolveUniforms, gltf.animations, invalidate, reducedMotion])

  useLayoutEffect(() => {
    const sync = () => draw(runtime.time, runtime.presentationTime)
    sync()
    return subscribeLilyAnimationClock(runtime, sync, waitingForTouch, reducedMotion)
  }, [draw, model, runtime, waitingForTouch, reducedMotion])

  return <group position={MODEL_POSITION} scale={MODEL_SCALE}>
    <primitive ref={modelRef} object={model} dispose={null} />
  </group>
}
