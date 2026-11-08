import { expect, it } from 'vitest'
import {
  deleteMusicTransitionPreset,
  getMusicTransitionPresets,
  MUSIC_TRANSITION_PRESETS_STORAGE_KEY,
  saveMusicTransitionPreset,
} from './musicTransitionPresets'

function memoryStorage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial))
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
  }
}

it('saves independent, bounded transition profiles and replaces names case-insensitively', () => {
  const storage = memoryStorage()
  const first = saveMusicTransitionPreset('  Кино  ', {
    fadeOutSeconds: 12,
    silenceSeconds: 2.5,
    fadeInSeconds: 14,
  }, storage)

  expect(first).toEqual([{
    name: 'Кино',
    settings: { fadeOutSeconds: 12, silenceSeconds: 2.5, fadeInSeconds: 14 },
  }])
  expect(saveMusicTransitionPreset('кино', {
    fadeOutSeconds: 80,
    silenceSeconds: -1,
    fadeInSeconds: 4,
  }, storage)).toEqual([{
    name: 'Кино',
    settings: { fadeOutSeconds: 30, silenceSeconds: 0, fadeInSeconds: 4 },
  }])
  expect(JSON.parse(storage.entries.get(MUSIC_TRANSITION_PRESETS_STORAGE_KEY)!)).toEqual([
    { name: 'Кино', settings: { fadeOutSeconds: 30, silenceSeconds: 0, fadeInSeconds: 4 } },
  ])
})

it('recovers from corrupt preset storage and deletes a saved profile', () => {
  const storage = memoryStorage({ [MUSIC_TRANSITION_PRESETS_STORAGE_KEY]: '{bad json' })
  expect(getMusicTransitionPresets(storage)).toEqual([])

  saveMusicTransitionPreset('Soft', {
    fadeOutSeconds: 9,
    silenceSeconds: 1,
    fadeInSeconds: 11,
  }, storage)

  expect(deleteMusicTransitionPreset('soft', storage)).toEqual([])
  expect(getMusicTransitionPresets(storage)).toEqual([])
})
