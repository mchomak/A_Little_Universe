import { expect, it } from 'vitest'
import { createBloomGesture, createBloomTextClock, isBloomGestureReady } from './bloomGesture'

const point = (pointerId: number, clientX: number, clientY: number) => ({ pointerId, clientX, clientY })

it('accepts one deliberate drag that starts inside the bud target', () => {
  const gesture = createBloomGesture()
  expect(gesture.begin(point(4, 120, 90), true)).toBe(true)
  expect(gesture.move(point(4, 128, 100))).toBe(false)
  expect(gesture.move(point(4, 140, 100))).toBe(true)
  expect(gesture.end(point(4, 140, 100))).toBe(true)
  expect(gesture.end(point(4, 140, 100))).toBe(false)

  gesture.begin(point(5, 0, 0), true)
  expect(gesture.end(point(5, 0, 22))).toBe(true)
})

it('rejects taps, unrelated pointers, canceled drags, and gestures before the invitation is ready', () => {
  const gesture = createBloomGesture()
  expect(gesture.begin(point(1, 0, 0), false)).toBe(false)
  expect(gesture.begin(point(1, 0, 0), true)).toBe(true)
  expect(gesture.move(point(2, 50, 50))).toBe(false)
  expect(gesture.end(point(2, 50, 50))).toBe(false)
  expect(gesture.end(point(1, 0, 0))).toBe(false)

  gesture.begin(point(3, 0, 0), true)
  gesture.move(point(3, 25, 0))
  gesture.cancel()
  expect(gesture.end(point(3, 25, 0))).toBe(false)
  expect(isBloomGestureReady(2.99, 3)).toBe(false)
  expect(isBloomGestureReady(3, 3)).toBe(true)
})

it('keeps waiting time continuous through the touch and preserves local seeks', () => {
  const clock = createBloomTextClock(20, 'waiting', 3)
  clock.update(23.5, 0)
  expect(clock.waitingElapsed()).toBeCloseTo(3.5)
  clock.setState('playing', 4)
  clock.update(0, 0)
  expect(clock.time()).toBeCloseTo(3.5)
  clock.update(0, 2.25)
  expect(clock.time()).toBeCloseTo(5.75)
  clock.update(0, 20.9)
  expect(clock.time()).toBeCloseTo(24.4)
})

it('restarts the gate clock on a fresh scene revision', () => {
  const clock = createBloomTextClock(12, 'waiting', 2)
  clock.update(18, 0)
  clock.setState('waiting', 3)
  expect(clock.waitingElapsed()).toBe(0)
})
