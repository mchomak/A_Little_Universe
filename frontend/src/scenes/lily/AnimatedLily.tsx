import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { LoopOnce, Material, Mesh, type Group } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { SceneProps } from '../../engine/sceneTypes'
import { getBloomSceneFrames, getGrowthSceneFrames } from '../../engine/filmConfig'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import { LILY_MODEL_URL } from '../../assets/lily/lilyAsset'
import { getGrowthClipTime, getSyncedBloomClipTime } from './animationTiming'
import { attachLilyAnimationPlayer, LilyAnimationPlayer } from './animationPlayer'
import { subscribeLilyAnimationClock } from './animationClock'
import { createLilyGeometryParticleSourceAsync, lilyDissolvePart, type LilySurfaceSource } from './particleSource'
import { patchLilyMaterial, setLilySurfaceBounds, updateLilyDissolve, updateLilyParticleSettings, type LilyDissolveUniforms } from './dissolve'
import { createLilyGrowthVfx, type LilyGrowthVfx } from './lilyGrowthVfx'
import { createLilyParticleGeometrySetup, lilyParticlePreparation } from './lilyParticlePreparation'
import { getLilyParticleSourceSignature, LILY_PARTICLE_MODEL_POSITION, LILY_PARTICLE_MODEL_SCALE, seekLilyBloomEndpoint } from './lilyParticlePose'
import { enableGrowthObjectShadows, shouldUseGrowthShadows } from '../growth/sceneShadows'

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

/** A single GLB instance spans scene 02's growth and scene 03's automatic bloom. */
export function AnimatedLily({ state, runtime, reducedMotion, onParticleSource, onParticleSourceError, sourceAttempt = 0, dissolveUniforms }: SceneProps & {
  onParticleSource?: (source: LilySurfaceSource) => void
  onParticleSourceError?: (error: unknown) => void
  sourceAttempt?: number
  dissolveUniforms: LilyDissolveUniforms
}) {
  const gltf = useGLTF(LILY_MODEL_URL)
  const invalidate = useThree(({ invalidate }) => invalidate)
  const pixelRatio = useThree(({ viewport }) => viewport.dpr)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const preparationSnapshot = useSyncExternalStore(lilyParticlePreparation.subscribe, lilyParticlePreparation.getSnapshot, lilyParticlePreparation.getSnapshot)
  const screenSize = useThree(({ size }) => size)
  const model = useMemo(() => clone(gltf.scene) as Group, [gltf.scene])
  const stateRef = useRef(state)
  const playerRef = useRef<LilyAnimationPlayer | null>(null)
  const modelRef = useRef<Group | null>(null)
  const wrapperRef = useRef<Group | null>(null)
  const growthVfxRef = useRef<LilyGrowthVfx | null>(null)
  const materialsRef = useRef<LilyMaterialState[]>([])
  const particleSourceRef = useRef<LilySurfaceSource | null>(null)
  const growthWorldActive = shouldUseGrowthShadows(state.scene)
  useLayoutEffect(() => { stateRef.current = state }, [state])
  useLayoutEffect(() => {
    if (!growthWorldActive) return
    return enableGrowthObjectShadows(model)
  }, [growthWorldActive, model])
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
    const wrapper = wrapperRef.current
    const growthClip = gltf.animations.find((animation) => animation.name === 'Growth')
    if (!wrapper || !growthClip) return
    const effects = createLilyGrowthVfx(wrapper, model, growthClip)
    growthVfxRef.current = effects
    return () => {
      effects.dispose()
      if (growthVfxRef.current === effects) growthVfxRef.current = null
    }
  }, [gltf.animations, model])
  useLayoutEffect(() => {
    if (state.scene !== 'identity' || particleSourceRef.current || !onParticleSource) return
    const clip = gltf.animations.find((animation) => animation.name === 'Bloom')
    const player = playerRef.current
    if (!clip || !player) return
    const setup = createLilyParticleGeometrySetup({
      config,
      width: screenSize.width,
      height: screenSize.height,
      reducedMotion,
      bloomClipDuration: clip.duration,
    })
    const prepared = lilyParticlePreparation.getForKey(setup.key)
    if (prepared?.source) {
      setLilySurfaceBounds(dissolveUniforms, prepared.source)
      particleSourceRef.current = prepared.source
      onParticleSource(prepared.source)
      return
    }
    // The preparation screen owns matching worker input until its source is
    // available; don't capture a second copy when a DEV jump enters scene 04.
    const currentPreparation = lilyParticlePreparation.getSnapshot()
    if (currentPreparation.status === 'preparing' && currentPreparation.key === setup.seedKey) return
    // Sample the same posed model at its actual world transform. IdentityScene
    // waits for this one-time capture instead of briefly using mock positions.
    seekLilyBloomEndpoint(player, clip)
    let cancelled = false
    void createLilyGeometryParticleSourceAsync(model, { isCancelled: () => cancelled }).then((source) => {
      if (cancelled) return
      const posedSource = { ...source, signature: getLilyParticleSourceSignature(clip.duration) }
      setLilySurfaceBounds(dissolveUniforms, posedSource)
      particleSourceRef.current = posedSource
      onParticleSource(posedSource)
    }).catch((reason: unknown) => {
      if (cancelled || (reason instanceof Error && reason.name === 'AbortError')) return
      console.error('Scene 04 lily surface capture failed.', reason)
      onParticleSourceError?.(reason)
    })
    return () => { cancelled = true }
  }, [config, dissolveUniforms, gltf.animations, model, onParticleSource, onParticleSourceError, preparationSnapshot, reducedMotion, screenSize.height, screenSize.width, sourceAttempt, state.scene])

  const draw = useCallback((time: number) => {
    const currentState = stateRef.current
    const modelObject = modelRef.current
    const player = playerRef.current
    if (!modelObject || !player) return
    const scene = currentState.scene
    const growthFrames = getGrowthSceneFrames(config.scenes.growth)
    const growthClip = gltf.animations.find((animation) => animation.name === 'Growth')
    let growthClipTime = 0
    updateLilyDissolve(dissolveUniforms, scene === 'identity', time, config.scenes.identity.dissolveDuration, config.scenes.identity.edgeWidth)
    updateLilyParticleSettings(dissolveUniforms, config.scenes.identity)
    if (scene === 'growth') {
      const frames = growthFrames
      const clip = growthClip
      const visible = time >= frames.model[0]
      modelObject.visible = visible
      setLilyOpacity(materialsRef.current, 1)
      if (visible && clip) {
        player.play('Growth', LoopOnce, 1)
        growthClipTime = getGrowthClipTime(time, frames, clip.duration)
        player.seek(growthClipTime)
      }
    } else if (scene === 'bloom') {
      modelObject.visible = true
      setLilyOpacity(materialsRef.current, 1)
      const clip = gltf.animations.find((animation) => animation.name === 'Bloom')
      if (clip) {
        const frames = getBloomSceneFrames(config.scenes.bloom)
        player.play('Bloom', LoopOnce, 1)
        player.seek(getSyncedBloomClipTime(
          time, frames.opening, clip.duration, reducedMotion,
          config.scenes.bloom.cameraApproachDuration, config.scenes.bloom.cameraBloomSync,
        ))
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
    growthVfxRef.current?.update({
      scene, time, clipTime: growthClipTime, clipDuration: growthClip?.duration ?? 9,
      frames: growthFrames, pixelRatio, reducedMotion, quality: currentState.quality,
    }, config.scenes.growth)
    invalidate()
  }, [config.scenes.bloom, config.scenes.growth, config.scenes.identity, dissolveUniforms, gltf.animations, invalidate, pixelRatio, reducedMotion])

  useLayoutEffect(() => {
    const sync = () => draw(runtime.time)
    sync()
    return subscribeLilyAnimationClock(runtime, sync)
  }, [draw, model, runtime, state.scene, state.mode, reducedMotion])

  return <group ref={wrapperRef} position={LILY_PARTICLE_MODEL_POSITION} scale={LILY_PARTICLE_MODEL_SCALE}>
    <primitive ref={modelRef} object={model} dispose={null} />
  </group>
}
