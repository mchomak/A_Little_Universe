import { Quaternion, Vector3 } from 'three'
import { expect, it } from 'vitest'
import { TIMING } from '../../engine/filmConfig'
import { createFilmClock, createFilmRuntime } from '../../engine/runtime'
import { initialFilmState } from '../../engine/film'
import { createSceneTimeline } from '../../engine/useSceneTimeline'
import { createSceneAnimationTimeline, createSceneDraw } from '../shared/animation'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../../systems/scene-config/config'
import {
  applyGalaxyBoundaryTransform,
  captureGalaxyBoundaryFrame,
  getGalaxyFrameValues,
  type GalaxyBoundaryFrame,
  type GalaxyFrameValues,
} from './animation'
import { getPlanetariumHandoffProgressAtTime } from './camera'

const settings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.galaxy

function createGalaxyDraw(
  scene: 'cosmos' | 'greeting',
  boundary: GalaxyBoundaryFrame,
  visible: { frame: GalaxyFrameValues | null; position: Vector3; rotation: Quaternion },
  reducedMotion = false,
  planetariumRoute = false,
  planetariumStart = { position: new Vector3(2, 3, 4), rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.35) },
) {
  return (time: number) => {
    const frame = getGalaxyFrameValues(scene, time, settings, TIMING.cosmos.duration, TIMING.greeting.duration, {
      boundary,
      reducedMotion,
      boundaryTransitionDuration: TIMING.transition,
      revealTimeOffset: planetariumRoute ? settings.galaxyRevealAt : 0,
      transitionOpacity: 1,
    })
    visible.frame = frame
    if (scene === 'cosmos' && planetariumRoute) {
      const handoffProgress = getPlanetariumHandoffProgressAtTime(time, 10, 14)
      visible.position.copy(planetariumStart.position).lerp(new Vector3(), handoffProgress)
      visible.rotation.copy(planetariumStart.rotation).slerp(new Quaternion(), handoffProgress)
    } else if (scene === 'cosmos') {
      visible.position.set(0, 0, 0)
      visible.rotation.identity()
    } else if (scene === 'greeting' && boundary.valid) {
      applyGalaxyBoundaryTransform(boundary, new Vector3(), new Quaternion(), frame.boundaryProgress, visible.position, visible.rotation)
    }
    if (scene === 'cosmos') captureGalaxyBoundaryFrame(boundary, frame, visible.position, visible.rotation)
  }
}

function scopedGalaxyDraw(
  runtime: ReturnType<typeof createFilmRuntime>, scene: 'cosmos' | 'greeting',
  boundary: GalaxyBoundaryFrame, visible: { frame: GalaxyFrameValues | null; position: Vector3; rotation: Quaternion },
  reducedMotion = false, planetariumRoute = false, allowGalleryFrames = false,
  planetariumStart?: { position: Vector3; rotation: Quaternion },
) {
  return createSceneDraw(
    runtime, scene, createGalaxyDraw(scene, boundary, visible, reducedMotion, planetariumRoute, planetariumStart),
    () => allowGalleryFrames && runtime.scene === 'gallery',
  )
}

function createBoundary(): GalaxyBoundaryFrame {
  return {
    valid: false, motionTime: 0, phaseTime: 0, light: 1, fogOpacity: 0, reveal: 1, firstStars: 1,
    position: new Vector3(), rotation: new Quaternion(),
  }
}

it('keeps galaxy reveal, light, motion and transform across the live cosmos-to-greeting lifecycle', () => {
  const runtime = createFilmRuntime()
  const boundary = createBoundary()
  const visible = { frame: null as GalaxyFrameValues | null, position: new Vector3(), rotation: new Quaternion() }
  const cosmosClock = createFilmClock({
    state: { ...initialFilmState, scene: 'cosmos', mode: 'playing', elapsed: TIMING.cosmos.duration - 0.01, revision: 1 },
    runtime, dispatch: () => {},
  })
  const cosmosDraw = scopedGalaxyDraw(runtime, 'cosmos', boundary, visible)
  const cosmos = createSceneTimeline(
    () => createSceneAnimationTimeline(TIMING.cosmos.duration, cosmosDraw), runtime,
  )
  const lastCosmosFrame = { ...visible.frame! }
  const lastCosmosPosition = visible.position.clone()
  const lastCosmosRotation = visible.rotation.clone()
  expect(lastCosmosFrame.reveal).toBe(1)
  expect(lastCosmosFrame.firstStars).toBe(1)

  const greetingClock = createFilmClock({
    state: { ...initialFilmState, scene: 'greeting', mode: 'playing', elapsed: 0, revision: 2 },
    runtime, dispatch: () => {},
  })
  // The old subscriber is alive during the new clock's synchronous publish(0).
  cosmosDraw(0) // R3F layout and ambient ticker paths may still call the old closure before prop cleanup.
  expect(visible.frame).toEqual(lastCosmosFrame)
  expect(boundary.reveal).toBe(lastCosmosFrame.reveal)
  cosmos.dispose()
  expect(visible.frame).toEqual(lastCosmosFrame)
  expect(boundary.reveal).toBe(lastCosmosFrame.reveal)

  const greetingDraw = scopedGalaxyDraw(runtime, 'greeting', boundary, visible)
  const greeting = createSceneTimeline(
    () => createSceneAnimationTimeline(TIMING.greeting.duration, greetingDraw), runtime,
  )
  expect(visible.frame!.reveal).toBeCloseTo(lastCosmosFrame.reveal)
  expect(visible.frame!.light).toBeCloseTo(lastCosmosFrame.light)
  expect(visible.frame!.motionTime).toBeCloseTo(lastCosmosFrame.motionTime)
  expect(visible.position.distanceTo(lastCosmosPosition)).toBeLessThan(1e-9)
  expect(visible.rotation.angleTo(lastCosmosRotation)).toBeLessThan(1e-9)
  runtime.publish(TIMING.transition * 0.25, TIMING.transition * 0.25, 'greeting')
  expect(visible.frame!.reveal).toBeGreaterThan(0.99)
  expect(visible.frame!.light).toBeGreaterThan(0.7)
  expect(visible.frame!.diskBrightness).toBeGreaterThan(0)

  greeting.dispose()
  greetingClock.dispose()
  cosmosClock.dispose()
})

it('keeps reduced-motion galaxy appearance and transform stable at the greeting boundary', () => {
  const runtime = createFilmRuntime()
  const boundary = createBoundary()
  const visible = { frame: null as GalaxyFrameValues | null, position: new Vector3(), rotation: new Quaternion() }
  runtime.publish(TIMING.cosmos.duration - 0.01, TIMING.cosmos.duration - 0.01, 'cosmos')
  const cosmosDraw = scopedGalaxyDraw(runtime, 'cosmos', boundary, visible, true)
  const cosmos = createSceneTimeline(
    () => createSceneAnimationTimeline(TIMING.cosmos.duration, cosmosDraw), runtime,
  )
  const lastFrame = { ...visible.frame! }
  const lastPosition = visible.position.clone()
  const lastRotation = visible.rotation.clone()
  expect(lastFrame.motionTime).toBe(0)

  runtime.publish(0, 0, 'greeting')
  cosmos.dispose()
  const greetingDraw = scopedGalaxyDraw(runtime, 'greeting', boundary, visible, true)
  const greeting = createSceneTimeline(
    () => createSceneAnimationTimeline(TIMING.greeting.duration, greetingDraw), runtime,
  )
  expect(visible.frame!.reveal).toBe(lastFrame.reveal)
  expect(visible.frame!.light).toBeCloseTo(lastFrame.light)
  expect(visible.frame!.motionTime).toBe(0)
  expect(visible.position.distanceTo(lastPosition)).toBeLessThan(1e-9)
  expect(visible.rotation.angleTo(lastRotation)).toBeLessThan(1e-9)
  greeting.dispose()
})

it('preserves the planetarium handoff transform when Cosmos takes over from the gallery clock', () => {
  const runtime = createFilmRuntime()
  const boundary = createBoundary()
  const visible = { frame: null as GalaxyFrameValues | null, position: new Vector3(), rotation: new Quaternion() }
  runtime.publish(0, 0, 'gallery')

  const planetariumStart = { position: new Vector3(2, 3, 4), rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.35) }
  // Gallery's useFrame path draws the final planetarium frame while the runtime still belongs to Gallery.
  const galleryRouteDraw = scopedGalaxyDraw(runtime, 'cosmos', boundary, visible, false, true, true, planetariumStart)
  galleryRouteDraw(10)
  const galleryEndpoint = { ...visible.frame! }
  const galleryPosition = visible.position.clone()
  const galleryRotation = visible.rotation.clone()

  const cosmosClock = createFilmClock({
    state: { ...initialFilmState, scene: 'cosmos', mode: 'playing', elapsed: 10, revision: 1, planetariumTransition: true },
    runtime, dispatch: () => {},
  })
  const cosmosDraw = scopedGalaxyDraw(runtime, 'cosmos', boundary, visible, false, true, false, planetariumStart)
  const cosmos = createSceneTimeline(
    () => createSceneAnimationTimeline(TIMING.cosmos.duration, cosmosDraw), runtime,
  )
  expect(visible.frame!.reveal).toBeCloseTo(galleryEndpoint.reveal)
  expect(visible.frame!.light).toBeCloseTo(galleryEndpoint.light)
  expect(visible.frame!.motionTime).toBeCloseTo(galleryEndpoint.motionTime)
  expect(visible.position.distanceTo(galleryPosition)).toBeLessThan(1e-9)
  expect(visible.rotation.angleTo(galleryRotation)).toBeLessThan(1e-6)
  cosmos.dispose()
  cosmosClock.dispose()
})
