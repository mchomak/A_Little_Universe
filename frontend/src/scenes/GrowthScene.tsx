import { poseGrowingLily } from './shared/lilyPose'
import { useCallback, useRef } from 'react'
import { MeshBasicMaterial, type Group, type Mesh } from 'three'
import { useThree } from '@react-three/fiber'
import type { SceneProps } from '../engine/sceneTypes'
import { TIMING } from '../engine/filmConfig'
import { fade, ramp, smooth, useSceneAnimation } from './shared/animation'
import { Lily, ParticleCloud, Spark } from './shared/Primitives'
import { getPrologueLightPose } from './prologue/lightPose'
import { getConfig } from '../systems/scene-config/config'

export function GrowthScene({ state, runtime, reducedMotion }: SceneProps) {
  const pixel = useThree((state) => state.viewport.height / Math.max(1, state.size.height))
  const seed = useRef<Mesh>(null)
  const lily = useRef<Group>(null)
  const particles = useRef<Group>(null)
  const draw = useCallback((time: number) => {
    const falling = reducedMotion ? Number(time >= TIMING.growth.fall[1]) : smooth(ramp(time, TIMING.growth.fall))
    if (seed.current) {
      seed.current.position.y = -1.45 * falling
      const birth = getPrologueLightPose(time, time, state.mode, getConfig().scenes.prologue, reducedMotion, true).transfer
      const initial = pixel * 2.1
      const radius = initial + (0.055 - initial) * birth
      seed.current.scale.set(radius + ramp(time, TIMING.growth.seed) * 0.04, radius + ramp(time, TIMING.growth.seed) * 0.09, radius)
      if (seed.current.material instanceof MeshBasicMaterial) seed.current.material.opacity = birth
      seed.current.visible = time < TIMING.growth.stem[0]
    }
    poseGrowingLily(lily.current, time, reducedMotion)
    if (particles.current) {
      particles.current.scale.setScalar(Math.max(0.02, 1 - ramp(time, TIMING.growth.seed) * 0.96))
      particles.current.position.y = -1.45 * falling
      fade(particles.current, smooth(ramp(time, [0, 0.8])) * (1 - ramp(time, TIMING.growth.awakening)))
    }
  }, [pixel, reducedMotion, state.mode])
  useSceneAnimation(runtime, TIMING.growth.duration, draw)
  return <>
    <mesh ref={seed}><sphereGeometry args={[1, 16, 12]} /><meshBasicMaterial color="#FFF0E8" transparent toneMapped={false} /></mesh>
    <group ref={particles}><ParticleCloud low={state.quality === 'low'} /></group>
    <Lily groupRef={lily} />
    <Spark position={[0.22, -1.45, 0.1]} />
  </>
}

