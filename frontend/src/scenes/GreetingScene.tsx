import { useCallback, useRef } from 'react'
import type { Group } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { TIMING } from '../engine/filmConfig'
import { useSceneAnimation } from './shared/animation'
import { ParticleCloud, Spark } from './shared/Primitives'

export function GreetingScene({ state, runtime, reducedMotion }: SceneProps) {
  const stars = useRef<Group>(null)
  const draw = useCallback((time: number) => { if (stars.current) stars.current.rotation.z = reducedMotion ? 0 : 0.25 + time * 0.003 }, [reducedMotion])
  useSceneAnimation(runtime, TIMING.greeting.duration, draw)
  return <><group ref={stars} position={[0, 0, -0.5]}><ParticleCloud low={state.quality === 'low'} spiral /></group><Spark position={[2.1, -0.8, 0]} /></>
}
