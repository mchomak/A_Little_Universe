import {
  normalizeMusicTransitionSettings,
  type MusicTransitionSettings,
} from './musicSettings'

export const MUSIC_TRANSITION_PRESETS_STORAGE_KEY = 'a-little-universe:music-transition-presets:v1'

export interface MusicTransitionPreset {
  name: string
  settings: MusicTransitionSettings
}

type PresetStorage = Pick<Storage, 'getItem' | 'setItem'>

function browserStorage(): PresetStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

function presetName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim().slice(0, 64)
  return name ? name : null
}

function parsePresets(value: unknown): MusicTransitionPreset[] {
  if (!Array.isArray(value)) return []
  const unique = new Map<string, MusicTransitionPreset>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const source = entry as Record<string, unknown>
    const name = presetName(source.name)
    if (!name) continue
    unique.set(name.toLocaleLowerCase(), {
      name,
      settings: normalizeMusicTransitionSettings(source.settings),
    })
  }
  return [...unique.values()]
}

export function getMusicTransitionPresets(storage: PresetStorage | undefined = browserStorage()): MusicTransitionPreset[] {
  if (!storage) return []
  try {
    const serialized = storage.getItem(MUSIC_TRANSITION_PRESETS_STORAGE_KEY)
    return serialized === null ? [] : parsePresets(JSON.parse(serialized))
  } catch {
    return []
  }
}

function persistPresets(presets: MusicTransitionPreset[], storage: PresetStorage | undefined): void {
  if (!storage) return
  try { storage.setItem(MUSIC_TRANSITION_PRESETS_STORAGE_KEY, JSON.stringify(presets)) } catch { /* Storage can be unavailable in private contexts. */ }
}

export function saveMusicTransitionPreset(
  nameValue: string,
  settings: MusicTransitionSettings,
  storage: PresetStorage | undefined = browserStorage(),
): MusicTransitionPreset[] {
  const name = presetName(nameValue)
  const presets = getMusicTransitionPresets(storage)
  if (!name) return presets

  const existingIndex = presets.findIndex((preset) => preset.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  const preset = { name: existingIndex >= 0 ? presets[existingIndex]!.name : name, settings: normalizeMusicTransitionSettings(settings) }
  if (existingIndex >= 0) presets[existingIndex] = preset
  else presets.push(preset)
  persistPresets(presets, storage)
  return presets
}

export function deleteMusicTransitionPreset(
  nameValue: string,
  storage: PresetStorage | undefined = browserStorage(),
): MusicTransitionPreset[] {
  const name = presetName(nameValue)
  const presets = getMusicTransitionPresets(storage).filter((preset) => preset.name.toLocaleLowerCase() !== name?.toLocaleLowerCase())
  persistPresets(presets, storage)
  return presets
}
