import { gsap } from 'gsap'
import { expect, it } from 'vitest'
import { initialFilmState } from '../../engine/film'
import { createFilmClock, createFilmRuntime } from '../../engine/runtime'
import { createSceneTimeline } from '../../engine/useSceneTimeline'
import { TIMING } from '../../engine/filmConfig'
import { identityFrame } from './identityFrame'

it('scrubs identity frames on the shared clock, holds pause, changes speed and replays cleanly', () => {
  const runtime = createFilmRuntime()
  const state = { ...initialFilmState, scene: 'identity' as const, mode: 'playing' as const, elapsed: 0, paused: true, revision: 2 }
  const clock = createFilmClock({ state, runtime, dispatch: () => {} })
  let frame = identityFrame(0)
  const cursor = { time: 0 }
  const scene = createSceneTimeline(() => gsap.timeline({ onUpdate: () => { frame = identityFrame(cursor.time) } })
    .to(cursor, { time: 21, duration: 21, ease: 'none' }), runtime)
  clock.timeline.time(12)
  expect(frame.photo).toBeCloseTo(.5)
  expect(frame.ascii).toBeCloseTo(.5)
  clock.timeline.time(14)
  expect(frame.photo).toBe(1)
  expect(clock.timeline.paused()).toBe(true)
  clock.sync({ ...state, speed: 2 })
  expect(clock.timeline.timeScale()).toBe(2)
  expect(frame.photo).toBe(1)
  clock.timeline.time(4)
  expect(frame).toEqual(identityFrame(4))
  scene.dispose()
  clock.dispose()
  const replayClock = createFilmClock({ state: { ...state, revision: 3 }, runtime, dispatch: () => {} })
  const replay = createSceneTimeline(() => gsap.timeline({ onUpdate: () => { frame = identityFrame(cursor.time) } })
    .to(cursor, { time: 21, duration: 21, ease: 'none' }), runtime)
  replayClock.timeline.time(21)
  expect(frame).toEqual(identityFrame(21))
  replay.dispose()
  replayClock.dispose()
})

it('rebuilds the paused identity clock after seek and restart without retaining the previous frame', async () => {
  const { filmReducer } = await import('../../engine/film')
  const runtime = createFilmRuntime()
  let state = { ...filmReducer(initialFilmState, { type: 'dev-jump', scene: 'identity' }, true), paused: true }
  let clock = createFilmClock({ state, runtime, dispatch: () => {} })
  let frame = identityFrame(0)
  const cursor = { time: 0 }
  const scene = createSceneTimeline(() => gsap.timeline({ onUpdate: () => { frame = identityFrame(cursor.time) } })
    .to(cursor, { time: TIMING.identity.duration, duration: TIMING.identity.duration, ease: 'none' }), runtime)
  for (const time of [18, 5]) {
    state = filmReducer(state, { type: 'dev-seek', time }, true)
    clock.dispose()
    clock = createFilmClock({ state, runtime, dispatch: () => {} })
    expect(clock.timeline.paused()).toBe(true)
    expect(runtime.time).toBe(time)
    expect(frame).toEqual(identityFrame(time))
  }
  state = filmReducer(state, { type: 'dev-restart' }, true)
  clock.dispose()
  clock = createFilmClock({ state: { ...state, paused: true }, runtime, dispatch: () => {} })
  expect(runtime.time).toBe(0)
  expect(frame).toEqual(identityFrame(0))
  scene.dispose()
  clock.dispose()
})

it('stops frame updates after disposal and re-enters at the current shared time', () => {
  const runtime = createFilmRuntime()
  const cursor = { time: 0 }
  const frames: number[] = []
  const enter = () => createSceneTimeline(() => gsap.timeline({
    onUpdate: () => frames.push(cursor.time),
  }).to(cursor, { time: TIMING.identity.duration, duration: TIMING.identity.duration, ease: 'none' }), runtime)

  const firstEntry = enter()
  runtime.publish(8)
  expect(frames.at(-1)).toBe(8)
  firstEntry.dispose()
  const firstExitCount = frames.length
  runtime.publish(10)
  expect(frames).toHaveLength(firstExitCount)

  const reentry = enter()
  expect(frames.at(-1)).toBe(10)
  reentry.dispose()
  const secondExitCount = frames.length
  runtime.publish(12)
  expect(frames).toHaveLength(secondExitCount)
})
