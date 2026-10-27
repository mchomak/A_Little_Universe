import { gsap } from 'gsap'
import { expect, it } from 'vitest'
import { createFilmRuntime } from './runtime'
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
