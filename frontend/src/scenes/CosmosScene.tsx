import { poseLily } from './shared/lilyPose'
import { useCallback, useRef } from 'react'
import type { Group } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { TIMING } from '../engine/filmConfig'
import { fade, ramp, useSceneAnimation } from './shared/animation'
import { Iris, Lily, ParticleCloud, Spark } from './shared/Primitives'

export function CosmosScene({ state, runtime, reducedMotion }: SceneProps) {
  const iris = useRef<Group>(null)
  const spiral = useRef<Group>(null)
  const bouquet = useRef<Group>(null)
  const flower = useRef<Group>(null)
  const draw = useCallback((time: number) => {
    fade(iris.current, 1 - ramp(time, TIMING.cosmos.iris))
    if (spiral.current) {
      spiral.current.visible = time >= TIMING.cosmos.particles[0]
      spiral.current.rotation.z = reducedMotion ? 0 : ramp(time, [TIMING.cosmos.particles[0], TIMING.cosmos.duration]) * 0.25
      spiral.current.scale.setScalar(reducedMotion ? 1 : 0.4 + ramp(time, TIMING.cosmos.particles) * 0.6)
    }
    poseLily(flower.current, 1, 1)
    fade(bouquet.current, ramp(time, TIMING.cosmos.bouquet) * (1 - ramp(time, TIMING.cosmos.settle)))
  }, [reducedMotion])
  useSceneAnimation(runtime, TIMING.cosmos.duration, draw)
  return <>
    <group ref={iris}><Iris /></group>
    <group ref={spiral} position={[0, 0, -0.5]}><ParticleCloud low={state.quality === 'low'} spiral /></group>
    <group ref={bouquet} position={[0, -0.3, 0.6]}>
      <Lily groupRef={flower} />
      {[-1, 1].map((side) => <group key={side} position={[side * 0.95, 0.05, 0]} scale={0.55}>
        {Array.from({ length: 9 }, (_, index) => <mesh key={index} position={[Math.cos(index * 2.4) * 0.28, Math.sin(index * 2.4) * 0.28, index * 0.015]} scale={[0.37, 0.27, 0.19]} rotation={[0, 0, index * 2.4]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={index % 2 ? '#F4CDD9' : '#B9A4E8'} /></mesh>)}
      </group>)}
    </group>
    <Spark position={[0.34, 0.08, 0.03]} />
  </>
}
