import { gsap } from 'gsap'
import { expect, it } from 'vitest'
import { createFilmClock, createFilmRuntime } from './runtime'
import { initialFilmState } from './film'
import { createSceneTimeline } from './useSceneTimeline'

it('scrubs a real paused timeline and reverts/unsubscribes across StrictMode remounts', () => {
  const runtime = createFilmRuntime()
  const object = { value: 0 }
  const build = () => gsap.timeline().to(object, { value: 10, duration: 10, ease: 'none' })
  runtime.publish(2)
  const first = createSceneTimeline(build, runtime)
  expect(first.timeline.paused()).toBe(true)
  expect(object.value).toBeCloseTo(2)
  runtime.publish(7.5)
  expect(object.value).toBeCloseTo(7.5)
  first.dispose()
  expect(object.value).toBe(0)
  runtime.publish(9)
  expect(object.value).toBe(0)
  const second = createSceneTimeline(build, runtime)
  expect(object.value).toBeCloseTo(9)
  second.dispose()
  second.dispose()
  runtime.publish(5)
  expect(object.value).toBe(0)
  expect(gsap.globalTimeline.getChildren().includes(second.timeline)).toBe(false)
})

it('keeps galaxy camera frames continuous through greeting, its first phrase, and ending', () => {
  const runtime = createFilmRuntime()
  const cameraPose = { x: 0, y: 0, z: 5.6, tx: 0, ty: 0, tz: 0 }
  const cameraFrame = () => ({ x: cameraPose.x, y: cameraPose.y, z: cameraPose.z,
    tx: cameraPose.tx, ty: cameraPose.ty, tz: cameraPose.tz })
  const preserveCameraPose = () => {
    const lastFrame = { ...cameraPose }
    return () => { Object.assign(cameraPose, lastFrame) }
  }
  const cosmos = createSceneTimeline(
    () => gsap.timeline().to(cameraPose, { x: 8, y: 1.5, z: 14, tx: 0, ty: 0.2, tz: 0, duration: 10, ease: 'none' }),
    runtime,
    preserveCameraPose,
  )

  runtime.publish(9.8)
  const lastCosmosFrame = cameraFrame()
  expect(lastCosmosFrame.x).toBeCloseTo(7.84)
  cosmos.dispose()
  expect(cameraFrame()).toEqual(lastCosmosFrame)

  // A new scene clock begins at zero after the outgoing scene has been disposed.
  runtime.publish(0)
  const greeting = createSceneTimeline(
    () => gsap.timeline().to(cameraPose, { x: 8, y: 1.5, z: 14, tx: 0, ty: 0.2, tz: 0, duration: 0.7, ease: 'none' }),
    runtime,
    preserveCameraPose,
  )
  expect(cameraFrame()).toEqual(lastCosmosFrame)
  runtime.publish(0.1)
  expect(cameraFrame().x).toBeGreaterThanOrEqual(lastCosmosFrame.x)
  runtime.publish(0.7)
  const settledGreetingFrame = cameraFrame()
  expect(settledGreetingFrame).toEqual({ x: 8, y: 1.5, z: 14, tx: 0, ty: 0.2, tz: 0 })
  runtime.publish(1)
  expect(cameraFrame()).toEqual(settledGreetingFrame)
  greeting.dispose()

  runtime.publish(0)
  const ending = createSceneTimeline(
    () => gsap.timeline().to(cameraPose, { ...settledGreetingFrame, duration: 0.7, ease: 'none' }),
    runtime,
    preserveCameraPose,
  )
  expect(cameraFrame()).toEqual(settledGreetingFrame)
  ending.dispose()
})

it('does not rewind the outgoing galaxy camera when the next scene clock publishes zero', () => {
  const runtime = createFilmRuntime()
  const camera = { distance: 6.4 }
  const cosmosClock = createFilmClock({
    state: { ...initialFilmState, scene: 'cosmos', mode: 'playing', elapsed: 25.99, revision: 1 },
    runtime,
    dispatch: () => {},
  })
  const cosmos = createSceneTimeline(
    () => gsap.timeline().to(camera, { distance: 16, duration: 10, ease: 'none' }),
    runtime,
    () => {
      const lastFrame = camera.distance
      return () => { camera.distance = lastFrame }
    },
    'cosmos',
  )
  const lastCosmosFrame = camera.distance
  expect(lastCosmosFrame).toBe(16)

  // useFilm creates the greeting clock before the separate R3F root has
  // disposed its outgoing cosmos timeline.
  const greetingClock = createFilmClock({
    state: { ...initialFilmState, scene: 'greeting', mode: 'playing', elapsed: 0, revision: 2 },
    runtime,
    dispatch: () => {},
  })
  expect(camera.distance).toBe(lastCosmosFrame)
  cosmos.dispose()
  expect(camera.distance).toBe(lastCosmosFrame)

  const greeting = createSceneTimeline(
    () => gsap.timeline().to(camera, { distance: 16, duration: 0.7, ease: 'none' }),
    runtime,
    undefined,
    'greeting',
  )
  expect(camera.distance).toBe(lastCosmosFrame)
  greeting.dispose()
  greetingClock.dispose()
  cosmosClock.dispose()
})
