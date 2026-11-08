import { MUSIC_CONFIG } from './musicCatalog'

export const MUSIC_SETTINGS_STORAGE_KEY = 'a-little-universe:music:v1'

export interface MusicTransitionSettings {
  fadeOutSeconds: number
  silenceSeconds: number
  fadeInSeconds: number
}

export interface MusicSettings extends MusicTransitionSettings {
  enabled: boolean
  volume: number
  introStartOffset: number
  outroStartOffset: number
  introGain: number
  galleryGain: number
  outroGain: number
}

export const MUSIC_SETTINGS_DEFAULTS: Readonly<MusicSettings> = Object.freeze({
  enabled: true,
  volume: MUSIC_CONFIG.masterVolume,
  fadeOutSeconds: 8,
  silenceSeconds: 1,
  fadeInSeconds: 8,
  introStartOffset: MUSIC_CONFIG.intro.startOffset,
  outroStartOffset: MUSIC_CONFIG.outro.startOffset,
  introGain: MUSIC_CONFIG.groupGains.intro,
  galleryGain: MUSIC_CONFIG.groupGains.gallery,
  outroGain: MUSIC_CONFIG.groupGains.outro,
})

type MusicStorage = Pick<Storage, 'getItem' | 'setItem'>
type MusicSettingsListener = (settings: MusicSettings) => void

const listeners = new Set<MusicSettingsListener>()

function browserStorage(): MusicStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

function bounded(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(minimum, Math.min(maximum, value))
}

export function normalizeMusicTransitionSettings(value: unknown): MusicTransitionSettings {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  // Older installs stored one multiplier; migrate it to independent fade lengths.
  const legacyScale = bounded(source.fadeScale, 1, 0.25, 3)
  return {
    fadeOutSeconds: bounded(source.fadeOutSeconds, 8 * legacyScale, 0.25, 30),
    silenceSeconds: bounded(source.silenceSeconds, 1, 0, 10),
    fadeInSeconds: bounded(source.fadeInSeconds, 8 * legacyScale, 0.25, 30),
  }
}

/** Normalize untrusted JSON or partial DEV updates without mutating the input. */
export function normalizeMusicSettings(value: unknown): MusicSettings {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : MUSIC_SETTINGS_DEFAULTS.enabled,
    volume: bounded(source.volume, MUSIC_SETTINGS_DEFAULTS.volume, 0, 1),
    ...normalizeMusicTransitionSettings(source),
    introStartOffset: bounded(source.introStartOffset, MUSIC_SETTINGS_DEFAULTS.introStartOffset, 0, 600),
    outroStartOffset: bounded(source.outroStartOffset, MUSIC_SETTINGS_DEFAULTS.outroStartOffset, 0, 600),
    introGain: bounded(source.introGain, MUSIC_SETTINGS_DEFAULTS.introGain, 0, 1),
    galleryGain: bounded(source.galleryGain, MUSIC_SETTINGS_DEFAULTS.galleryGain, 0, 1),
    outroGain: bounded(source.outroGain, MUSIC_SETTINGS_DEFAULTS.outroGain, 0, 1),
  }
}

export function getMusicSettings(storage: MusicStorage | undefined = browserStorage()): MusicSettings {
  if (!storage) return { ...MUSIC_SETTINGS_DEFAULTS }
  try {
    const serialized = storage.getItem(MUSIC_SETTINGS_STORAGE_KEY)
    return serialized === null ? { ...MUSIC_SETTINGS_DEFAULTS } : normalizeMusicSettings(JSON.parse(serialized))
  } catch {
    return { ...MUSIC_SETTINGS_DEFAULTS }
  }
}

export function saveMusicSettings(
  value: Partial<MusicSettings>,
  storage: MusicStorage | undefined = browserStorage(),
): MusicSettings {
  const settings = normalizeMusicSettings({ ...getMusicSettings(storage), ...value })
  if (storage) {
    try { storage.setItem(MUSIC_SETTINGS_STORAGE_KEY, JSON.stringify(settings)) } catch { /* Storage can be unavailable in private contexts. */ }
  }
  for (const listener of listeners) listener({ ...settings })
  return settings
}

export function subscribeMusicSettings(listener: MusicSettingsListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
