import { beforeEach, describe, expect, it } from 'vitest'
import { Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector3 } from 'three'
import { galleryColumnPhotoCenterOffsetZ, galleryColumnPosition, galleryColumnPositions, galleryPhotoApproachYaw, galleryPhotoYaw, gallerySupportColumnOffsetX, GALLERY, GALLERY_MEMORIES, memoryPosition, PLANETARIUM_GALLERY_EVENT_ID } from './content'
import { advanceGallery, galleryCanRaycastPhoto, galleryExit, galleryFocus, galleryMotion, galleryPhotoRaycast, gallerySnapshot, galleryStart, resetGallery, resetGalleryInstruction, travel } from './controller'
import { galleryFocusOpacity } from './visibility'
import { getGalleryEntryRevealDuration } from './entryReveal'

function enter() { advanceGallery(GALLERY.intro); expect(gallerySnapshot().phase).toBe('instruction'); galleryStart() }
describe('gallery travel', () => {
  beforeEach(() => { resetGalleryInstruction(); resetGallery(); enter() })
  it('holds the portrait and intro at the entry pose until the staged reveal completes', () => {
    resetGalleryInstruction()
    resetGallery()
    const entryCount = 2
    const revealDuration = getGalleryEntryRevealDuration(entryCount)

    advanceGallery(revealDuration - 0.1, false, entryCount)
    expect(galleryMotion.entryReveal).toBeCloseTo(revealDuration - 0.1)
    expect(galleryMotion.intro).toBe(0)
    expect(gallerySnapshot().phase).toBe('intro')

    advanceGallery(0.2, false, entryCount)
    expect(galleryMotion.entryReveal).toBe(revealDuration)
    expect(galleryMotion.intro).toBeCloseTo(0.1)
    expect(gallerySnapshot().phase).toBe('intro')

    advanceGallery(GALLERY.intro, false, entryCount)
    expect(gallerySnapshot().phase).toBe('instruction')
    resetGallery()
    expect(galleryMotion.entryReveal).toBe(0)
    expect(galleryMotion.intro).toBe(0)
  })
  it('has unique, alternating, independently positioned exhibits', () => {
    expect(GALLERY_MEMORIES.length).toBeGreaterThan(0)
    expect(new Set(GALLERY_MEMORIES.map(m => m.id)).size).toBe(GALLERY_MEMORIES.length)
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
  it('mirrors B photo X offsets while preserving the original A translation', () => {
    const left = GALLERY_MEMORIES[0]!
    const right = GALLERY_MEMORIES[1]!
    const layout = { laneWidth: 8, offsetX: -1.25, offsetY: 0, offsetZ: 0 }
    const leftIn = memoryPosition(left, GALLERY.width, 'between-columns', layout)
    const rightIn = memoryPosition(right, GALLERY.width, 'between-columns', layout)
    expect(leftIn[0]).toBe(-2.75)
    expect(rightIn[0]).toBe(2.75)

    const leftOut = memoryPosition(left, GALLERY.width, 'between-columns', { ...layout, offsetX: 1.25 })
    const rightOut = memoryPosition(right, GALLERY.width, 'between-columns', { ...layout, offsetX: 1.25 })
    expect(leftOut[0]).toBe(-5.25)
    expect(rightOut[0]).toBe(5.25)
    expect(leftIn[0]).toBe(-rightIn[0])
    expect(leftOut[0]).toBe(-rightOut[0])

    expect(memoryPosition(left, GALLERY.width, 'on-columns', layout)[0]).toBe(-5.25)
    expect(memoryPosition(right, GALLERY.width, 'on-columns', layout)[0]).toBe(2.75)
  })
  it('keeps B photo lanes centered on their support columns for custom lane width and radial offset', () => {
    const layout = { laneWidth: 9.4, offsetX: -0.4, offsetY: 0, offsetZ: 1.2 }
    const leftPhoto = GALLERY_MEMORIES[0]!
    const rightPhoto = GALLERY_MEMORIES[1]!
    const [leftX, , leftZ] = memoryPosition(leftPhoto, GALLERY.width, 'between-columns', layout)
    const [rightX, , rightZ] = memoryPosition(rightPhoto, GALLERY.width, 'between-columns', layout)
    const supports = galleryColumnPositions(leftPhoto, GALLERY.width, 'between-columns', layout)
    const leftSupports = supports.filter(([x]) => x < 0)
    const rightSupports = supports.filter(([x]) => x > 0)

    expect(leftX).toBeCloseTo(-4.3)
    expect(rightX).toBeCloseTo(4.3)
    expect(leftSupports[0]![0]).toBeCloseTo(leftX)
    expect(rightSupports[0]![0]).toBeCloseTo(rightX)
    expect(leftZ).toBeCloseTo((leftSupports[0]![2] + leftSupports[1]![2]) / 2 + galleryColumnPhotoCenterOffsetZ())
    expect(rightZ).toBe(leftZ)
  })
  it('centers B photos between the visible shaft centers along Z with the configured layout', () => {
    const layout = { laneWidth: 7, offsetX: 1.95, offsetY: 0.45, offsetZ: 0 }
    const columnDepth = 0.15
    const columnScale = 1
    const columnSettings = { columnDepth, columnScale }
    const visibleCenterOffsetZ = galleryColumnPhotoCenterOffsetZ(columnSettings)
    const anchorsBySide = [-1, 1].map(side => [...new Set(GALLERY_MEMORIES
      .flatMap(memory => galleryColumnPositions(memory, GALLERY.width, 'between-columns', layout))
      .filter(([x]) => Math.sign(x) === side)
      .map(([, , z]) => z))].sort((a, b) => b - a))
    for (let row = 0; row < Math.floor(GALLERY_MEMORIES.length / 2); row += 1) {
      const left = GALLERY_MEMORIES[row * 2]!
      const right = GALLERY_MEMORIES[row * 2 + 1]!
      for (const [sideIndex, memory] of [[0, left], [1, right]] as const) {
        const anchors = anchorsBySide[sideIndex]!
        const columnCenters = [anchors[row]!, anchors[row + 1]!].map(z => z + visibleCenterOffsetZ)
        const photoZ = memoryPosition(memory, GALLERY.width, 'between-columns', layout, columnSettings)[2]
        expect(photoZ).toBeCloseTo((columnCenters[0]! + columnCenters[1]!) / 2, 8)
      }
    }

    const widerSupports = [-1, 1].map(side => [...new Set(GALLERY_MEMORIES
      .flatMap(memory => galleryColumnPositions(memory, GALLERY.width, 'between-columns', layout))
      .filter(([x]) => Math.sign(x) === side)
      .map(([, , z]) => z))].sort((a, b) => b - a))
    const scaledColumns = { columnScale: 1.8, columnDepth: 0.63 }
    const scaledOffset = galleryColumnPhotoCenterOffsetZ(scaledColumns)
    for (let row = 0; row < Math.floor(GALLERY_MEMORIES.length / 2); row += 1) {
      const memory = GALLERY_MEMORIES[row * 2]!
      const photoZ = memoryPosition(memory, GALLERY.width, 'between-columns', layout, scaledColumns)[2]
      const anchors = widerSupports[0]!
      expect(photoZ).toBeCloseTo((anchors[row]! + anchors[row + 1]!) / 2 + scaledOffset, 8)
    }
  })
  it('keeps a nonzero gap between opposing B photos at the tightest valid layout', () => {
    const left = memoryPosition(GALLERY_MEMORIES[0]!, GALLERY.width, 'between-columns', { laneWidth: 6, offsetX: -2.5, offsetY: 0, offsetZ: 0 })
    const right = memoryPosition(GALLERY_MEMORIES[1]!, GALLERY.width, 'between-columns', { laneWidth: 6, offsetX: -2.5, offsetY: 0, offsetZ: 0 })
    expect(left[0]).toBe(-0.5)
    expect(right[0]).toBe(0.5)
    expect(right[0] - left[0]).toBeGreaterThanOrEqual(1)

    const invalid = memoryPosition(GALLERY_MEMORIES[0]!, GALLERY.width, 'between-columns', { laneWidth: 6, offsetX: -3, offsetY: 0, offsetZ: 0 })
    expect(invalid[0]).toBe(-0.5)
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
  it('starts the galaxy transition after the final planetarium photo finishes focusing', () => {
    const planetariumIndex = GALLERY_MEMORIES.findIndex(memory => memory.id === PLANETARIUM_GALLERY_EVENT_ID)
    expect(planetariumIndex).toBe(GALLERY_MEMORIES.length - 1)

    galleryFocus(planetariumIndex)
    expect(gallerySnapshot()).toMatchObject({ phase: 'explore', interaction: 'focusing', focus: planetariumIndex })
    advanceGallery(10)
    expect(gallerySnapshot()).toMatchObject({ phase: 'exit', interaction: 'focusing', focus: planetariumIndex })
    expect(galleryMotion.exit).toBe(0)
    advanceGallery(0.5)
    expect(galleryMotion.exit).toBeGreaterThan(0)
  })
  it('suppresses selection during a pinch', () => { galleryMotion.pinching = true; galleryFocus(1); expect(gallerySnapshot().focus).toBeNull() })
  it('shows instructions only once until a new film run', () => { resetGallery(); advanceGallery(GALLERY.intro); expect(gallerySnapshot().phase).toBe('explore'); resetGalleryInstruction(); resetGallery(); advanceGallery(GALLERY.intro); expect(gallerySnapshot().phase).toBe('instruction') })
})
  it('centers opposing B photos between straight, facing column pairs along the aisle', () => {
    const left = GALLERY_MEMORIES[0]!
    const right = GALLERY_MEMORIES[1]!
    const nextLeft = GALLERY_MEMORIES[2]!
    expect(memoryPosition(left, GALLERY.width, 'between-columns')).toEqual([-3.5, 0, -11.01])
    expect(memoryPosition(right, GALLERY.width, 'between-columns')).toEqual([3.5, 0, -11.01])
    const nextLeftPosition = memoryPosition(nextLeft, GALLERY.width, 'between-columns')
    expect(nextLeftPosition[0]).toBe(-3.5)
    expect(nextLeftPosition[2]).toBeCloseTo(-21.81, 8)
    expect(memoryPosition(left, GALLERY.width, 'between-columns', { laneWidth: GALLERY.width, offsetX: 0.4, offsetY: 0.2, offsetZ: 1 })).toEqual([-3.9, 0.2, -10.01])
    expect(galleryColumnPositions(left, GALLERY.width, 'between-columns')).toEqual([[-3.5, 0, -4.5], [3.5, 0, -4.5], [-3.5, 0, -15.3], [3.5, 0, -15.3]])
    expect(galleryColumnPositions(right, GALLERY.width, 'between-columns')).toEqual([])
    expect(galleryColumnPositions(nextLeft, GALLERY.width, 'between-columns')).toEqual([[-3.5, 0, -26.1], [3.5, 0, -26.1]])
    expect(galleryPhotoYaw(left, 'between-columns')).toBe(Math.PI / 2)
    expect(galleryPhotoYaw(right, 'between-columns')).toBe(-Math.PI / 2)
    expect(galleryPhotoYaw(left, 'on-columns')).toBeCloseTo(1.15)
    expect(galleryColumnPosition(left, GALLERY.width)).toEqual([-3.5, 0, -4.5])

    const supportsBySide = [-1, 1].map(side => [...new Set(GALLERY_MEMORIES
      .flatMap(memory => galleryColumnPositions(memory, GALLERY.width, 'between-columns'))
      .filter(([x]) => Math.sign(x) === side)
      .map(([, , supportZ]) => supportZ))].sort((a, b) => b - a))
    expect(supportsBySide.map(supports => supports.length)).toEqual([
      Math.ceil(GALLERY_MEMORIES.length / 2) + 1,
      Math.ceil(GALLERY_MEMORIES.length / 2) + 1,
    ])
    for (const supports of supportsBySide) {
      for (let index = 1; index < supports.length; index++) {
        expect(supports[index - 1]! - supports[index]!).toBeCloseTo(GALLERY.spacing * 2, 8)
      }
    }

    const rowCenters: number[] = []
    const completePairs = Math.floor(GALLERY_MEMORIES.length / 2)
    for (let row = 0; row < completePairs; row++) {
      const leftPhoto = memoryPosition(GALLERY_MEMORIES[row * 2]!, GALLERY.width, 'between-columns')
      const rightPhoto = memoryPosition(GALLERY_MEMORIES[row * 2 + 1]!, GALLERY.width, 'between-columns')
      rowCenters.push(leftPhoto[2])
      for (const supports of supportsBySide) {
        expect(leftPhoto[2]).toBeCloseTo((supports[row]! + supports[row + 1]!) / 2 + galleryColumnPhotoCenterOffsetZ(), 8)
        expect(rightPhoto[2]).toBeCloseTo(leftPhoto[2], 8)
      }
    }
    for (let row = 1; row < rowCenters.length; row++) {
      expect(rowCenters[row - 1]! - rowCenters[row]!).toBeCloseTo(GALLERY.spacing * 2, 8)
    }
    const lastPairZ = GALLERY.firstZ - GALLERY.spacing - (completePairs - 1) * GALLERY.spacing * 2
    expect(rowCenters.at(-1)).toBeCloseTo(lastPairZ + galleryColumnPhotoCenterOffsetZ(), 8)
  })
  it('keeps B column adjustments mirrored and photo yaw eases toward the viewer with distance', () => {
    const left = GALLERY_MEMORIES[0]!
    const right = GALLERY_MEMORIES[1]!
    expect(gallerySupportColumnOffsetX(-3.5, 'between-columns', 1.25)).toBe(-1.25)
    expect(gallerySupportColumnOffsetX(3.5, 'between-columns', 1.25)).toBe(1.25)
    expect(gallerySupportColumnOffsetX(-3.5, 'on-columns', 1.25)).toBe(1.25)

    const near = galleryPhotoYaw(left, 'between-columns')
    const half = galleryPhotoApproachYaw(left, 'between-columns', GALLERY.spacing * 2)
    const farLeft = galleryPhotoApproachYaw(left, 'between-columns', GALLERY.spacing * 4)
    const farRight = galleryPhotoApproachYaw(right, 'between-columns', GALLERY.spacing * 4)
    const passedLeft = galleryPhotoApproachYaw(left, 'between-columns', -GALLERY.spacing * 4)
    const passedRight = galleryPhotoApproachYaw(right, 'between-columns', -GALLERY.spacing * 4)
    expect(galleryPhotoApproachYaw(left, 'between-columns', 0)).toBe(near)
    expect(half).toBeCloseTo(near - Math.PI / 8, 8)
    expect(farLeft).toBeCloseTo(Math.PI / 4, 8)
    expect(farRight).toBeCloseTo(-Math.PI / 4, 8)
    expect(passedLeft).toBeCloseTo(3 * Math.PI / 4, 8)
    expect(passedRight).toBeCloseTo(-3 * Math.PI / 4, 8)
    expect(galleryPhotoApproachYaw(left, 'between-columns', GALLERY.spacing * 4, 80)).toBeCloseTo(Math.PI / 4, 8)
    expect(galleryPhotoApproachYaw(left, 'between-columns', GALLERY.spacing * 4, 45, 1)).toBe(near)
    expect(galleryPhotoApproachYaw(left, 'on-columns', GALLERY.spacing * 4, 45)).toBe(galleryPhotoYaw(left, 'on-columns'))
  })

