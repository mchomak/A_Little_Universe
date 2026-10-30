import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { LoopOnce, LoopRepeat, type Group } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { SceneProps } from '../../engine/sceneTypes'
import { getBloomSceneFrames, getGrowthSceneFrames } from '../../engine/filmConfig'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import { LILY_MODEL_URL } from '../../assets/lily/lilyAsset'
import { getBloomClipTime, getGrowthClipTime, getIdleClosedClipTime } from './animationTiming'
import { attachLilyAnimationPlayer, LilyAnimationPlayer } from './animationPlayer'
import { subscribeLilyAnimationClock } from './animationClock'

const MODEL_POSITION: [number, number, number] = [0, -1.45, 0]
const MODEL_SCALE = 3

/** A single GLB instance spans scene 02's growth and scene 03's touch gate. */
export function AnimatedLily({ state, dispatch, runtime, reducedMotion }: SceneProps) {
  const gltf = useGLTF(LILY_MODEL_URL)
  const invalidate = useThree(({ invalidate }) => invalidate)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const model = useMemo(() => clone(gltf.scene) as Group, [gltf.scene])
  const stateRef = useRef(state)
  const playerRef = useRef<LilyAnimationPlayer | null>(null)
  const modelRef = useRef<Group | null>(null)
  const waitingForTouch = state.scene === 'bloom' && state.mode === 'waiting'
  useLayoutEffect(() => { stateRef.current = state }, [state])
  useLayoutEffect(() => attachLilyAnimationPlayer(playerRef, model, gltf.animations), [gltf.animations, model])

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
      if (visible && clip) {
        player.play('Growth', LoopOnce, 1)
        player.seek(getGrowthClipTime(time, frames, clip.duration))
      }
    } else if (scene === 'bloom') {
      modelObject.visible = true
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
          player.seek(getBloomClipTime(time, frames.opening, clip.duration, reducedMotion))
        }
      }
    } else {
      modelObject.visible = false
      player.stop()
    }
    invalidate()
  }, [config.scenes.bloom, config.scenes.growth, gltf.animations, invalidate, reducedMotion])

  useLayoutEffect(() => {
    const sync = () => draw(runtime.time, runtime.presentationTime)
    sync()
    return subscribeLilyAnimationClock(runtime, sync, waitingForTouch, reducedMotion)
  }, [draw, model, runtime, waitingForTouch, reducedMotion])

  return <group position={MODEL_POSITION} scale={MODEL_SCALE} onClick={(event) => {
    event.stopPropagation()
    const current = stateRef.current
    if (current.scene === 'bloom' && current.mode === 'waiting') dispatch({ type: 'interact' })
  }}>
    <primitive ref={modelRef} object={model} dispose={null} />
  </group>
}
