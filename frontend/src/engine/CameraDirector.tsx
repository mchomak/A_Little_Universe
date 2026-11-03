import { useCallback, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSyncExternalStore } from 'react'
import { gsap } from 'gsap'
import { PerspectiveCamera } from 'three'
import type { SceneProps } from './sceneTypes'
import { getBloomSceneFrames, getGrowthSceneFrames, TIMING } from './filmConfig'
import { useSceneTimeline } from './useSceneTimeline'
import type { CameraPose } from '../scenes/shared/galleryMotion'
import { GALLERY, GALLERY_MEMORIES, memoryPosition } from '../scenes/gallery/content'
import { advanceGallery, galleryMotion, gallerySnapshot } from '../scenes/gallery/controller'
import { configureCameraFarPlane, focusCamera } from '../scenes/gallery/camera'
import { GALLERY_ART } from '../scenes/gallery/artDirection'
import { wakeOnVisible } from '../scenes/gallery/visibility'
import { firstMemoryCamera } from '../scenes/shared/firstMemoryFrame'
import { getGrowthBloomEntryCameraPose, getGrowthCameraPose, getGrowthViewportHeight } from '../scenes/growth/seedProcedure'
import { getBloomCameraMoveDuration, getBloomCloseupPose, getBloomEntryCameraPose } from './bloomCamera'
import { galaxyCameraPose, interpolateCameraPose } from '../scenes/galaxy/camera'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { getIdentityCameraMoveTarget } from './identityCamera'

/** Camera settings belong here, never inside an artistic scene module. */
export function CameraDirector({ state, dispatch, runtime, reducedMotion }: SceneProps) {
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const aspect = useThree((state) => state.size.width / Math.max(state.size.height, 1))
  const growthViewportHeight = useThree(({ size }) => getGrowthViewportHeight(size.width, size.height))
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const growthSettings = config.scenes.growth
  const bloomSettings = config.scenes.bloom
  const identitySettings = config.scenes.identity
  const galaxySettings = config.scenes.galaxy
  const pose = useRef<CameraPose>({ x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 })
  const galleryRevision = useRef<number | null>(null)
  const { scene, revision, paused, reading, speed } = state
  const lastBuiltScene = useRef(scene)
  const hasBuiltScene = useRef(false)
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
    const flowerSide = getGrowthBloomEntryCameraPose(growthSettings, reducedMotion, growthViewportHeight)
    const bloomFrames = getBloomSceneFrames(bloomSettings)
    const flowerCloseup = getBloomCloseupPose(bloomSettings)
    const timeline = gsap.timeline({ onUpdate: render })
    if (scene === 'gallery') {
      if (galleryRevision.current !== revision) {
        Object.assign(p, firstMemoryCamera(34, reducedMotion))
        galleryRevision.current = revision
      }
      render()
      return timeline
    }
    const previousScene = hasBuiltScene.current ? lastBuiltScene.current : null
    lastBuiltScene.current = scene
    hasBuiltScene.current = true
    const galaxyPose = (distance: number, angle: number) => galaxyCameraPose(
      distance, angle, galaxySettings.cameraFocusX, galaxySettings.cameraFocusY,
    )
    const previousPose = { ...p }
    const initial = scene === 'growth' ? getGrowthCameraPose(0, reducedMotion, growthSettings, growthViewportHeight)
      : scene === 'bloom' ? getBloomEntryCameraPose(previousScene, previousPose, flowerSide) : scene === 'identity' ? flowerCloseup
      : scene === 'eye' ? { ...front, z: 4.8 }
      : scene === 'cosmos' ? galaxyPose(galaxySettings.cameraStartDistance, galaxySettings.cameraStartAngle)
        : scene === 'greeting' || scene === 'ending' ? galaxyPose(galaxySettings.cameraEndDistance, galaxySettings.cameraEndAngle) : front
    const preserveEyeEntry = scene === 'cosmos' && previousScene === 'eye' && !reducedMotion
    Object.assign(p, reducedMotion && scene === 'cosmos' ? galaxyPose(galaxySettings.cameraEndDistance, galaxySettings.cameraEndAngle)
      : reducedMotion && scene !== 'growth' && scene !== 'bloom' ? front : initial)
    if (preserveEyeEntry) Object.assign(p, previousPose)
    render()
    if (scene === 'growth') {
      const cursor = { time: 0 }
      timeline.eventCallback('onUpdate', () => {
        Object.assign(p, getGrowthCameraPose(cursor.time, reducedMotion, growthSettings, growthViewportHeight))
        render()
      })
      Object.assign(p, getGrowthCameraPose(0, reducedMotion, growthSettings, growthViewportHeight))
      const duration = getGrowthSceneFrames(growthSettings).duration
      return timeline.to(cursor, { time: duration, duration, ease: 'none' })
    }
    if (reducedMotion) return timeline
    if (scene === 'bloom') timeline.to(p, {
      ...flowerCloseup,
      duration: getBloomCameraMoveDuration(bloomSettings, bloomFrames.opening),
      ease: 'sine.inOut',
    })
    if (scene === 'identity') timeline.to(p, {
      ...getIdentityCameraMoveTarget(flowerCloseup, identitySettings),
      duration: identitySettings.cameraMoveDuration,
      ease: 'sine.inOut',
    })
    if (scene === 'eye') timeline.to(p, { z: 0.85, duration: TIMING.camera.eye, ease: 'power2.inOut' }, TIMING.eye.approach[0])
    if (scene === 'cosmos') {
      const finish = galaxyPose(galaxySettings.cameraEndDistance, galaxySettings.cameraEndAngle)
      const target = interpolateCameraPose(p, finish, 0.91)
      const ease = galaxySettings.cameraEase === 'sine' ? 'sine.inOut' : galaxySettings.cameraEase === 'power2' ? 'power2.out' : 'power3.out'
      const slowdown = Math.min(galaxySettings.cameraSlowdown, galaxySettings.cameraDuration * 0.6)
      timeline.to(p, { ...target, duration: galaxySettings.cameraDuration - slowdown, ease })
      if (slowdown > 0) timeline.to(p, { ...finish, duration: slowdown, ease: 'sine.out' })
    }
    return timeline
  }, [bloomSettings, galaxySettings, growthSettings, growthViewportHeight, identitySettings, reducedMotion, render, revision, scene])
  useSceneTimeline(build, { runtime })
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    const restoreFarPlane = configureCameraFarPlane(camera, scene)
    if (scene !== 'gallery') return
    invalidate()
    return () => { restoreFarPlane(); invalidate() }
  }, [camera, invalidate, scene])
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
    const focused = focusCamera([p.x, p.y, p.z], [x, y, mz], focal, -memory.side * GALLERY_ART.wallYaw)
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


