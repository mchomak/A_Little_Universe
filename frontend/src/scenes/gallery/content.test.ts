import { describe, expect, it } from 'vitest'
import { Group, Vector3 } from 'three'
import { GALLERY, GALLERY_MEMORIES, gallerySupportGroupScale, gallerySupportLocalPositions } from './content'
import { GALLERY_EVENT_ORDER } from './catalog'
import galleryCaptions from '../../data/galleryCaptions.json'

describe('gallery support transforms', () => {
  it('keeps both B column rails mirrored through the first-memory intro scale', () => {
    const photoPosition = [-3.5, 0, -9.9] as const
    const supports = [
      [-3.5, 0, -4.5], [3.5, 0, -4.5],
      [-3.5, 0, -15.3], [3.5, 0, -15.3],
    ] as const

    for (const introScale of [1, 1.175, 1.35]) {
      const scale = gallerySupportGroupScale('between-columns', introScale)
      const localPositions = gallerySupportLocalPositions('between-columns', photoPosition, supports)
      const parent = new Group()
      parent.position.set(...photoPosition)
      parent.scale.setScalar(scale)
      const children = localPositions.map((position) => {
        const child = new Group()
        child.position.set(...position)
        parent.add(child)
        return child
      })
      parent.updateMatrixWorld(true)
      const worldPositions = children.map((child) => child.getWorldPosition(new Vector3()))

      expect(scale).toBe(1)
      expect(worldPositions[0]!.x).toBeCloseTo(-worldPositions[1]!.x)
      expect(worldPositions[0]!.z).toBeCloseTo(worldPositions[1]!.z)
      expect(worldPositions[2]!.x).toBeCloseTo(-worldPositions[3]!.x)
      expect(worldPositions[2]!.z).toBeCloseTo(worldPositions[3]!.z)
      expect(worldPositions.map(({ z }) => z)).toEqual([-4.5, -4.5, -15.3, -15.3])
    }
  })

  it('preserves the original A intro parent position and scale', () => {
    const photoPosition = [-2.1, 0.2, -1.4] as const
    const scale = gallerySupportGroupScale('on-columns', 1.35)
    const localPositions = gallerySupportLocalPositions('on-columns', photoPosition, [[-3.5, 0, -4.5]])

    expect(photoPosition).toEqual([-2.1, 0.2, -1.4])
    expect(scale).toBe(1.35)
    expect(localPositions).toEqual([[0, 0, 0]])
  })
})

describe('gallery event content', () => {
  it('places start_img first, followed by all 17 events in order on alternating sides', () => {
    expect(GALLERY_EVENT_ORDER).toHaveLength(17)
    expect(GALLERY_MEMORIES).toHaveLength(18)
    expect(GALLERY_MEMORIES.map(({ id }) => id)).toEqual(['start_img.jpg', ...GALLERY_EVENT_ORDER])
    expect(GALLERY_MEMORIES.map(({ side }) => side)).toEqual(
      GALLERY_MEMORIES.map((_, index) => index % 2 === 0 ? -1 : 1),
    )
    expect(GALLERY_MEMORIES.map(({ order }) => order)).toEqual(Array.from({ length: 18 }, (_, index) => index))
    expect(GALLERY_MEMORIES.every(({ image }) => Boolean(image))).toBe(true)
    expect(GALLERY.travel).toBeGreaterThan(GALLERY_MEMORIES.length * GALLERY.spacing)
  })

  it('loads every title and caption from JSON without old event or demo entries', () => {
    const captionsById = galleryCaptions as Readonly<Record<string, { title: string; caption: string } | undefined>>
    expect(Object.keys(captionsById)).toEqual(['start_img.jpg', ...GALLERY_EVENT_ORDER])
    expect(GALLERY_MEMORIES.every(({ id, title, caption }) => {
      const content = captionsById[id]
      return content !== undefined && content.title === title && content.caption === caption
    })).toBe(true)
    expect(GALLERY_EVENT_ORDER.slice(-2)).toEqual(['2026_10_Saint_Petersburg', '2026_10_Planetarium'])
    expect(GALLERY_MEMORIES.some(({ id }) => id.startsWith('demo-'))).toBe(false)
  })
})
