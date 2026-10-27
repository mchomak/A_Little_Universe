import { poseLily } from './shared/lilyPose'
import { useCallback, useRef } from 'react'
import type { Group } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { TIMING } from '../engine/filmConfig'
import { ramp, smooth, useSceneAnimation } from './shared/animation'
import { Lily, Spark } from './shared/Primitives'

export function BloomScene({ state, dispatch, runtime, reducedMotion }: SceneProps) {
  const lily = useRef<Group>(null)
  const waiting = state.mode === 'waiting'
  const draw = useCallback((time: number) => {
    const opening = waiting ? 0 : reducedMotion ? 1 : smooth(ramp(time, TIMING.bloom.opening))
    poseLily(lily.current, 1, opening)
  }, [reducedMotion, waiting])
  useSceneAnimation(runtime, TIMING.bloom.duration, draw)
  return <>
    <Lily groupRef={lily} onClick={(event) => { event.stopPropagation(); if (waiting) dispatch({ type: 'interact' }) }} />
    <Spark position={[0.1, 0.16, 0.1]} />
  </>
}
