import { describe, expect, it } from 'vitest'
import { GALLERY } from './content'
import { GALLERY_WORLD, getGalleryCloudPlanes, getGalleryCloudTextureDimensions } from './world'

describe('moonlit gallery world layout', () => {
  it('keeps the floor under the route and the small moon fixed beyond its end', () => {
    const routeEnd = GALLERY.startZ - GALLERY.travel
    const floorStart = GALLERY_WORLD.floor.centerZ + GALLERY_WORLD.floor.depth / 2
    const floorEnd = GALLERY_WORLD.floor.centerZ - GALLERY_WORLD.floor.depth / 2

    expect(GALLERY_WORLD.floor.y).toBe(-2.35)
    expect(floorStart).toBeGreaterThan(GALLERY.startZ)
    expect(floorEnd).toBeLessThan(routeEnd - 20)
    expect(GALLERY_WORLD.moon.position).toEqual([0.2, 4.9, -126])
    expect(GALLERY_WORLD.moon.position[2]).toBeLessThan(routeEnd - 40)
    expect(GALLERY_WORLD.moon.radius).toBeLessThan(2)
  })

  it('uses layered world-space clouds with a veil in front of the moon', () => {
    const clouds = getGalleryCloudPlanes('standard')
    const zPositions = clouds.map(({ position }) => position[2])
    const skyClouds = clouds.filter(({ id }) => id.startsWith('far-') || id.startsWith('deep-'))
    const sideClouds = clouds.filter(({ id }) => id.startsWith('side-'))

    expect(clouds.length).toBeGreaterThanOrEqual(8)
    expect(Math.max(...zPositions) - Math.min(...zPositions)).toBeGreaterThan(90)
    expect(clouds.some(({ id, position }) => id === 'moon-veil' && position[2] > GALLERY_WORLD.moon.position[2])).toBe(true)
    expect(skyClouds.length).toBeGreaterThanOrEqual(4)
    expect(skyClouds.every(({ position }) => position[2] < GALLERY.startZ - GALLERY.travel - 30)).toBe(true)
    expect(sideClouds.length).toBeGreaterThanOrEqual(4)
    expect(sideClouds.every(({ position }) => Math.abs(position[0]) >= 20)).toBe(true)
    expect(GALLERY_WORLD.haze.position[1]).toBeLessThan(-2)
    expect(GALLERY_WORLD.haze.position[2]).toBeLessThan(GALLERY.startZ - GALLERY.travel - 30)
    expect(GALLERY_WORLD.haze.size[1]).toBeLessThan(6)
  })

  it('reduces decorative cloud geometry and texture size in low quality', () => {
    expect(getGalleryCloudPlanes('low').length).toBeLessThan(getGalleryCloudPlanes('standard').length)
    expect(getGalleryCloudPlanes('low').some(({ id }) => id === 'moon-veil')).toBe(true)
    const standard = getGalleryCloudTextureDimensions('standard')
    const low = getGalleryCloudTextureDimensions('low')
    expect(low[0]).toBeLessThan(standard[0])
    expect(low[1]).toBeLessThan(standard[1])
  })
})
