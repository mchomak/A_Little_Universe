import { useCallback, useRef } from 'react'
import type { Mesh } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { TIMING } from '../engine/filmConfig'
import { ramp, useSceneAnimation } from './shared/animation'

export function PrologueScene({ state, dispatch, runtime, reducedMotion }: SceneProps) {
  const seed = useRef<Mesh>(null)
  const draw = useCallback((time: number) => {
    if (seed.current) seed.current.scale.setScalar(reducedMotion ? 1 : 0.8 + ramp(time, TIMING.prologue.seed) * 0.2 + Math.sin(time * 1.2) * 0.04)
  }, [reducedMotion])
  useSceneAnimation(runtime, TIMING.prologue.duration, draw)
  const interact = () => { if (state.mode === 'waiting') dispatch({ type: 'interact' }) }
  return <group onClick={interact}>
    <mesh ref={seed}><sphereGeometry args={[0.035, 16, 12]} /><meshBasicMaterial color="#FFF0E8" /></mesh>
    <mesh><sphereGeometry args={[0.3, 12, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
  </group>
}
