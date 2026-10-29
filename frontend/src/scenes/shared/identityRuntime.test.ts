import { gsap } from 'gsap'
import { expect, it } from 'vitest'
import { initialFilmState } from '../../engine/film'
import { createFilmClock, createFilmRuntime } from '../../engine/runtime'
import { createSceneTimeline } from '../../engine/useSceneTimeline'
import { identityFrame } from './identityFrame'
import { nameAssembly, nameFocus, nameSparkPosition, nameWave } from './identityName'

it('scrubs identity frames on the shared clock, holds pause, changes speed and replays cleanly', () => {
  const runtime = createFilmRuntime()
  const state = { ...initialFilmState, scene: 'identity' as const, mode: 'playing' as const, elapsed: 0, paused: true, revision: 2 }
  const clock = createFilmClock({ state, runtime, dispatch: () => {} })
  let frame = identityFrame(0)
  const cursor = { time: 0 }
  const scene = createSceneTimeline(() => gsap.timeline({ onUpdate: () => { frame = identityFrame(cursor.time) } })
    .to(cursor, { time: 34, duration: 34, ease: 'none' }), runtime)
  clock.timeline.time(23)
  expect(frame.photo).toBeCloseTo(.35)
  expect(frame.ascii).toBe(1)
  clock.timeline.time(26)
  expect(frame.photo).toBeCloseTo(.74)
  expect(clock.timeline.paused()).toBe(true)
  clock.sync({ ...state, speed: 2 })
  expect(clock.timeline.timeScale()).toBe(2)
  expect(frame.photo).toBeCloseTo(.74)
  clock.timeline.time(4)
  expect(frame).toEqual(identityFrame(4))
  scene.dispose()
  clock.dispose()
  const replayClock = createFilmClock({ state: { ...state, revision: 3 }, runtime, dispatch: () => {} })
  const replay = createSceneTimeline(() => gsap.timeline({ onUpdate: () => { frame = identityFrame(cursor.time) } })
    .to(cursor, { time: 34, duration: 34, ease: 'none' }), runtime)
  replayClock.timeline.time(34)
  expect(frame).toEqual(identityFrame(34))
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
    .to(cursor, { time: 34, duration: 34, ease: 'none' }), runtime)
  for (const time of [25, 10]) {
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

it('seeks name assembly, its single wave and blue motif backwards without retaining motion history', () => {
  const runtime = createFilmRuntime()
  const state = { ...initialFilmState, scene: 'identity' as const, mode: 'playing' as const, paused: true, revision: 2 }
  const clock = createFilmClock({ state, runtime, dispatch: () => {} })
  const sample = (time: number) => ({
    streams: [0, 1, 2].map((stream) => nameAssembly(time, stream, .5)),
    focus: nameFocus(time), wave: nameWave(time, 1), spark: nameSparkPosition(time),
  })
  let frame = sample(0)
  const cursor = { time: 0 }
  const scene = createSceneTimeline(() => gsap.timeline({ onUpdate: () => { frame = sample(cursor.time) } })
    .to(cursor, { time: 34, duration: 34, ease: 'none' }), runtime)
  for (const time of [7.9, 8, 8.6, 9.4, 10.2, 12.9, 13, 17, 8.6, 10.2, 7.9]) {
    clock.timeline.time(time)
    expect(frame).toEqual(sample(time))
    expect(clock.timeline.paused()).toBe(true)
  }
  scene.dispose()
  clock.dispose()
})
