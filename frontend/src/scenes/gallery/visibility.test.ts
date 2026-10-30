import { expect, it, vi } from 'vitest'
import { galleryDistanceOpacity, galleryFocusOpacity, wakeOnVisible } from './visibility'
it('wakes a visible demand canvas and removes the listener on disposal', () => {
  const source = new EventTarget() as EventTarget & { hidden: boolean }; source.hidden = true
  const invalidate = vi.fn(); const dispose = wakeOnVisible(source as unknown as Document, invalidate)
  source.dispatchEvent(new Event('visibilitychange')); expect(invalidate).not.toHaveBeenCalled()
  source.hidden = false; source.dispatchEvent(new Event('visibilitychange')); expect(invalidate).toHaveBeenCalledTimes(1)
  dispose(); source.dispatchEvent(new Event('visibilitychange')); expect(invalidate).toHaveBeenCalledTimes(1)
})
it('fades gallery photos smoothly at a spatial distance cutoff in either travel direction', () => {
  const visible = [30, 32, 34, 36, 38, 40, 42].map(distance => galleryDistanceOpacity(distance))
  expect(visible).toEqual([1, 1, expect.any(Number), expect.any(Number), expect.any(Number), 0, 0])
  expect(visible[2]).toBeGreaterThan(visible[3]!)
  expect(visible[3]).toBeCloseTo(.5)
  expect(visible[3]).toBeGreaterThan(visible[4]!)
  expect(visible[1]).toBeGreaterThan(visible[2]!)
})
it('preserves visible gallery context at full focus without a time-based fade to zero', () => {
  expect(galleryFocusOpacity(0, false)).toBe(1)
  expect(galleryFocusOpacity(1, false)).toBeGreaterThan(0)
  expect(galleryFocusOpacity(1, true)).toBe(1)
})
