import { useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import type { Group } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { TIMING } from '../engine/filmConfig'
import { fade, ramp, useSceneAnimation } from './shared/animation'
import { Iris } from './shared/Primitives'

export function EyeScene({ runtime, reducedMotion }: SceneProps) {
  const iris = useRef<Group>(null)
  const invalidate = useThree((state) => state.invalidate)
  const draw = useCallback((time: number) => {
    fade(iris.current, ramp(time, [0, TIMING.transition]))
    if (iris.current) {
      // Approach always settles the pointer imitation before the cosmos handoff.
      const settle = ramp(time, TIMING.eye.approach)
      iris.current.rotation.x *= 1 - settle
      iris.current.rotation.y *= 1 - settle
    }
  }, [])
  useSceneAnimation(runtime, TIMING.eye.duration, draw)
  return <group onPointerMove={(event) => {
    if (!iris.current || reducedMotion || runtime.time >= TIMING.eye.approach[0]) return
    iris.current.rotation.set(event.pointer.y * -0.09, event.pointer.x * 0.09, 0)
    invalidate()
  }} onPointerLeave={() => { iris.current?.rotation.set(0, 0, 0); invalidate() }}>
    <mesh><planeGeometry args={[20, 20]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    <group ref={iris}><Iris /></group>
  </group>
}
