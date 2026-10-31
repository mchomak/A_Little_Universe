import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { LoopOnce, LoopRepeat, Material, Mesh, type Group } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { SceneProps } from '../../engine/sceneTypes'
import { getBloomSceneFrames, getGrowthSceneFrames, TIMING } from '../../engine/filmConfig'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import { LILY_MODEL_URL } from '../../assets/lily/lilyAsset'
import { getGrowthClipTime, getIdleClosedClipTime, getSyncedBloomClipTime } from './animationTiming'
import { attachLilyAnimationPlayer, LilyAnimationPlayer } from './animationPlayer'
import { subscribeLilyAnimationClock } from './animationClock'
import { ramp } from '../shared/progress'
import { createLilyGeometryParticleSource } from './particleSource'
import type { LilyParticleSource } from '../shared/identityParticles'

const MODEL_POSITION: [number, number, number] = [0, -1.45, 0]
const MODEL_SCALE = 3

interface LilyMaterialState {
  material: Material
  opacity: number
  transparent: boolean
  depthWrite: boolean
}

function cloneLilyMaterials(root: Group): LilyMaterialState[] {
  const clones = new Map<Material, Material>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const replace = (material: Material) => {
      let clone = clones.get(material)
      if (!clone) {
        clone = material.clone()
        clones.set(material, clone)
      }
      return clone
    }
    object.material = Array.isArray(object.material) ? object.material.map(replace) : replace(object.material)
  })
  return [...clones.values()].map((material) => ({
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
export function AnimatedLily({ state, runtime, reducedMotion, onParticleSource }: SceneProps & { onParticleSource?: (source: LilyParticleSource) => void }) {
  const gltf = useGLTF(LILY_MODEL_URL)
  const invalidate = useThree(({ invalidate }) => invalidate)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const model = useMemo(() => clone(gltf.scene) as Group, [gltf.scene])
  const stateRef = useRef(state)
  const playerRef = useRef<LilyAnimationPlayer | null>(null)
  const modelRef = useRef<Group | null>(null)
  const materialsRef = useRef<LilyMaterialState[]>([])
  const particleSourceRef = useRef<LilyParticleSource | null>(null)
  const waitingForTouch = state.scene === 'bloom' && state.mode === 'waiting'
  useLayoutEffect(() => { stateRef.current = state }, [state])
  useLayoutEffect(() => {
    const materials = cloneLilyMaterials(model)
    materialsRef.current = materials
    return () => {
      for (const { material } of materials) material.dispose()
      if (materialsRef.current === materials) materialsRef.current = []
    }
  }, [model])
  useLayoutEffect(() => attachLilyAnimationPlayer(playerRef, model, gltf.animations), [gltf.animations, model])
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
    particleSourceRef.current = source
    onParticleSource(source)
  }, [gltf.animations, model, onParticleSource, state.scene])

  const draw = useCallback((time: number, presentationTime: number) => {
    const currentState = stateRef.current
    const modelObject = modelRef.current
    const player = playerRef.current
    if (!modelObject || !player) return
    const scene = currentState.scene
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
      const opacity = 1 - ramp(time, [0, TIMING.identity.flower[1]])
      modelObject.visible = opacity > 0.001
      setLilyOpacity(materialsRef.current, opacity)
      if (clip && modelObject.visible) {
        // Scene 04 begins from the same open GLB. Its current particle field is
        // still a documented mock source and is not represented as a GLB dissolve.
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
  }, [config.scenes.bloom, config.scenes.growth, gltf.animations, invalidate, reducedMotion])

  useLayoutEffect(() => {
    const sync = () => draw(runtime.time, runtime.presentationTime)
    sync()
    return subscribeLilyAnimationClock(runtime, sync, waitingForTouch, reducedMotion)
  }, [draw, model, runtime, waitingForTouch, reducedMotion])

  return <group position={MODEL_POSITION} scale={MODEL_SCALE}>
    <primitive ref={modelRef} object={model} dispose={null} />
  </group>
}
