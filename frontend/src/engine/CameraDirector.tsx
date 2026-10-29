import { useCallback, useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import { PerspectiveCamera } from 'three'
import type { SceneProps } from './sceneTypes'
import { TIMING } from './filmConfig'
import { useSceneTimeline } from './useSceneTimeline'
import { createGalleryMove, type CameraPose } from '../scenes/shared/galleryMotion'
import { galleryPosition } from '../scenes/shared/layout'

/** Camera settings belong here, never inside an artistic scene module. */
export function CameraDirector({ state, runtime, reducedMotion }: SceneProps) {
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const aspect = useThree((state) => state.size.width / Math.max(state.size.height, 1))
  const pose = useRef<CameraPose>({ x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 })
  const gallery = useRef<ReturnType<typeof createGalleryMove> | null>(null)
  const galleryRevision = useRef<number | null>(null)
  const { scene, revision, galleryIndex, paused, reading, speed } = state
  const render = useCallback(() => {
    const p = pose.current
    const fit = aspect < 1 ? Math.min(2.5, 1 / Math.max(0.3, aspect)) : 1
    camera.position.set(p.tx + (p.x - p.tx) * fit, p.ty + (p.y - p.ty) * fit, p.tz + (p.z - p.tz) * fit)
    camera.lookAt(p.tx, p.ty, p.tz)
    if (camera instanceof PerspectiveCamera) {
      const fov = aspect < 1 ? 42 : 38
      camera.setFocalLength(camera.getFilmHeight() / (2 * Math.tan(fov * Math.PI / 360)))
      camera.updateProjectionMatrix()
    }
    invalidate()
  }, [aspect, camera, invalidate])

  const build = useCallback(() => {
    const p = pose.current
    const front = { x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 }
    const flowerSide = { ...front, y: 0.2, ty: 0.1 }
    const flowerTop = { x: 1.7, y: 4.5, z: 4, tx: 0, ty: 0.2, tz: 0 }
    const timeline = gsap.timeline({ onUpdate: render })
    if (scene === 'gallery') {
      if (galleryRevision.current !== revision) {
        Object.assign(p, front)
        galleryRevision.current = revision
      }
      render()
      return timeline
    }
    const initial = scene === 'bloom' ? flowerSide : scene === 'identity' ? flowerTop
      : scene === 'eye' ? { ...front, z: 4.8 }
      : scene === 'cosmos' ? { ...front, z: 0.85 }
      : scene === 'greeting' || scene === 'ending' ? { ...front, x: 1, y: 1.1, z: 8.5 } : front
    Object.assign(p, reducedMotion ? front : initial)
    render()
    if (reducedMotion) return timeline
    if (scene === 'growth') timeline.to(p, { ...flowerSide, duration: TIMING.growth.duration, ease: 'sine.inOut' })
    if (scene === 'bloom') timeline.to(p, { ...flowerTop, duration: TIMING.camera.bloom, ease: 'sine.inOut' })
    if (scene === 'identity') timeline.to(p, { ...front, duration: TIMING.identity.cameraSettle, ease: 'sine.inOut' })
    if (scene === 'eye') timeline.to(p, { z: 0.85, duration: TIMING.camera.eye, ease: 'power2.inOut' }, TIMING.eye.approach[0])
    if (scene === 'cosmos') timeline.to(p, { z: 0.7, duration: TIMING.cosmos.iris[1], ease: 'sine.inOut' })
      .to(p, { z: 8.5, x: 1, y: 1.1, duration: TIMING.cosmos.duration - TIMING.cosmos.iris[1], ease: 'sine.inOut' })
    return timeline
  }, [reducedMotion, render, revision, scene])
  useSceneTimeline(build, { runtime })

  useLayoutEffect(() => {
    if (scene !== 'gallery') return
    const [x, y, z] = galleryPosition(galleryIndex)
    const currentPose = pose.current
    // The first photograph keeps the exact final identity camera framing at the handoff.
    const target = galleryIndex === 0
      ? { x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 }
      : { x, y, z: z + 4.8, tx: x, ty: y, tz: z }
    const move = createGalleryMove(currentPose, target, render,
      { paused, reading, speed }, reducedMotion ? 0 : TIMING.camera.gallery, document)
    gallery.current = move
    return () => {
      const current = { ...currentPose }
      move.dispose()
      Object.assign(currentPose, current)
      render()
      gallery.current = null
    }
    // Playback changes synchronize the existing tween below; elapsed never rebuilds it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, revision, galleryIndex, reducedMotion, render])
  useLayoutEffect(() => { gallery.current?.sync({ paused, reading, speed }) }, [paused, reading, speed])
  return null
}
