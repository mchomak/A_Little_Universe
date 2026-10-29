import { beforeEach, describe, expect, it } from 'vitest'
import { GALLERY, GALLERY_MEMORIES, memoryPosition } from './content'
import { advanceGallery, galleryExit, galleryFocus, galleryMotion, gallerySnapshot, galleryStart, resetGallery, resetGalleryInstruction, travel } from './controller'

function enter() { advanceGallery(GALLERY.intro); expect(gallerySnapshot().phase).toBe('instruction'); galleryStart() }
describe('gallery travel', () => {
  beforeEach(() => { resetGalleryInstruction(); resetGallery(); enter() })
  it('has twelve alternating, independently positioned exhibits', () => {
    expect(GALLERY_MEMORIES).toHaveLength(12)
    expect(new Set(GALLERY_MEMORIES.map(m => m.id)).size).toBe(12)
    GALLERY_MEMORIES.forEach((m, i) => { expect(m.side).toBe(i % 2 ? 1 : -1); expect(memoryPosition(m)[2]).toBe(GALLERY.firstZ - i * GALLERY.spacing) })
  })
  it('moves forward for a spreading pinch, backward for a closing pinch and clamps both ends', () => {
    travel(5); advanceGallery(.2); expect(galleryMotion.progress).toBeGreaterThan(0)
    travel(-100); expect(galleryMotion.target).toBe(0); travel(1000); expect(galleryMotion.target).toBe(GALLERY.travel)
  })
  it('preserves travel position during focus and restores free movement after repeat selection', () => {
    travel(15); advanceGallery(1); const position = galleryMotion.progress
    galleryFocus(2); travel(10); advanceGallery(.5); expect(galleryMotion.progress).toBe(position); expect(gallerySnapshot().focus).toBe(2)
    galleryFocus(2); expect(gallerySnapshot().focus).toBeNull(); travel(5); expect(galleryMotion.target).toBeGreaterThan(position)
  })
  it('does not change scene automatically at the end and exit requires explicit action', () => {
    travel(1000); advanceGallery(3); expect(gallerySnapshot().atEnd).toBe(true); expect(gallerySnapshot().phase).toBe('explore')
    travel(-10); advanceGallery(1); expect(gallerySnapshot().atEnd).toBe(false); galleryExit(); expect(gallerySnapshot().phase).toBe('explore')
    travel(1000); advanceGallery(3); galleryExit(); expect(gallerySnapshot().phase).toBe('exit')
  })
  it('suppresses selection during a pinch', () => { galleryMotion.pinching = true; galleryFocus(1); expect(gallerySnapshot().focus).toBeNull() })
  it('shows instructions only once until a new film run', () => { resetGallery(); advanceGallery(GALLERY.intro); expect(gallerySnapshot().phase).toBe('explore'); resetGalleryInstruction(); resetGallery(); advanceGallery(GALLERY.intro); expect(gallerySnapshot().phase).toBe('instruction') })
})
