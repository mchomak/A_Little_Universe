import { expect, it } from 'vitest'
import { resetConfig, updateConfig } from '../systems/scene-config/config'
import { canRestoreReview, type ReviewNote } from './reviewModel'

it('restores growth review notes against the current extended scene duration', async () => {
  await resetConfig('all')
  await updateConfig({ scenes: { growth: { formationDuration: 3.5, flowerGrowthDuration: 14 } } })
  const note = {
    id: 'growth-long', sceneId: 'growth', frameId: 'growth-tail', localTimeSeconds: 20.5, capturedMode: 'playing',
    checkpoint: { galleryIndex: 0, reading: false }, createdAt: '', text: '', priority: 'low', status: 'open',
    screenshotPath: '', viewport: { width: 1024, height: 768, dpr: 1 }, config: {},
  } satisfies ReviewNote

  try {
    expect(canRestoreReview(note)).toBe(true)
  } finally {
    await resetConfig('all')
  }
})
