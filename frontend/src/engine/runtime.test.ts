import { gsap } from 'gsap'
import { expect, it, vi } from 'vitest'
import { filmReducer, initialFilmState, type FilmAction } from './film'
import { createFilmClock, createFilmRuntime } from './runtime'

it('completes an endpoint seek after explicit resume and keeps old revisions inert', () => {
  const runtime = createFilmRuntime()
  let state = { ...initialFilmState, scene: 'eye' as const, mode: 'playing' as const, elapsed: 18, paused: true, revision: 7 }
  const actions: FilmAction[] = []
  const clock = createFilmClock({ state, runtime, dispatch: (action) => actions.push(action) })
  expect(actions).toEqual([])
  state = { ...state, paused: false }
  clock.sync(state)
  expect(actions.at(-1)).toEqual({ type: 'timeline-complete', revision: 7 })
  const count = actions.length
  clock.sync(state)
  clock.sync({ ...state, revision: 8 })
  expect(actions).toHaveLength(count)
  clock.dispose()
})

it('uses one GSAP clock for every frame, throttles state, pauses for hidden/reading and cleans up', () => {
  const runtime = createFilmRuntime()
  const frames: number[] = []
  const off = runtime.subscribeFrame((time) => frames.push(time))
  class Visibility extends EventTarget { hidden = false }
  const visibility = new Visibility()
  const removed = vi.spyOn(visibility, 'removeEventListener')
  const actions: FilmAction[] = []
  let now = 0
  let state = filmReducer(initialFilmState, { type: 'start' })
  const clock = createFilmClock({ state, dispatch: (action) => actions.push(action), runtime, visibility, now: () => now })
  expect(clock.timeline.paused()).toBe(false)
  clock.timeline.time(1)
  now = 20
  clock.timeline.time(2)
  expect(runtime.time).toBe(2)
  expect(frames.at(-1)).toBe(2)
  expect(actions.filter((action) => action.type === 'timeline-update')).toHaveLength(1)
  now = 110
  clock.timeline.time(3)
  expect(actions.filter((action) => action.type === 'timeline-update')).toHaveLength(2)
  state = { ...state, paused: true, speed: 2 }
  clock.sync(state)
  expect(clock.timeline.paused()).toBe(true)
  expect(clock.timeline.timeScale()).toBe(2)
  visibility.hidden = true
  visibility.dispatchEvent(new Event('visibilitychange'))
  state = { ...state, paused: false }
  clock.sync(state)
  expect(clock.timeline.paused()).toBe(true)
  visibility.hidden = false
  visibility.dispatchEvent(new Event('visibilitychange'))
  expect(clock.timeline.paused()).toBe(false)
  clock.sync({ ...state, reading: true })
  expect(clock.timeline.paused()).toBe(true)
  clock.sync(state)
  expect(clock.timeline.paused()).toBe(false)
  clock.timeline.time(16)
  expect(actions.at(-1)).toEqual({ type: 'timeline-complete', revision: state.revision })
  expect(actions.at(-2)).toEqual({ type: 'timeline-update', time: 16, revision: state.revision })
  clock.dispose()
  clock.dispose()
  expect(removed).toHaveBeenCalledTimes(1)
  expect(gsap.globalTimeline.getChildren().includes(clock.timeline)).toBe(false)
  const count = actions.length
  const frameCount = frames.length
  clock.timeline.time(4)
  visibility.dispatchEvent(new Event('visibilitychange'))
  expect(actions).toHaveLength(count)
  expect(frames).toHaveLength(frameCount)
  const restarted = createFilmClock({ state: { ...state, elapsed: 6, revision: 2 }, dispatch: (action) => actions.push(action), runtime, visibility })
  expect(runtime.time).toBe(6)
  restarted.dispose()
  off()
})

it('publishes precise frame time and releases subscriptions idempotently', () => {
  const runtime = createFilmRuntime()
  const received: number[] = []
  const unsubscribe = runtime.subscribeFrame((time) => received.push(time))
  runtime.publish(1.2345)
  expect(runtime.time).toBe(1.2345)
  expect(received).toEqual([1.2345])
  runtime.publish(NaN)
  runtime.publish(Infinity)
  expect(runtime.time).toBe(1.2345)
  unsubscribe()
  unsubscribe()
  runtime.publish(2)
  expect(runtime.time).toBe(2)
  expect(received).toEqual([1.2345])
})
