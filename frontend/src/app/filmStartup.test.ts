import { expect, it } from 'vitest'
import { awaitFilmStartup } from './filmStartup'

it('keeps gift-opening failures distinct from particle-preparation failures', async () => {
  const audioFailure = new Error('Audio unavailable')
  const workerFailure = new Error('Worker unavailable')

  await expect(awaitFilmStartup(Promise.reject(audioFailure), Promise.resolve()))
    .rejects.toMatchObject({ source: 'gift', reason: audioFailure })
  await expect(awaitFilmStartup(Promise.resolve(), Promise.reject(workerFailure)))
    .rejects.toMatchObject({ source: 'particles', reason: workerFailure })
})
