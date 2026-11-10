import { useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import { Mesh, Points, type Object3D } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { useSceneTimeline } from '../../engine/useSceneTimeline'

export { ramp, smooth } from './progress'

/** Ignore stale callbacks from a scene whose props have not yet caught up to the shared film clock. */
export function createSceneDraw(
  runtime: FilmRuntime,
  scene: FilmRuntime['scene'] | undefined,
  draw: (time: number) => void,
  allowForeignScene: () => boolean = () => false,
) {
  return (time: number) => {
    if (!isSceneFrameAllowed(runtime, scene, allowForeignScene())) return
    draw(time)
  }
}

export function isSceneFrameAllowed(runtime: FilmRuntime, scene: FilmRuntime['scene'] | undefined, allowForeignScene = false) {
  return !scene || !runtime.scene || runtime.scene === scene || allowForeignScene
}

export function createSceneAnimationTimeline(duration: number, draw: (time: number) => void, invalidate: () => void = () => {}) {
  const cursor = { time: 0 }
  draw(0)
  invalidate()
  return gsap.timeline({ onUpdate: () => { draw(cursor.time); invalidate() } })
    .to(cursor, { time: duration, duration, ease: 'none' })
}

/** Runtime owns the clock; this callback changes Three objects without React frame state. */
export function useSceneAnimation(runtime: FilmRuntime, duration: number, draw: (time: number) => void, scene?: Exclude<FilmRuntime['scene'], null>) {
  const invalidate = useThree((state) => state.invalidate)
  const sceneDraw = useCallback((time: number) => {
    if (!isSceneFrameAllowed(runtime, scene)) return
    draw(time)
  }, [draw, runtime, scene])
  const build = useCallback(() => createSceneAnimationTimeline(duration, sceneDraw, invalidate), [duration, invalidate, sceneDraw])
  useSceneTimeline(build, { runtime, scene: scene ?? null })
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
