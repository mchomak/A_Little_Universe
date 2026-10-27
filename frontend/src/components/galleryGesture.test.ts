import { expect, it } from 'vitest'
import { createGalleryGesture } from './galleryGesture'

it('navigates vertical swipes once, rejecting taps, horizontal drags and cancelled or foreign pointers', () => {
  const steps: number[] = []
  const gesture = createGalleryGesture((direction) => steps.push(direction))
  const point = (clientX: number, clientY: number, pointerId = 1) => ({ pointerId, clientX, clientY })
  gesture.begin(point(100, 200))
  gesture.end(point(102, 110))
  gesture.end(point(102, 100))
  expect(steps).toEqual([1])
  gesture.begin(point(100, 100))
  gesture.end(point(100, 170))
  expect(steps).toEqual([1, -1])
  gesture.begin(point(100, 100))
  gesture.end(point(100, 110))
  gesture.begin(point(100, 100))
  gesture.end(point(240, 170))
  gesture.begin(point(100, 200))
  gesture.cancel()
  gesture.end(point(100, 100))
  gesture.begin(point(100, 200))
  gesture.begin(point(200, 300, 2))
  gesture.end(point(200, 200, 2))
  gesture.end(point(100, 100))
  expect(steps).toEqual([1, -1, 1])
})
