import { useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import { Mesh, Points, type Object3D } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { useSceneTimeline } from '../../engine/useSceneTimeline'

export { ramp, smooth } from './progress'

/** Runtime owns the clock; this callback changes Three objects without React frame state. */
export function useSceneAnimation(runtime: FilmRuntime, duration: number, draw: (time: number) => void) {
  const invalidate = useThree((state) => state.invalidate)
  const build = useCallback(() => {
    const cursor = { time: 0 }
    draw(0)
    invalidate()
    return gsap.timeline({ onUpdate: () => { draw(cursor.time); invalidate() } })
      .to(cursor, { time: duration, duration, ease: 'none' })
  }, [draw, duration, invalidate])
  useSceneTimeline(build, { runtime })
}

export function fade(object: Object3D | null, opacity: number) {
  if (!object) return
  object.visible = opacity > 0.001
  object.traverse((child) => {
    if (!(child instanceof Mesh) && !(child instanceof Points)) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      material.transparent = true
      material.opacity = opacity
      material.depthWrite = opacity > 0.95
    }
  })
}
