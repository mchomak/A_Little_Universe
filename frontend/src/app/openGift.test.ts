import { expect, it, vi } from 'vitest'
import { openGift } from './openGift'

it('unlocks within the gesture and waits for consented recording before starting the film', async () => {
  const events: string[] = []
  let finish!: (value: boolean) => void
  const recording = new Promise<boolean>((resolve) => { finish = resolve })
  const start = vi.fn(() => { events.push('record'); return recording })
  const gift = openGift({
    audio: { unlock: async () => { events.push('unlock'); return true } },
    media: { getSnapshot: () => ({ options: { gaze: false, recording: true }, recordingStatus: 'ready' }), start },
    onStart: () => { events.push('film') },
  })
  expect(events).toEqual(['unlock', 'record'])
  finish(true)
  await gift
  expect(events).toEqual(['unlock', 'record', 'film'])
})

it('continues without recording consent even if audio unlock is unavailable', async () => {
  const start = vi.fn(async () => true)
  const onStart = vi.fn()
  await openGift({
    audio: { unlock: async () => { throw new Error('Audio unavailable') } },
    media: { getSnapshot: () => ({ options: { gaze: true, recording: false }, recordingStatus: 'ready' }), start },
    onStart,
  })
  expect(start).not.toHaveBeenCalled()
  expect(onStart).toHaveBeenCalledOnce()
})

it('starts the film even if the optional recorder fails synchronously', async () => {
  const onStart = vi.fn()
  await openGift({
    audio: { unlock: async () => true },
    media: {
      getSnapshot: () => ({ options: { gaze: false, recording: true }, recordingStatus: 'ready' }),
      start: () => { throw new Error('Recorder unavailable') },
    },
    onStart,
  })
  expect(onStart).toHaveBeenCalledOnce()
})
