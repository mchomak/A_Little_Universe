import { describe, expect, it } from 'vitest'
import { copyParticlePortraitSettings, DEFAULT_PARTICLE_PORTRAIT_SETTINGS, loadParticlePortraitSettings, parseParticlePortraitSettings, saveParticlePortraitSettings, serializeParticlePortraitSettings, setParticlePortraitSetting } from './config'

describe('particle portrait settings', () => {
  it('starts with the tuned version 1 defaults for a legible static portrait', () => {
    expect(DEFAULT_PARTICLE_PORTRAIT_SETTINGS).toEqual({
      version: 1,
      count: 32_000,
      minSize: 1.2,
      maxSize: 2.8,
      brightness: 2,
      opacity: 1,
      glow: 1.8,
      detailBoost: 2,
      fillDensity: 1.9,
      contrast: 1.75,
      backgroundThreshold: 0.16,
      irregularity: 0.55,
      photoColorMix: 0.25,
      scale: 0.95,
      offsetX: 0,
      offsetY: 0,
    })
  })

  it('preserves a complete version 1 settings export when parsing it', () => {
    const input = { ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS, count: 12_000, offsetX: 0.2 }

    expect(parseParticlePortraitSettings(input)).toEqual(input)
  })

  it('clamps control values to documented bounds and keeps the size range ordered', () => {
    const brighter = setParticlePortraitSetting(DEFAULT_PARTICLE_PORTRAIT_SETTINGS, 'brightness', 4)
    const denser = setParticlePortraitSetting(brighter, 'count', 1_000)
    const smaller = setParticlePortraitSetting(denser, 'maxSize', 0.8)

    expect(brighter.brightness).toBe(2)
    expect(denser.count).toBe(4_000)
    expect(smaller.maxSize).toBe(0.8)
    expect(smaller.minSize).toBe(0.8)
  })

  it('falls back to in-memory defaults when local storage access is denied', () => {
    const deniedStorage = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
      removeItem: () => { throw new Error('denied') },
    }

    expect(loadParticlePortraitSettings(deniedStorage)).toEqual({
      settings: DEFAULT_PARTICLE_PORTRAIT_SETTINGS,
      storageAvailable: false,
      invalidStoredValue: false,
    })
  })

  it('restores and saves a validated versioned settings object', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }
    const settings = { ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS, count: 20_000 }

    expect(saveParticlePortraitSettings(settings, storage)).toBe(true)
    expect(loadParticlePortraitSettings(storage).settings).toEqual(settings)
  })

  it('discards malformed saved JSON and uses the defaults', () => {
    const storage = {
      getItem: () => '{invalid-json',
      setItem: () => undefined,
    }

    expect(loadParticlePortraitSettings(storage)).toEqual({
      settings: DEFAULT_PARTICLE_PORTRAIT_SETTINGS,
      storageAvailable: true,
      invalidStoredValue: true,
    })
  })

  it('exports the complete validated settings as readable versioned JSON', () => {
    const settings = { ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS, count: 21_000 }
    const json = serializeParticlePortraitSettings(settings)

    expect(JSON.parse(json)).toEqual(settings)
    expect(json).toContain('\n  "count": 21000,')
  })

  it('returns a manual-copy fallback when clipboard write rejects', async () => {
    const settings = { ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS, count: 22_000 }
    const result = await copyParticlePortraitSettings(settings, { writeText: () => Promise.reject(new Error('denied')) })

    expect(result).toEqual({ copied: false, json: serializeParticlePortraitSettings(settings) })
  })
})
