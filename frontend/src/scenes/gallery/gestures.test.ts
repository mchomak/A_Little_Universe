import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GALLERY } from './content'
import { advanceGallery, galleryMotion, galleryStart, resetGallery, resetGalleryInstruction } from './controller'
import { bindGalleryGestures } from './gestures'
function touch(target: EventTarget, type: string, distances: number[]) {
  const event = new Event(type, { cancelable: true })
  Object.defineProperty(event, 'touches', { value: distances.map((clientX) => ({ clientX, clientY: 0 })) })
  target.dispatchEvent(event)
}
describe('canvas gesture listeners', () => {
  beforeEach(() => { resetGalleryInstruction(); resetGallery(); advanceGallery(GALLERY.intro); galleryStart() })
  it('tracks pinch directions through successive gestures without a jump and removes listeners', () => {
    const canvas = new EventTarget(); const dispose = bindGalleryGestures(canvas as HTMLElement, () => false)
    touch(canvas, 'touchstart', [0, 100]); touch(canvas, 'touchmove', [0, 200]); expect(galleryMotion.target).toBeCloseTo(4.5)
    touch(canvas, 'touchend', [0]); touch(canvas, 'touchend', []); touch(canvas, 'touchstart', [0, 300]); touch(canvas, 'touchmove', [0, 250]); expect(galleryMotion.target).toBeCloseTo(2.25)
    dispose(); const target = galleryMotion.target; touch(canvas, 'touchstart', [0, 100]); touch(canvas, 'touchmove', [0, 300]); expect(galleryMotion.target).toBe(target); expect(galleryMotion.pinching).toBe(false)
  })
  it('keeps click suppression during a second pinch started before the first timer expires', () => {
    vi.useFakeTimers(); const canvas = new EventTarget(); const dispose = bindGalleryGestures(canvas as HTMLElement, () => false)
    touch(canvas, 'touchstart', [0, 100]); touch(canvas, 'touchend', []); vi.advanceTimersByTime(300)
    touch(canvas, 'touchstart', [0, 100]); vi.advanceTimersByTime(200); expect(galleryMotion.suppressClick).toBe(true)
    touch(canvas, 'touchend', []); vi.advanceTimersByTime(450); expect(galleryMotion.suppressClick).toBe(false)
    dispose(); vi.useRealTimers()
  })
  it('does not travel on pause, and clears an interrupted gesture', () => {
    vi.useFakeTimers(); const canvas = new EventTarget(); const dispose = bindGalleryGestures(canvas as HTMLElement, () => true)
    touch(canvas, 'touchstart', [0, 100]); touch(canvas, 'touchmove', [0, 200]); expect(galleryMotion.target).toBe(0)
    touch(canvas, 'touchcancel', []); expect(galleryMotion.pinching).toBe(false); vi.advanceTimersByTime(450); expect(galleryMotion.suppressClick).toBe(false)
    dispose(); vi.useRealTimers()
  })
})
