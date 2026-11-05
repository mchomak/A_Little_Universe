import { describe, expect, it } from 'vitest'
import { normalizeConfig } from '../../systems/scene-config/config'
import { getGalleryArchPosition } from './archPlacement'
import type { GalleryMemory } from './content'

const memories = (count: number): GalleryMemory[] => Array.from({ length: count }, (_, order) => ({
  id: `memory-${order}`,
  image: undefined,
  images: [],
  caption: '',
  aspect: 1,
  side: order % 2 === 0 ? -1 : 1,
  order,
  palette: ['#000000', '#ffffff'] as [string, string],
}))

const betweenColumns = { laneWidth: 7, offsetX: 2, offsetY: 0.75, offsetZ: 2.1 }

describe('gallery arch placement', () => {
  it('keeps the established gap and symmetry while following a longer or shorter colonnade', () => {
    const short = getGalleryArchPosition(memories(4), 7, 'between-columns', betweenColumns)
    const long = getGalleryArchPosition(memories(8), 7, 'between-columns', betweenColumns)
    const established = getGalleryArchPosition(memories(12), 7, 'between-columns', betweenColumns)

    expect(short[0]).toBeCloseTo(0)
    expect(long[0]).toBeCloseTo(0)
    expect(short[2]).toBeCloseTo(-38.8)
    expect(long[2]).toBeCloseTo(-60.4)
    expect(established[2]).toBeCloseTo(-82)
    expect(long[2] - short[2]).toBeCloseTo(-21.6)
  })

  it('applies saved legacy Z as a relative offset and keeps following the final columns', () => {
    const customizedZ = -91
    const short = getGalleryArchPosition(memories(4), 7, 'between-columns', betweenColumns, 0, 0, 0, undefined, customizedZ)
    const long = getGalleryArchPosition(memories(8), 7, 'between-columns', betweenColumns, 0, 0, 0, undefined, customizedZ)
    const established = getGalleryArchPosition(memories(12), 7, 'between-columns', betweenColumns, 0, 0, 0, undefined, customizedZ)

    expect(short[2]).toBeCloseTo(-47.8)
    expect(long[2]).toBeCloseTo(-69.4)
    expect(established[2]).toBeCloseTo(-91)
    expect(long[2] - short[2]).toBeCloseTo(-21.6)
  })

  it('preserves a legacy Z value through config migration and applies it to the current column pair', () => {
    const migrated = normalizeConfig({ schemaVersion: 16, scenes: { gallery: { archPositionZ: -91 } } })
    const position = getGalleryArchPosition(
      memories(12), 7, 'between-columns', betweenColumns, 0, 0, 0, undefined,
      migrated.scenes.gallery.archPositionZ,
    )

    expect(migrated.scenes.gallery.archPositionZ).toBe(-91)
    expect(position[2]).toBeCloseTo(-91)
  })

  it('anchors to the final two supports in on-column mode with the configured floor and vertical offset', () => {
    const position = getGalleryArchPosition(memories(6), 7, 'on-columns', betweenColumns, 0, 0, 100)

    expect(position[0]).toBeCloseTo(0)
    expect(position[1]).toBeCloseTo(100)
    expect(position[2]).toBeCloseTo(-42.9434210594)
  })

  it('follows the actual B column centers when depth and scale move the shafts', () => {
    const baseline = getGalleryArchPosition(memories(8), 7, 'between-columns', betweenColumns, 0, 0, 0, {
      columnDepth: 0.15,
      columnScale: 1,
      columnOffsetX: 0,
    })
    const deeper = getGalleryArchPosition(memories(8), 7, 'between-columns', betweenColumns, 0, 0, 0, {
      columnDepth: 0.55,
      columnScale: 1,
      columnOffsetX: 0,
    })
    const larger = getGalleryArchPosition(memories(8), 7, 'between-columns', betweenColumns, 0, 0, 0, {
      columnDepth: 0.15,
      columnScale: 1.5,
      columnOffsetX: 0,
    })

    expect(deeper[2] - baseline[2]).toBeCloseTo(-0.4)
    expect(larger[2] - baseline[2]).toBeCloseTo(-0.48)
    expect(baseline[0]).toBeCloseTo(0)
    expect(larger[0]).toBeCloseTo(0)
  })

  it('keeps the arch centered when radial B column offsets change and follows A column offsets', () => {
    const radial = getGalleryArchPosition(memories(8), 7, 'between-columns', betweenColumns, 0, 0, 0, {
      columnDepth: 0.15,
      columnScale: 1.2,
      columnOffsetX: 0.6,
    })
    const onColumns = getGalleryArchPosition(memories(8), 7, 'on-columns', betweenColumns, 0, 0, 0, {
      columnDepth: 0.15,
      columnScale: 1.2,
      columnOffsetX: 0.6,
    })

    expect(radial[0]).toBeCloseTo(0)
    expect(onColumns[0]).not.toBeCloseTo(0)
    expect(onColumns[2]).not.toBeCloseTo(getGalleryArchPosition(memories(8), 7, 'on-columns', betweenColumns)[2])
  })
})
