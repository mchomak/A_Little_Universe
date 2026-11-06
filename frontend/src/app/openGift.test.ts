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

it('requests camera and microphone from the consent gesture, then waits for recording before starting the film', async () => {
  const events: string[] = []
  let finishPreparation!: (value: boolean) => void
  const preparation = new Promise<boolean>((resolve) => { finishPreparation = resolve })
  const start = vi.fn(async () => { events.push('record'); return true })
  const prepare = vi.fn(() => { events.push('prepare'); return preparation })
  const onStart = vi.fn(() => { events.push('film') })
  const gift = openGift({
    audio: { unlock: () => { events.push('unlock'); return Promise.resolve(true) } },
    media: {
      getSnapshot: () => ({ options: { gaze: false, recording: true }, recordingStatus: 'idle' }),
      prepare,
      start,
    },
    onStart,
  })

  expect(events).toEqual(['unlock', 'prepare'])
  expect(start).not.toHaveBeenCalled()
  finishPreparation(true)
  await gift

  expect(start).toHaveBeenCalledOnce()
  expect(events).toEqual(['unlock', 'prepare', 'record', 'film'])
  expect(onStart).toHaveBeenCalledOnce()
})

it('does not start the film when permission or recording startup fails', async () => {
  const onStart = vi.fn()
  const start = vi.fn(async () => false)
  await expect(openGift({
    audio: { unlock: async () => true },
    media: {
      getSnapshot: () => ({ options: { gaze: false, recording: true }, recordingStatus: 'error', error: 'Camera permission denied.' }),
      prepare: async () => false,
      start,
    },
    onStart,
  })).rejects.toThrow('Camera permission denied.')
  expect(start).not.toHaveBeenCalled()
  expect(onStart).not.toHaveBeenCalled()

  await expect(openGift({
    audio: { unlock: async () => true },
    media: {
      getSnapshot: () => ({ options: { gaze: false, recording: true }, recordingStatus: 'ready', error: 'Storage unavailable.' }),
      start,
    },
    onStart,
  })).rejects.toThrow('Storage unavailable.')
  expect(onStart).not.toHaveBeenCalled()
})

it('does not start the film if local recorder startup throws', async () => {
  const onStart = vi.fn()
  await expect(openGift({
    audio: { unlock: async () => true },
    media: {
      getSnapshot: () => ({ options: { gaze: false, recording: true }, recordingStatus: 'ready', error: 'Recorder unavailable.' }),
      start: () => { throw new Error('Recorder unavailable') },
    },
    onStart,
  })).rejects.toThrow('Recorder unavailable.')
  expect(onStart).not.toHaveBeenCalled()
})
