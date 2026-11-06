import { describe, expect, it } from 'vitest'
import { normalizeConfig } from '../../systems/scene-config/config'
import { GALLERY_MEMORIES, PLANETARIUM_GALLERY_EVENT_ID } from './content'
import { createGalleryEntrySequence, getGalleryEntryRevealAlpha, getGalleryEntryRevealDuration } from './entryReveal'

describe('gallery entry reveal timeline', () => {
  it('allocates a base reveal and one non-overlapping slot per ordered item', () => {
    expect(getGalleryEntryRevealDuration(0)).toBeCloseTo(2.85)
    expect(getGalleryEntryRevealDuration(4)).toBeCloseTo(4.05)
  })

  it('reveals water, clouds and moon in order with smooth bounded alpha', () => {
    expect(getGalleryEntryRevealAlpha(0, 'water')).toBe(0)
    expect(getGalleryEntryRevealAlpha(0.35, 'water')).toBeGreaterThan(0)
    expect(getGalleryEntryRevealAlpha(0.7, 'water')).toBe(1)
    expect(getGalleryEntryRevealAlpha(0.7, 'clouds')).toBe(0)
    expect(getGalleryEntryRevealAlpha(1.5, 'clouds')).toBe(1)
    expect(getGalleryEntryRevealAlpha(1.5, 'moon')).toBe(0)
    expect(getGalleryEntryRevealAlpha(2.2, 'moon')).toBe(1)
    expect(getGalleryEntryRevealAlpha(-1, 'water')).toBe(0)
    expect(getGalleryEntryRevealAlpha(Number.NaN, 'water')).toBe(0)
  })

  it('reveals ordered items one at a time, then starts the arch after all items', () => {
    expect(getGalleryEntryRevealAlpha(2.2, 'item', 0)).toBe(0)
    expect(getGalleryEntryRevealAlpha(2.5, 'item', 0)).toBe(1)
    expect(getGalleryEntryRevealAlpha(2.5, 'item', 1)).toBe(0)
    expect(getGalleryEntryRevealAlpha(2.8, 'item', 1)).toBe(1)
    expect(getGalleryEntryRevealAlpha(2.8, 'arch', 2)).toBe(0)
    expect(getGalleryEntryRevealAlpha(3.45, 'arch', 2)).toBe(1)
  })

  it('builds a distinct ordered step for every support and every unsupported photo', () => {
    const layoutA = normalizeConfig({ schemaVersion: 24, scenes: { gallery: { galleryLayoutVariant: 'on-columns' } } }).scenes.gallery
    const layoutB = normalizeConfig({ schemaVersion: 24, scenes: { gallery: { galleryLayoutVariant: 'between-columns' } } }).scenes.gallery
    const columnsHidden = normalizeConfig({ schemaVersion: 24, scenes: { gallery: { columnVisible: false } } }).scenes.gallery
    const sequenceA = createGalleryEntrySequence(GALLERY_MEMORIES, layoutA)
    const sequenceB = createGalleryEntrySequence(GALLERY_MEMORIES, layoutB)
    const sequenceWithoutColumns = createGalleryEntrySequence(GALLERY_MEMORIES, columnsHidden)

    expect(sequenceA.steps.length).toBeGreaterThan(0)
    expect(sequenceB.steps.length).toBeGreaterThan(sequenceA.steps.length)
    expect(getGalleryEntryRevealDuration(sequenceB.steps.length)).toBeGreaterThan(getGalleryEntryRevealDuration(sequenceA.steps.length))
    expect(sequenceWithoutColumns.steps).toHaveLength(GALLERY_MEMORIES.length - 1)
    expect(sequenceA.photoIndices.has(0)).toBe(false)
    expect(sequenceA.photoIndices.size).toBe(GALLERY_MEMORIES.length - 1)
    expect(sequenceA.steps.some(step => step.kind === 'column' && step.memoryOrder === 0)).toBe(true)
    const unsupportedMemory = GALLERY_MEMORIES.find(memory => memory.id === PLANETARIUM_GALLERY_EVENT_ID)!
    const unsupportedPhotoIndex = sequenceB.photoIndices.get(unsupportedMemory.order)!
    expect(sequenceB.steps[unsupportedPhotoIndex]).toMatchObject({ kind: 'photo', memoryOrder: unsupportedMemory.order })
    for (const sequence of [sequenceA, sequenceB]) {
      sequence.steps.slice(1).forEach((step, index) => {
        const previous = sequence.steps[index]!
        const sameDepth = Math.abs(previous.position[2] - step.position[2]) < 1e-6
        if (sameDepth) expect(previous.position[0]).toBeLessThanOrEqual(step.position[0])
        else expect(previous.position[2]).toBeGreaterThan(step.position[2])
      })
    }
  })

})
