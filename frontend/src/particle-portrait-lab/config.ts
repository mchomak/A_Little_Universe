export interface ParticlePortraitSettings {
  version: 1
  count: number
  minSize: number
  maxSize: number
  brightness: number
  opacity: number
  glow: number
  detailBoost: number
  fillDensity: number
  contrast: number
  backgroundThreshold: number
  irregularity: number
  photoColorMix: number
  scale: number
  offsetX: number
  offsetY: number
}

export const DEFAULT_PARTICLE_PORTRAIT_SETTINGS: ParticlePortraitSettings = {
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
}

export function parseParticlePortraitSettings(_value: unknown): ParticlePortraitSettings {
  if (!_value || typeof _value !== 'object' || Array.isArray(_value)) throw new Error('Invalid particle portrait settings.')
  const input = _value as Record<string, unknown>
  if (input.version !== 1) throw new Error('Unsupported particle portrait settings version.')

  const result: ParticlePortraitSettings = { ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS }
  for (const key of SETTING_KEYS) {
    const value = input[key]
    const [min, max] = LIMITS[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new Error(`Invalid particle portrait setting: ${key}.`)
    }
    if (key === 'count' && !Number.isInteger(value)) throw new Error('Particle count must be an integer.')
    result[key] = value
  }
  if (result.minSize > result.maxSize) throw new Error('Minimum particle size cannot exceed its maximum.')
  return result
}

export type ParticlePortraitSettingKey = Exclude<keyof ParticlePortraitSettings, 'version'>
type SettingKey = ParticlePortraitSettingKey
const SETTING_KEYS: SettingKey[] = [
  'count', 'minSize', 'maxSize', 'brightness', 'opacity', 'glow', 'detailBoost', 'fillDensity', 'contrast',
  'backgroundThreshold', 'irregularity', 'photoColorMix', 'scale', 'offsetX', 'offsetY',
]

const LIMITS: Record<SettingKey, readonly [number, number]> = {
  count: [4_000, 32_000], minSize: [0.4, 1.6], maxSize: [0.8, 3], brightness: [0.2, 2], opacity: [0.2, 1],
  glow: [0, 2], detailBoost: [0.5, 2], fillDensity: [0.3, 2], contrast: [0.5, 1.8], backgroundThreshold: [0.05, 0.4],
  irregularity: [0, 1], photoColorMix: [0, 1], scale: [0.6, 1.2], offsetX: [-0.5, 0.5], offsetY: [-0.5, 0.5],
}

export function setParticlePortraitSetting(
  settings: ParticlePortraitSettings,
  key: SettingKey,
  value: number,
): ParticlePortraitSettings {
  const [minimum, maximum] = LIMITS[key]
  const boundedValue = Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : DEFAULT_PARTICLE_PORTRAIT_SETTINGS[key]))
  const next = { ...settings, [key]: key === 'count'
    ? minimum + Math.round((boundedValue - minimum) / 1_000) * 1_000
    : boundedValue } as ParticlePortraitSettings
  if (key === 'minSize' && next.minSize > next.maxSize) next.maxSize = next.minSize
  if (key === 'maxSize' && next.maxSize < next.minSize) next.minSize = next.maxSize
  return next
}

export interface ParticlePortraitStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const STORAGE_KEY = 'particle-portrait-lab-settings-v1'

function browserStorage(): ParticlePortraitStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function loadParticlePortraitSettings(storage: ParticlePortraitStorage | null = browserStorage()) {
  if (!storage) {
    return { settings: { ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS }, storageAvailable: false, invalidStoredValue: false }
  }
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return { settings: { ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS }, storageAvailable: true, invalidStoredValue: false }
    try {
      return { settings: parseParticlePortraitSettings(JSON.parse(raw)), storageAvailable: true, invalidStoredValue: false }
    } catch {
      return { settings: { ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS }, storageAvailable: true, invalidStoredValue: true }
    }
  } catch {
    return { settings: { ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS }, storageAvailable: false, invalidStoredValue: false }
  }
}

export function saveParticlePortraitSettings(
  settings: ParticlePortraitSettings,
  storage: ParticlePortraitStorage | null = browserStorage(),
): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(parseParticlePortraitSettings(settings)))
    return true
  } catch {
    return false
  }
}

export function serializeParticlePortraitSettings(settings: ParticlePortraitSettings): string {
  return JSON.stringify(parseParticlePortraitSettings(settings), null, 2)
}

export interface ParticlePortraitClipboard {
  writeText(value: string): Promise<void>
}

function browserClipboard(): ParticlePortraitClipboard | null {
  try {
    return typeof navigator === 'undefined' || !navigator.clipboard ? null : navigator.clipboard
  } catch {
    return null
  }
}

export async function copyParticlePortraitSettings(
  settings: ParticlePortraitSettings,
  clipboard: ParticlePortraitClipboard | null = browserClipboard(),
): Promise<{ copied: boolean; json: string }> {
  const json = serializeParticlePortraitSettings(settings)
  if (!clipboard) return { copied: false, json }
  try {
    await clipboard.writeText(json)
    return { copied: true, json }
  } catch {
    return { copied: false, json }
  }
}
