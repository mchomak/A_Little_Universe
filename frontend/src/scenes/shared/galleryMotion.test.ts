import { expect, it } from 'vitest'
import { gsap } from 'gsap'
import { createGalleryMove } from './galleryMotion'

it('freezes gallery focus on manual pause, reading and hidden, then cleans up on remount', () => {
  const events = new EventTarget()
  let hidden = false
  let listeners = 0
  const visibility = {
    get hidden() { return hidden },
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) { listeners++; events.addEventListener(type, listener) },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) { listeners--; events.removeEventListener(type, listener) },
  }
  const pose = { x: 0, y: 0, z: 5, tx: 0, ty: 0, tz: 0 }
  const target = { x: 1, y: 0, z: -5, tx: 1, ty: 0, tz: -10 }
  const options = { paused: true, reading: false, speed: 2 }
  const first = createGalleryMove(pose, target, () => {}, options, 1.2, visibility)
  expect(first.timeline.paused()).toBe(true)
  expect(first.timeline.timeScale()).toBe(2)
  first.sync({ ...options, paused: false })
  expect(first.timeline.paused()).toBe(false)
  hidden = true
  events.dispatchEvent(new Event('visibilitychange'))
  expect(first.timeline.paused()).toBe(true)
  hidden = false
  first.sync({ ...options, paused: false, reading: true })
  expect(first.timeline.paused()).toBe(true)
  first.timeline.time(0.6)
  expect(pose.z).toBeLessThan(5)
  first.dispose()
  first.dispose()
  expect(listeners).toBe(0)
  expect(pose.z).toBe(5)
  expect(gsap.globalTimeline.getChildren()).not.toContain(first.timeline)
  const second = createGalleryMove(pose, target, () => {}, options, 1.2, visibility)
  expect(listeners).toBe(1)
  second.dispose()
  expect(listeners).toBe(0)
})
