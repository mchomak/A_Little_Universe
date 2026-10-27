import { poseLily } from './shared/lilyPose'
import { useCallback, useRef } from 'react'
import type { Group } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { TIMING } from '../engine/filmConfig'
import { fade, ramp, useSceneAnimation } from './shared/animation'
import { Lily, ParticleCloud, PlaceholderCard, Spark } from './shared/Primitives'

export function IdentityScene({ state, runtime, reducedMotion }: SceneProps) {
  const lily = useRef<Group>(null)
  const cloud = useRef<Group>(null)
  const portrait = useRef<Group>(null)
  const photo = useRef<Group>(null)
  const draw = useCallback((time: number) => {
    poseLily(lily.current, 1, 1)
    fade(lily.current, 1 - ramp(time, TIMING.identity.flower))
    if (cloud.current) {
      cloud.current.visible = time >= TIMING.identity.particles[0] && time < TIMING.identity.portrait[0]
      cloud.current.rotation.z = reducedMotion ? 0 : ramp(time, TIMING.identity.particles) * 0.8
      cloud.current.scale.set(1 + ramp(time, TIMING.identity.particles) * 0.4, 1 - ramp(time, TIMING.identity.name) * 0.8, 1)
    }
    fade(portrait.current, time >= TIMING.identity.portrait[0] ? 1 - ramp(time, [TIMING.identity.photo[0], TIMING.identity.photo[0] + TIMING.transition]) : 0)
    fade(photo.current, ramp(time, [TIMING.identity.photo[0], TIMING.identity.photo[0] + TIMING.transition]))
  }, [reducedMotion])
  useSceneAnimation(runtime, TIMING.identity.duration, draw)
  return <>
    <Lily groupRef={lily} />
    <group ref={cloud}><ParticleCloud low={state.quality === 'low'} /></group>
    <group ref={portrait}><PlaceholderCard portrait /></group>
    <group ref={photo}><PlaceholderCard /></group>
    <Spark position={[1.35, -0.35, 0.1]} />
  </>
}
