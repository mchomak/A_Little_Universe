import { expect, it, vi } from 'vitest'
import {
  getMusicSettings,
  MUSIC_SETTINGS_DEFAULTS,
  MUSIC_SETTINGS_STORAGE_KEY,
  normalizeMusicSettings,
  saveMusicSettings,
  subscribeMusicSettings,
} from './musicSettings'

it('normalizes the independent music settings against bounded defaults', () => {
  expect(MUSIC_SETTINGS_STORAGE_KEY).toBe('a-little-universe:music:v1')
  expect(MUSIC_SETTINGS_DEFAULTS).toEqual({
    enabled: true,
    volume: 1,
    fadeOutSeconds: 8,
    silenceSeconds: 1,
    fadeInSeconds: 8,
    introStartOffset: 68,
    outroStartOffset: 0,
    introGain: 1,
    galleryGain: 1,
    outroGain: 1,
  })
  expect(normalizeMusicSettings({
    enabled: false,
    volume: 2,
    fadeOutSeconds: 0.1,
    silenceSeconds: 40,
    fadeInSeconds: 32,
    introStartOffset: -4,
    outroStartOffset: 900,
    introGain: Number.NaN,
    galleryGain: 0.5,
    outroGain: -1,
  })).toEqual({
    enabled: false,
    volume: 1,
    fadeOutSeconds: 0.25,
    silenceSeconds: 10,
    fadeInSeconds: 30,
    introStartOffset: 0,
    outroStartOffset: 600,
    introGain: 1,
    galleryGain: 0.5,
    outroGain: 0,
  })
})

it('migrates the earlier shared fade scale into independent transition timings', () => {
  expect(normalizeMusicSettings({ fadeScale: 2 })).toMatchObject({
    fadeOutSeconds: 16,
    silenceSeconds: 1,
    fadeInSeconds: 16,
  })
})

it('recovers from corrupt storage and saves updates under the separate versioned key', () => {
  const entries = new Map<string, string>([[MUSIC_SETTINGS_STORAGE_KEY, '{broken']])
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
  }
  const listener = vi.fn()
  const unsubscribe = subscribeMusicSettings(listener)

  expect(getMusicSettings(storage)).toEqual(MUSIC_SETTINGS_DEFAULTS)
  const saved = saveMusicSettings({ volume: 0.4, galleryGain: 0.7 }, storage)
  expect(saved).toMatchObject({ volume: 0.4, galleryGain: 0.7, introStartOffset: 68 })
  expect(JSON.parse(entries.get(MUSIC_SETTINGS_STORAGE_KEY)!)).toEqual(saved)
  expect(entries.size).toBe(1)
  expect(listener).toHaveBeenCalledWith(saved)
  unsubscribe()
})
