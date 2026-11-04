import { describe, expect, it } from 'vitest'
import { collageParticleOpacity, collagePhotoOpacity, createCollageRevealGeometry, getFocusedGalleryCollagePhotos, getGalleryCollagePhotoLayout, getGalleryCollagePhotos } from './collage'

describe('gallery collage layout', () => {
  it('keeps only available extra photo slots and preserves their numbered positions', () => {
    expect(getGalleryCollagePhotos(['main.jpg', undefined, '3.jpg', undefined])).toEqual([
      { slot: 3, url: '3.jpg' },
    ])
    expect(getGalleryCollagePhotos(['main.jpg'])).toEqual([])
  })

  it('returns populated extra-photo slots only for the focused memory', () => {
    const images = ['main.jpg', '2.jpg', '3.jpg', '4.jpg']
    expect(getFocusedGalleryCollagePhotos(images, 0, null)).toEqual([])
    expect(getFocusedGalleryCollagePhotos(images, 0, 1)).toEqual([])
    expect(getFocusedGalleryCollagePhotos(images, 0, 0)).toEqual([
      { slot: 2, url: '2.jpg' },
      { slot: 3, url: '3.jpg' },
      { slot: 4, url: '4.jpg' },
    ])
    expect(getFocusedGalleryCollagePhotos(['main.jpg', undefined, undefined, '4.jpg'], 0, 0)).toEqual([
      { slot: 4, url: '4.jpg' },
    ])
  })

  it('places numbered photos in a non-overlapping row and biases each wall collage away from the passage', () => {
    const mainWidth = 3.3
    const mainHeight = 3.3
    const wallYaw = 1.15
    const leftSlot2 = getGalleryCollagePhotoLayout(2, -1, 3.3, 3.3, 0.75)
    const leftSlot3 = getGalleryCollagePhotoLayout(3, -1, 3.3, 3.3, 0.75)
    const rightSlot2 = getGalleryCollagePhotoLayout(2, 1, 3.3, 3.3, 0.75)
    const rightSlot3 = getGalleryCollagePhotoLayout(3, 1, 3.3, 3.3, 0.75)

    expect(leftSlot2.position[0]).toBeLessThan(0)
    expect(leftSlot3.position[0]).toBeGreaterThan(0)
    expect(rightSlot2.position[0]).toBeLessThan(0)
    expect(rightSlot3.position[0]).toBeGreaterThan(0)
    expect(leftSlot2.position[0] + leftSlot2.width / 2).toBeLessThan(-mainWidth / 2)
    expect(leftSlot3.position[0] - leftSlot3.width / 2).toBeGreaterThan(mainWidth / 2)
    expect(rightSlot2.position[0] + rightSlot2.width / 2).toBeLessThan(-mainWidth / 2)
    expect(rightSlot3.position[0] - rightSlot3.width / 2).toBeGreaterThan(mainWidth / 2)
    expect(leftSlot2.position[1]).toBeCloseTo(leftSlot3.position[1])
    expect(leftSlot2.width).toBeLessThan(mainWidth)
    expect(leftSlot2.width / leftSlot2.height).toBeCloseTo(0.75)
    const leftTop = getGalleryCollagePhotoLayout(4, -1, mainWidth, mainHeight, 1.4)
    expect(leftTop.position[0]).toBe(0)
    expect(leftTop.position[1]).toBeGreaterThan(mainHeight / 2)

    const leftYaw = wallYaw
    const rightYaw = -wallYaw
    expect(-1 * Math.sin(leftYaw) * leftSlot3.position[2]).toBeGreaterThan(0)
    expect(1 * Math.sin(rightYaw) * rightSlot2.position[2]).toBeGreaterThan(0)
    expect(leftSlot3.position[2]).toBeLessThan(leftSlot2.position[2])
    expect(rightSlot2.position[2]).toBeLessThan(rightSlot3.position[2])
  })

  it('uses reproducible particles and eases from particles into the image on focus', () => {
    const first = createCollageRevealGeometry(1.02, 1.36, 31, 48)
    const second = createCollageRevealGeometry(1.02, 1.36, 31, 48)
    expect(first.getAttribute('position').array).toEqual(second.getAttribute('position').array)
    expect(first.getAttribute('targetPosition').count).toBe(48)
    expect(collageParticleOpacity(0)).toBe(0)
    expect(collageParticleOpacity(0.25)).toBeGreaterThan(0)
    expect(collagePhotoOpacity(0)).toBe(0)
    expect(collageParticleOpacity(1)).toBe(0)
    expect(collagePhotoOpacity(1)).toBe(1)
    first.dispose()
    second.dispose()
  })
})
