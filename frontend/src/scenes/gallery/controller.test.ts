import { beforeEach, describe, expect, it } from 'vitest'
import { Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector3 } from 'three'
import { GALLERY, GALLERY_MEMORIES, memoryPosition } from './content'
import { advanceGallery, galleryCanRaycastPhoto, galleryExit, galleryFocus, galleryMotion, galleryPhotoRaycast, gallerySnapshot, galleryStart, resetGallery, resetGalleryInstruction, travel } from './controller'
import { galleryFocusOpacity } from './visibility'

function enter() { advanceGallery(GALLERY.intro); expect(gallerySnapshot().phase).toBe('instruction'); galleryStart() }
describe('gallery travel', () => {
  beforeEach(() => { resetGalleryInstruction(); resetGallery(); enter() })
  it('has twelve alternating, independently positioned exhibits', () => {
    expect(GALLERY_MEMORIES).toHaveLength(12)
    expect(new Set(GALLERY_MEMORIES.map(m => m.id)).size).toBe(12)
    GALLERY_MEMORIES.forEach((m, i) => {
      const [x, , z] = memoryPosition(m, GALLERY.width)
      expect(m.side).toBe(i % 2 ? 1 : -1)
      expect(x).toBe(m.side * GALLERY.width / 2)
      expect(Math.abs(x)).toBe(3.5)
      expect(z).toBe(GALLERY.firstZ - i * GALLERY.spacing)
    })
  })
  it('changes photo lane X symmetrically while preserving each exhibit depth and order', () => {
    const width = 9.2
    for (const memory of GALLERY_MEMORIES) {
      const [defaultX, defaultY, defaultZ] = memoryPosition(memory, GALLERY.width)
      const [wideX, wideY, wideZ] = memoryPosition(memory, width)
      expect(defaultX).toBe(memory.side * 3.5)
      expect(wideX).toBe(memory.side * width / 2)
      expect(wideY).toBe(defaultY)
      expect(wideZ).toBe(defaultZ)
    }
  })
  it('moves forward for a spreading pinch, backward for a closing pinch and clamps both ends', () => {
    travel(5); advanceGallery(.2); expect(galleryMotion.progress).toBeGreaterThan(0)
    travel(-100); expect(galleryMotion.target).toBe(0); travel(1000); expect(galleryMotion.target).toBe(GALLERY.travel)
  })
  it('preserves travel position during focus and restores free movement after repeat selection', () => {
    travel(15); advanceGallery(1); const position = galleryMotion.progress
    galleryFocus(2); travel(10); advanceGallery(.5); expect(galleryMotion.progress).toBe(position); expect(gallerySnapshot().focus).toBe(2)
    galleryFocus(2); expect(gallerySnapshot()).toMatchObject({ focus: 2, interaction: 'returning' }); travel(5)
    advanceGallery(10); expect(gallerySnapshot()).toMatchObject({ focus: null, interaction: 'walk' }); travel(5); expect(galleryMotion.target).toBeGreaterThan(position)
  })
  it('locks one photo through focus and return transitions, ignoring other taps until walk resumes', () => {
    travel(15); advanceGallery(1); const routePosition = galleryMotion.progress
    galleryFocus(2)
    expect(gallerySnapshot()).toMatchObject({ focus: 2, interaction: 'focusing' })
    galleryFocus(3)
    expect(gallerySnapshot()).toMatchObject({ focus: 2, interaction: 'focusing' })
    expect(galleryMotion.focusIndex).toBe(2)

    advanceGallery(10)
    expect(gallerySnapshot()).toMatchObject({ focus: 2, interaction: 'focused' })
    galleryFocus(3)
    expect(gallerySnapshot()).toMatchObject({ focus: 2, interaction: 'focused' })
    galleryFocus(2)
    expect(gallerySnapshot()).toMatchObject({ focus: 2, interaction: 'returning' })
    galleryFocus(3)
    expect(gallerySnapshot()).toMatchObject({ focus: 2, interaction: 'returning' })

    advanceGallery(10)
    expect(gallerySnapshot()).toMatchObject({ focus: null, interaction: 'walk' })
    expect(galleryMotion.progress).toBeCloseTo(routePosition)
    expect(galleryMotion.focusMix).toBe(0)
  })
  it('only exposes the active photograph to raycasting while focused or transitioning', () => {
    expect(galleryCanRaycastPhoto(1)).toBe(true)
    galleryFocus(1)
    expect(galleryCanRaycastPhoto(1)).toBe(true)
    expect(galleryCanRaycastPhoto(2)).toBe(false)
    galleryFocus(1)
    expect(galleryCanRaycastPhoto(1)).toBe(false)
    expect(galleryCanRaycastPhoto(2)).toBe(false)
    advanceGallery(10)
    expect(galleryCanRaycastPhoto(2)).toBe(true)
  })
  it('removes background photo planes from real Three.js raycasts while one photo is active', () => {
    const front = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial())
    const back = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial())
    front.position.z = -2; back.position.z = -4
    front.raycast = galleryPhotoRaycast(1, front.raycast)
    let backVisible = true
    back.raycast = galleryPhotoRaycast(2, back.raycast, () => backVisible)
    const raycaster = new Raycaster(new Vector3(.2, .1, 0), new Vector3(0, 0, -1))
    const intersected = () => raycaster.intersectObjects([front, back]).map(hit => hit.object)
    expect(intersected()).toEqual([front, back])

    galleryFocus(1)
    expect(intersected()).toEqual([front])
    galleryFocus(1)
    expect(intersected()).toHaveLength(0)
    advanceGallery(10)
    expect(intersected()).toEqual([front, back])
    backVisible = false
    expect(intersected()).toEqual([front])
    front.geometry.dispose(); back.geometry.dispose()
    front.material.dispose(); back.material.dispose()
  })
  it('keeps nearby gallery context visible after several minutes in focus', () => {
    galleryFocus(4)
    advanceGallery(300)
    const neighborOpacity = galleryFocusOpacity(galleryMotion.focusMix, false)
    expect(gallerySnapshot().interaction).toBe('focused')
    expect(neighborOpacity).toBeGreaterThan(0)
    advanceGallery(300)
    expect(galleryFocusOpacity(galleryMotion.focusMix, false)).toBe(neighborOpacity)
  })
  it('returns to the same route position after repeated focus cycles', () => {
    travel(18); advanceGallery(2)
    const routePosition = galleryMotion.progress
    for (let index = 0; index < 8; index++) {
      galleryFocus(index)
      advanceGallery(10)
      expect(gallerySnapshot().interaction).toBe('focused')
      galleryFocus(index)
      advanceGallery(10)
      expect(gallerySnapshot().interaction).toBe('walk')
      expect(galleryMotion.progress).toBeCloseTo(routePosition, 8)
    }
  })
  it('does not change scene automatically at the end and exit requires explicit action', () => {
    travel(1000); advanceGallery(3); expect(gallerySnapshot().atEnd).toBe(true); expect(gallerySnapshot().phase).toBe('explore')
    travel(-10); advanceGallery(1); expect(gallerySnapshot().atEnd).toBe(false); galleryExit(); expect(gallerySnapshot().phase).toBe('explore')
    travel(1000); advanceGallery(3); galleryExit(); expect(gallerySnapshot().phase).toBe('exit')
  })
  it('suppresses selection during a pinch', () => { galleryMotion.pinching = true; galleryFocus(1); expect(gallerySnapshot().focus).toBeNull() })
  it('shows instructions only once until a new film run', () => { resetGallery(); advanceGallery(GALLERY.intro); expect(gallerySnapshot().phase).toBe('explore'); resetGalleryInstruction(); resetGallery(); advanceGallery(GALLERY.intro); expect(gallerySnapshot().phase).toBe('instruction') })
})
