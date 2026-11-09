import { useCallback, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSyncExternalStore } from 'react'
import { gsap } from 'gsap'
import { PerspectiveCamera } from 'three'
import type { SceneProps } from './sceneTypes'
import { getBloomSceneFrames, getGrowthSceneFrames } from './filmConfig'
import { useSceneTimeline } from './useSceneTimeline'
import type { CameraPose } from '../scenes/shared/galleryMotion'
import { GALLERY } from '../scenes/gallery/content'
import { galleryMotion, gallerySnapshot } from '../scenes/gallery/controller'
import { configureCameraFarPlane } from '../scenes/gallery/camera'
import { getGalleryNormalFov } from '../scenes/gallery/galleryCameraFit'
import { wakeOnVisible } from '../scenes/gallery/visibility'
import { firstMemoryCamera } from '../scenes/shared/firstMemoryFrame'
import { getGrowthBloomEntryCameraPose, getGrowthCameraPose, getGrowthViewportHeight } from '../scenes/growth/seedProcedure'
import { getBloomCameraApproach, getBloomCloseupPose, getBloomEntryCameraPose } from './bloomCamera'
import { galaxyCameraPose, interpolateCameraPose } from '../scenes/galaxy/camera'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { getIdentityCameraMoveTarget, getIdentityCameraPullbackPose, IDENTITY_CAMERA_PULLBACK_DISTANCE,
  IDENTITY_CAMERA_PULLBACK_SECONDS } from './identityCamera'
import { updateGalleryCameraPose } from './galleryCameraPose'

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
  const galleryEntryPose = useRef<CameraPose | null>(null)
  const galleryFocusDistance = useRef(4.8)
  const galleryFocusCenter = useRef<[number, number]>([0, 0])
  const { scene, mode, revision, paused, reading, speed, planetariumTransition } = state
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
    const bloomApproach = scene === 'bloom' ? getBloomCameraApproach(mode, bloomSettings, bloomFrames.opening) : null
    const timeline = gsap.timeline({ onUpdate: render })
    const previousScene = hasBuiltScene.current ? lastBuiltScene.current : null
    if (scene === 'gallery') {
      if (galleryRevision.current !== revision) {
        if (!reducedMotion) {
          // Match the first card's handoff frame; GalleryScene then carries it
          // smoothly from the Scene 04 photo plane into the gallery layout.
          const identityTarget = getIdentityCameraMoveTarget(flowerCloseup, identitySettings)
          const identityEnd = getIdentityCameraPullbackPose(identityTarget, IDENTITY_CAMERA_PULLBACK_DISTANCE)
          const cameraFit = aspect < 1 ? Math.min(2.5, 1 / Math.max(0.3, aspect)) : 1
          galleryEntryPose.current = {
            ...identityEnd,
            x: identityTarget.tx + (identityEnd.x - identityTarget.tx) * cameraFit,
            y: identityTarget.ty + (identityEnd.y - identityTarget.ty) * cameraFit,
            z: identityTarget.tz + (identityEnd.z - identityTarget.tz) * cameraFit,
          }
          Object.assign(p, identityEnd)
        } else {
          galleryEntryPose.current = firstMemoryCamera(34, reducedMotion)
          Object.assign(p, galleryEntryPose.current)
        }
        galleryFocusDistance.current = 4.8
        galleryFocusCenter.current = [0, 0]
        galleryRevision.current = revision
      }
      lastBuiltScene.current = scene
      hasBuiltScene.current = true
      render()
      return timeline
    }
    lastBuiltScene.current = scene
    hasBuiltScene.current = true
    const galaxyPose = (distance: number, angle: number) => galaxyCameraPose(
      distance, angle, galaxySettings.cameraFocusX, galaxySettings.cameraFocusY,
    )
    const previousPose = { ...p }
    const planetariumCameraHandoff = scene === 'cosmos' && planetariumTransition
    // Cleaning up the finished Growth timeline rewinds its cursor and restores the seed-entry pose.
    // flowerSide is the same authored endpoint, so this keeps the camera continuous across the handoff.
    const bloomEntry = previousScene === 'growth' ? flowerSide : getBloomEntryCameraPose(previousScene, previousPose, flowerSide)
    const initial = scene === 'growth' ? getGrowthCameraPose(0, reducedMotion, growthSettings, growthViewportHeight)
      : scene === 'bloom' ? bloomEntry : scene === 'identity' ? flowerCloseup
      : scene === 'cosmos' ? planetariumCameraHandoff && !reducedMotion
        ? previousPose : galaxyPose(galaxySettings.cameraStartDistance, galaxySettings.cameraStartAngle)
        : scene === 'greeting' || scene === 'ending' ? galaxyPose(galaxySettings.cameraEndDistance, galaxySettings.cameraEndAngle) : front
    Object.assign(p, reducedMotion && scene === 'cosmos' ? galaxyPose(galaxySettings.cameraEndDistance, galaxySettings.cameraEndAngle)
      : reducedMotion && scene !== 'growth' && scene !== 'bloom' ? front : initial)
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
    if (bloomApproach) timeline.to(p, {
      ...bloomApproach.pose,
      duration: bloomApproach.duration,
      ease: 'sine.inOut',
    })
    if (scene === 'identity') timeline.to(p, {
      ...getIdentityCameraMoveTarget(flowerCloseup, identitySettings),
      duration: identitySettings.cameraMoveDuration,
      ease: 'sine.inOut',
    })
    if (scene === 'identity') {
      const identityTarget = getIdentityCameraMoveTarget(flowerCloseup, identitySettings)
      timeline.to(p, {
        ...getIdentityCameraPullbackPose(identityTarget, IDENTITY_CAMERA_PULLBACK_DISTANCE),
        duration: IDENTITY_CAMERA_PULLBACK_SECONDS,
        ease: 'sine.inOut',
      }, identitySettings.cameraMoveDuration)
    }
    if (scene === 'cosmos') {
      const finish = galaxyPose(galaxySettings.cameraEndDistance, galaxySettings.cameraEndAngle)
      const cameraStart = planetariumCameraHandoff
        ? galaxyPose(galaxySettings.cameraStartDistance, galaxySettings.cameraStartAngle)
        : p
      const target = interpolateCameraPose(cameraStart, finish, 0.91)
      const ease = galaxySettings.cameraEase === 'sine' ? 'sine.inOut' : galaxySettings.cameraEase === 'power2' ? 'power2.out' : 'power3.out'
      const duration = galaxySettings.cameraDuration
      const slowdown = Math.min(galaxySettings.cameraSlowdown, duration * 0.6)
      const start = planetariumTransition ? GALLERY.exit : 0
      timeline.to(p, { ...target, duration: duration - slowdown, ease }, start)
      if (slowdown > 0) timeline.to(p, { ...finish, duration: slowdown, ease: 'sine.out' }, start + duration - slowdown)
    }
    return timeline
  }, [aspect, bloomSettings, galaxySettings, growthSettings, growthViewportHeight, identitySettings, mode, planetariumTransition, reducedMotion, render, revision, scene])
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
    if (scene !== 'gallery' || reading || document.hidden) return
    const p = pose.current
    const { camera: focused, target, eased, focal, collageFrame, focusDistance, focusCenter } = updateGalleryCameraPose(p, config.scenes.gallery, {
      delta,
      speed,
      paused,
      reducedMotion,
      aspect,
      focusDistance: galleryFocusDistance.current,
      focusCenter: galleryFocusCenter.current,
      entryPose: galleryEntryPose.current,
    })
    galleryFocusDistance.current = focusDistance
    galleryFocusCenter.current = [focusCenter[0], focusCenter[1]]
    camera.position.set(focused.x, focused.y, focused.z)
    camera.lookAt(...target)
    if (camera instanceof PerspectiveCamera) {
      const normalFov = getGalleryNormalFov(aspect, eased)
      const fitHeight = Math.max(collageFrame.height, collageFrame.width / Math.max(.3, aspect))
      const fitFov = Math.max(4, Math.min(70, 2 * Math.atan(fitHeight / (2 * focused.distance * .75)) * 180 / Math.PI))
      const fov = normalFov + (fitFov - normalFov) * focal
      camera.setFocalLength(camera.getFilmHeight() / (2 * Math.tan(fov * Math.PI / 360))); camera.updateProjectionMatrix()
    }
    invalidate()
    if (gallerySnapshot().phase === 'exit' && galleryMotion.exit >= GALLERY.exit) dispatch({ type: 'gallery-finish' })
  })
  return null
}


