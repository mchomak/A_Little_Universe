import { describe, expect, it } from 'vitest'
import { PlaneGeometry } from 'three'
import { applyGalleryCloudAtlasUvs } from './worldTextures'

describe('gallery cloud atlas UV mapping', () => {
  it('maps one plane into its inset atlas quadrant and remains stable when reapplied', () => {
    const geometry = new PlaneGeometry(2, 2)
    applyGalleryCloudAtlasUvs(geometry, 0)

    Array.from(geometry.getAttribute('uv').array).forEach((value, index) => expect(value).toBeCloseTo([
      0.025, 0.975,
      0.475, 0.975,
      0.025, 0.525,
      0.475, 0.525,
    ][index]!, 5))

    applyGalleryCloudAtlasUvs(geometry, 0)
    Array.from(geometry.getAttribute('uv').array).forEach((value, index) => expect(value).toBeCloseTo([
      0.025, 0.975,
      0.475, 0.975,
      0.025, 0.525,
      0.475, 0.525,
    ][index]!, 5))
    geometry.dispose()
  })

  it('keeps the four sprite UV ranges separate across the atlas gutter', () => {
    const expectedBySprite = [
      [0.025, 0.525, 0.475, 0.975],
      [0.525, 0.525, 0.975, 0.975],
      [0.025, 0.025, 0.475, 0.475],
      [0.525, 0.025, 0.975, 0.475],
    ]
    for (let sprite = 0; sprite < 4; sprite++) {
      const geometry = new PlaneGeometry(2, 2)
      applyGalleryCloudAtlasUvs(geometry, sprite as 0 | 1 | 2 | 3)
      const uv = geometry.getAttribute('uv')
      const range = [
        Math.min(...Array.from({ length: uv.count }, (_, index) => uv.getX(index))),
        Math.min(...Array.from({ length: uv.count }, (_, index) => uv.getY(index))),
        Math.max(...Array.from({ length: uv.count }, (_, index) => uv.getX(index))),
        Math.max(...Array.from({ length: uv.count }, (_, index) => uv.getY(index))),
      ]
      range.forEach((value, index) => expect(value).toBeCloseTo(expectedBySprite[sprite]![index]!, 5))
      geometry.dispose()
    }
  })
})
