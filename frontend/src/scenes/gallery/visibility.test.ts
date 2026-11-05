import { expect, it, vi } from 'vitest'
import { galleryArchDistanceOpacity, galleryColumnOpacity, galleryDistanceOpacity, galleryFocusOpacity, galleryFocusedPhotoDistanceOpacity, wakeOnVisible } from './visibility'
it('wakes a visible demand canvas and removes the listener on disposal', () => {
  const source = new EventTarget() as EventTarget & { hidden: boolean }; source.hidden = true
  const invalidate = vi.fn(); const dispose = wakeOnVisible(source as unknown as Document, invalidate)
  source.dispatchEvent(new Event('visibilitychange')); expect(invalidate).not.toHaveBeenCalled()
  source.hidden = false; source.dispatchEvent(new Event('visibilitychange')); expect(invalidate).toHaveBeenCalledTimes(1)
  dispose(); source.dispatchEvent(new Event('visibilitychange')); expect(invalidate).toHaveBeenCalledTimes(1)
})
it('fades gallery photos into distant silhouettes before they disappear smoothly', () => {
  const visible = [30, 32, 34, 36, 38, 40, 42, 70, 110, 120].map(distance => galleryDistanceOpacity(distance))
  expect(visible[0]).toBe(1)
  expect(visible[1]).toBe(1)
  expect(visible[2]).toBeGreaterThan(visible[3]!)
  expect(visible[3]).toBeCloseTo(.6)
  expect(visible[3]).toBeGreaterThan(visible[4]!)
  expect(visible[1]).toBeGreaterThan(visible[2]!)
  expect(visible[5]).toBeCloseTo(.2)
  expect(visible[6]).toBeLessThan(visible[5]!)
  expect(visible[7]).toBeGreaterThan(.1)
  expect(visible[7]).toBeLessThan(visible[6]!)
  expect(visible[8]).toBeGreaterThan(0)
  expect(visible[9]).toBe(0)
})
it('keeps the moonlit arch visible from the entrance and eases its opacity on approach', () => {
  expect(galleryArchDistanceOpacity(90)).toBeGreaterThan(.5)
  expect(galleryArchDistanceOpacity(90)).toBeLessThan(galleryArchDistanceOpacity(18))
  expect(galleryArchDistanceOpacity(18)).toBe(1)
})
it('preserves visible gallery context at full focus without a time-based fade to zero', () => {
  expect(galleryFocusOpacity(0, false)).toBe(1)
  expect(galleryFocusOpacity(1, false)).toBeGreaterThan(0)
  expect(galleryFocusOpacity(1, true)).toBe(1)
})
it('keeps the selected collage fully visible beyond the corridor fade range', () => {
  expect(galleryDistanceOpacity(39.7)).toBeLessThan(0.21)
  expect(galleryFocusedPhotoDistanceOpacity(39.7, true, 1)).toBe(1)
  expect(galleryFocusedPhotoDistanceOpacity(39.7, true, 0)).toBe(galleryDistanceOpacity(39.7))
  expect(galleryFocusedPhotoDistanceOpacity(39.7, false, 1)).toBe(galleryDistanceOpacity(39.7))
})
it('keeps column opacity tied to scene visibility, exit, and distance rather than photo focus', () => {
  expect(galleryColumnOpacity(1, 0, 1)).toBe(1)
  expect(galleryColumnOpacity(1, 0, 0.6)).toBeCloseTo(0.6)
  expect(galleryColumnOpacity(1, 0.4, 0.6)).toBeCloseTo(0.36)
  expect(galleryColumnOpacity(0.5, 0, 1)).toBe(0.5)
})
