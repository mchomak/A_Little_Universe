import { describe, expect, it } from 'vitest'
import { galleryPhotoBlur, galleryPhotoBlurAtFocus, galleryPhotoLight, galleryPhotoLightAtFocus, GALLERY_ART } from './artDirection'

describe('gallery photo finish', () => {
  it('softens distant images continuously and restores selected photos to full clarity', () => {
    expect(galleryPhotoBlur(8)).toBe(0)
    expect(galleryPhotoBlur(18)).toBeGreaterThan(0)
    expect(galleryPhotoBlur(24)).toBeGreaterThan(galleryPhotoBlur(18))
    expect(galleryPhotoBlur(34)).toBe(1)
    expect(galleryPhotoBlur(34, true)).toBe(0)
  })

  it('adds a subtle cool lift as the viewer approaches a photo', () => {
    expect(galleryPhotoLight(12)).toBeGreaterThan(galleryPhotoLight(28))
    expect(galleryPhotoLight(12, true)).toBeGreaterThan(galleryPhotoLight(12))
    expect(galleryPhotoLight(Number.NaN)).toBe(0)
  })

  it('smoothly clears distance blur and raises light as focus settles and returns', () => {
    expect(galleryPhotoBlurAtFocus(26, 0)).toBeGreaterThan(galleryPhotoBlurAtFocus(26, 0.5))
    expect(galleryPhotoBlurAtFocus(26, 0.5)).toBeGreaterThan(galleryPhotoBlurAtFocus(26, 1))
    expect(galleryPhotoBlurAtFocus(26, 1)).toBe(0)
    expect(galleryPhotoLightAtFocus(12, 0)).toBeLessThan(galleryPhotoLightAtFocus(12, 0.5))
    expect(galleryPhotoLightAtFocus(12, 0.5)).toBeLessThan(galleryPhotoLightAtFocus(12, 1))
  })

  it('keeps opposing wall angles in the requested range', () => {
    expect(GALLERY_ART.wallYaw * 180 / Math.PI).toBeGreaterThanOrEqual(35)
    expect(GALLERY_ART.wallYaw * 180 / Math.PI).toBeLessThanOrEqual(55)
  })
})
