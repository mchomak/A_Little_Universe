import { describe, expect, it } from 'vitest'
import { canRestoreReview } from './reviewModel'

describe('review checkpoint restoration', () => {
  it('only restores ordinary timed states without inventing a gate action', () => {
    expect(canRestoreReview({ sceneId: 'identity', capturedMode: 'playing', localTimeSeconds: 12 })).toBe(true)
    expect(canRestoreReview({ sceneId: 'bloom', capturedMode: 'playing', localTimeSeconds: 12 })).toBe(false)
    expect(canRestoreReview({ sceneId: 'prologue', capturedMode: 'waiting', localTimeSeconds: 21 })).toBe(false)
    expect(canRestoreReview({ sceneId: 'gallery', capturedMode: 'exploring', localTimeSeconds: 0 })).toBe(false)
    expect(canRestoreReview({ sceneId: 'greeting', capturedMode: 'playing', localTimeSeconds: 4, checkpoint: { galleryIndex: 0, reading: true } })).toBe(false)
  })
})
