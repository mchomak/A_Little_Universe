import { describe, expect, it } from 'vitest'
import { getGalleryCollageConfig } from './galleryCollageConfig'

describe('gallery collage event configuration', () => {
  it('defaults particles on and supports an opt-out by stable event id', () => {
    const eventOverrides = { 'event-2024-06-15': { particleEnabled: false } } as const

    expect(getGalleryCollageConfig('event-2024-06-15', eventOverrides).particleEnabled).toBe(false)
    expect(getGalleryCollageConfig('event-2024-06-16', eventOverrides).particleEnabled).toBe(true)
    expect(getGalleryCollageConfig('unconfigured-event').particleEnabled).toBe(true)
  })
})
