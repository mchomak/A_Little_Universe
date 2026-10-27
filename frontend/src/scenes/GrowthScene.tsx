import { poseGrowingLily } from './shared/lilyPose'
import { useCallback, useRef } from 'react'
import type { Group, Mesh } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { TIMING } from '../engine/filmConfig'
import { fade, ramp, smooth, useSceneAnimation } from './shared/animation'
import { Lily, ParticleCloud, Spark } from './shared/Primitives'

export function GrowthScene({ state, runtime, reducedMotion }: SceneProps) {
  const seed = useRef<Mesh>(null)
  const lily = useRef<Group>(null)
  const particles = useRef<Group>(null)
  const draw = useCallback((time: number) => {
    const falling = reducedMotion ? Number(time >= TIMING.growth.fall[1]) : smooth(ramp(time, TIMING.growth.fall))
    if (seed.current) {
      seed.current.position.y = -1.45 * falling
      seed.current.scale.set(0.055 + ramp(time, TIMING.growth.seed) * 0.04, 0.055 + ramp(time, TIMING.growth.seed) * 0.09, 0.055)
      seed.current.visible = time < TIMING.growth.stem[0]
    }
    poseGrowingLily(lily.current, time, reducedMotion)
    if (particles.current) {
      particles.current.scale.setScalar(Math.max(0.02, 1 - ramp(time, TIMING.growth.seed) * 0.96))
      particles.current.position.y = -1.45 * falling
      fade(particles.current, 1 - ramp(time, TIMING.growth.awakening))
    }
  }, [reducedMotion])
  useSceneAnimation(runtime, TIMING.growth.duration, draw)
  return <>
    <mesh ref={seed}><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color="#FFF0E8" emissive="#F4CDD9" emissiveIntensity={0.5} /></mesh>
    <group ref={particles}><ParticleCloud low={state.quality === 'low'} /></group>
    <Lily groupRef={lily} />
    <Spark position={[0.22, -1.45, 0.1]} />
  </>
}
