import { useCallback, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSyncExternalStore } from 'react'
import { gsap } from 'gsap'
import { PerspectiveCamera } from 'three'
import type { SceneProps } from './sceneTypes'
import { TIMING } from './filmConfig'
import { useSceneTimeline } from './useSceneTimeline'
import type { CameraPose } from '../scenes/shared/galleryMotion'
import { GALLERY, GALLERY_MEMORIES, memoryPosition } from '../scenes/gallery/content'
import { advanceGallery, galleryMotion, gallerySnapshot } from '../scenes/gallery/controller'
import { focusCamera } from '../scenes/gallery/camera'
import { wakeOnVisible } from '../scenes/gallery/visibility'
import { firstMemoryCamera } from '../scenes/shared/firstMemoryFrame'
import { getGrowthCameraPose } from '../scenes/growth/seedProcedure'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'

/** Camera settings belong here, never inside an artistic scene module. */
export function CameraDirector({ state, dispatch, runtime, reducedMotion }: SceneProps) {
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const aspect = useThree((state) => state.size.width / Math.max(state.size.height, 1))
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const growthSettings = config.scenes.growth
  const pose = useRef<CameraPose>({ x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 })
  const galleryRevision = useRef<number | null>(null)
  const { scene, revision, paused, reading, speed } = state
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
        Object.assign(p, firstMemoryCamera(34, reducedMotion))
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
    if (scene === 'growth') {
      const cursor = { time: 0 }
      timeline.eventCallback('onUpdate', () => {
        Object.assign(p, getGrowthCameraPose(cursor.time, reducedMotion, growthSettings))
        render()
      })
      Object.assign(p, getGrowthCameraPose(0, reducedMotion, growthSettings))
      return timeline.to(cursor, { time: TIMING.growth.duration, duration: TIMING.growth.duration, ease: 'none' })
    }
    if (reducedMotion) return timeline
    if (scene === 'bloom') timeline.to(p, { ...flowerTop, duration: TIMING.camera.bloom, ease: 'sine.inOut' })
    if (scene === 'identity') timeline.to(p, { ...front, duration: TIMING.identity.particles[1], ease: 'sine.inOut' })
      .to(p, { ...firstMemoryCamera(34), duration: 3, ease: (t: number) => t * t * (3 - 2 * t) }, 31)
    if (scene === 'eye') timeline.to(p, { z: 0.85, duration: TIMING.camera.eye, ease: 'power2.inOut' }, TIMING.eye.approach[0])
    if (scene === 'cosmos') timeline.to(p, { z: 0.7, duration: TIMING.cosmos.iris[1], ease: 'sine.inOut' })
      .to(p, { z: 8.5, x: 1, y: 1.1, duration: TIMING.cosmos.duration - TIMING.cosmos.iris[1], ease: 'sine.inOut' })
    return timeline
  }, [growthSettings, reducedMotion, render, revision, scene])
  useSceneTimeline(build, { runtime })
  useEffect(() => scene === 'gallery' ? wakeOnVisible(document, invalidate) : undefined, [scene, invalidate])

  useFrame((_, delta) => {
    if (scene !== 'gallery' || paused || reading || document.hidden) return
    const dt = Math.min(delta, .05) * speed
    advanceGallery(dt)
    const m = galleryMotion
    const opening = Math.min(1, m.intro / (reducedMotion ? .35 : GALLERY.intro))
    const eased = opening * opening * (3 - 2 * opening)
    const exit = Math.min(1, m.exit / GALLERY.exit)
    const z = GALLERY.startZ - m.progress - exit * 2
    const memory = GALLERY_MEMORIES[m.focusIndex]!
    const [x, y, mz] = memoryPosition(memory)
    const focal = m.focusMix
    const p = pose.current
    const initial = firstMemoryCamera(34, reducedMotion)
    const initialFit = aspect < 1 ? Math.min(2.5, 1 / Math.max(.3, aspect)) : 1
    p.x = initial.x * initialFit * (1 - eased); p.y = initial.y * initialFit * (1 - eased)
    p.z = z + (initial.z * initialFit - GALLERY.startZ) * (1 - eased)
    p.tx = x * focal; p.ty = (y - .2) * focal
    p.tz = (z - 8) * (1 - focal) + mz * focal
    if (opening < 1) { p.tx *= eased; p.ty *= eased; p.tz = -8 * eased }
    const focused = focusCamera([p.x, p.y, p.z], [x, y, mz], focal)
    camera.position.set(focused.x, focused.y, focused.z)
    camera.lookAt(p.tx, p.ty, p.tz)
    if (camera instanceof PerspectiveCamera) {
      const portraitFov = Math.min(82, Math.max(70, 2 * Math.atan(5.1 / (10.65 * Math.max(.3, aspect))) * 180 / Math.PI))
      const initialFov = aspect < 1 ? 42 : 38
      const normalFov = initialFov + ((aspect < 1 ? portraitFov : 48) - initialFov) * eased
      const frameWidth = 3.3 * Math.min(1, memory.aspect), frameHeight = 3.3 / Math.max(1, memory.aspect)
      const fitHeight = Math.max(frameHeight * 1.35, frameWidth / Math.max(.3, aspect))
      const fitFov = Math.max(4, Math.min(70, 2 * Math.atan(fitHeight / (2 * focused.distance * .75)) * 180 / Math.PI))
      const fov = normalFov + (fitFov - normalFov) * focal
      camera.setFocalLength(camera.getFilmHeight() / (2 * Math.tan(fov * Math.PI / 360))); camera.updateProjectionMatrix()
    }
    invalidate()
    if (gallerySnapshot().phase === 'exit' && m.exit >= GALLERY.exit) dispatch({ type: 'gallery-finish' })
  })
  return null
}


