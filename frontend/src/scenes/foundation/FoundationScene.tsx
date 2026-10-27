import { useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import type { Mesh } from 'three'
import type { PlaybackState } from '../../engine/playback'
import { useSceneTimeline } from '../../engine/useSceneTimeline'

interface Props {
  playback: PlaybackState
  reducedMotion: boolean
}

/** A diagnostic primitive, not the seed, lily, or any other storyboard object. */
export function FoundationScene({ playback, reducedMotion }: Props) {
  const sphere = useRef<Mesh>(null)
  const invalidate = useThree((state) => state.invalidate)
  const build = useCallback(() => {
    const timeline = gsap.timeline({ repeat: -1, yoyo: true, onUpdate: invalidate })
    if (sphere.current) {
      timeline.to(sphere.current.scale, {
        x: 1.035, y: 1.035, z: 1.035, duration: 3, ease: 'sine.inOut',
      })
    }
    return timeline
  }, [invalidate])

  useSceneTimeline(build, { ...playback, reducedMotion })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[-3, 4, 3]} intensity={3} color="#FFF0E8" />
      <directionalLight position={[3, -1, 1]} intensity={1.5} color="#B9A4E8" />
      <mesh ref={sphere}>
        <sphereGeometry args={[0.9, 48, 32]} />
        <meshStandardMaterial color="#F4CDD9" roughness={0.35} metalness={0.15} />
      </mesh>
    </>
  )
}
