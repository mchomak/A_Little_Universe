import { parseScenePreset, type ScenePresetScope, type ScenePresetV1 } from './scenePresetModel'

export interface ScenePresetSummary { id: string; name: string; scope: ScenePresetScope; savedAt: string }
interface KeyValueStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
type LoadSeedPresets = (scope: ScenePresetScope) => Promise<unknown[]>

const keyFor = (scope: ScenePresetScope) => `a-little-universe.scene-presets.v1.${scope}`
const maxPresetBytes = 256_000
const maxScopeBytes = 4_000_000

/** Persistent, local-only storage used by the packaged Electron origin. */
export function createScenePresetStorage(storage: KeyValueStorage, loadSeeds: LoadSeedPresets = async () => []) {
  const readScope = (scope: ScenePresetScope): ScenePresetV1[] => {
    const serialized = storage.getItem(keyFor(scope))
    if (!serialized) return []
    const values: unknown = JSON.parse(serialized)
    if (!Array.isArray(values)) throw new Error('Некорректный список пресетов.')
    return values.flatMap((value: unknown) => {
      try { return [parseScenePreset(value, scope)] } catch { return [] }
    })
  }

  const readAll = async (scope: ScenePresetScope): Promise<ScenePresetV1[]> => {
    const [seeds, saved] = await Promise.all([loadSeeds(scope), Promise.resolve(readScope(scope))])
    const byId = new Map<string, ScenePresetV1>()
    for (const value of seeds) {
      try { const preset = parseScenePreset(value, scope); byId.set(preset.id, preset) } catch { /* Ignore invalid packaged seeds. */ }
    }
    for (const preset of saved) byId.set(preset.id, preset)
    return [...byId.values()]
  }

  const list = async (scope: ScenePresetScope): Promise<ScenePresetSummary[]> => (await readAll(scope))
    .map(({ id, name, scope: presetScope, savedAt }) => ({ id, name, scope: presetScope, savedAt }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id))

  const read = async (scope: ScenePresetScope, id: string): Promise<ScenePresetV1> => {
    const preset = (await readAll(scope)).find((item) => item.id === id)
    if (!preset) throw new Error('Пресет не найден или не подходит для выбранной сцены.')
    return preset
  }

  const save = async (value: ScenePresetV1): Promise<ScenePresetV1> => {
    const parsed = parseScenePreset(value)
    const preset = parseScenePreset(parsed, parsed.scope)
    if (preset.name.trim().length > 80 || [...preset.name].some((character) => character.charCodeAt(0) < 32)) {
      throw new Error('Название пресета должно содержать до 80 символов.')
    }
    if (new TextEncoder().encode(JSON.stringify(preset)).byteLength > maxPresetBytes) {
      throw new Error('Размер пресета превышает допустимый предел.')
    }
    const values = [...(await readAll(preset.scope)).filter((item) => item.id !== preset.id)]
    values.push(preset)
    const serialized = JSON.stringify(values)
    if (new TextEncoder().encode(serialized).byteLength > maxScopeBytes) {
      throw new Error('Размер пресетов для сцены превышает допустимый предел.')
    }
    storage.setItem(keyFor(preset.scope), serialized)
    return preset
  }

  return { list, read, save }
}
