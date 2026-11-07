import { normalizeConfig } from '../systems/scene-config/config'
import { parseScenePreset, ScenePresetValidationError, type ScenePresetScope, type ScenePresetV1 } from './scenePresetModel'
import { createScenePresetStorage } from './scenePresetStorage'

export interface ScenePresetSummary { id: string; name: string; scope: ScenePresetScope; savedAt: string }
export class ScenePresetApiError extends Error { constructor(message: string, readonly status?: number) { super(message); this.name = 'ScenePresetApiError' } }
const endpoint = '/__scene-presets'
export function usesPackagedPresetStorage(protocol: string, hostname: string) {
  return protocol === 'app:' && hostname === 'bundle'
}

export function exportScenePresetJson(value: ScenePresetV1, expectedScope: ScenePresetScope = value.scope): string {
  try {
    return `${JSON.stringify(parseScenePreset(value, expectedScope, normalizeConfig), null, 2)}\n`
  } catch {
    throw new ScenePresetApiError('Не удалось экспортировать выбранный пресет.')
  }
}

export function importScenePresetJson(json: string, expectedScope: ScenePresetScope): ScenePresetV1 {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new ScenePresetApiError('Файл пресета содержит повреждённый JSON.')
  }

  try {
    return parseScenePreset(value, expectedScope, normalizeConfig)
  } catch (error) {
    if (error instanceof ScenePresetValidationError) {
      const message = error.code === 'scope-mismatch'
        ? 'Этот пресет предназначен для другой сцены.'
        : error.code === 'scene'
          ? 'Параметры пресета имеют неверный тип или выходят за допустимый диапазон.'
          : error.code === 'config-schema-version'
            ? 'Версия настроек в файле пресета не поддерживается.'
            : 'Файл пресета повреждён или имеет неверный формат.'
      throw new ScenePresetApiError(message)
    }
    throw new ScenePresetApiError('Файл пресета повреждён или имеет неверный формат.')
  }
}
let desktopStore: ReturnType<typeof createScenePresetStorage> | undefined
let seedPresets: Promise<unknown[]> | undefined
function packagedStore() {
  desktopStore ??= createScenePresetStorage(window.localStorage, async (scope) => {
    seedPresets ??= fetch('/scene-presets/index.json', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new ScenePresetApiError('Не удалось загрузить встроенные пресеты.', response.status)
      const values: unknown = await response.json()
      if (!Array.isArray(values)) throw new ScenePresetApiError('Некорректный список встроенных пресетов.')
      return values
    })
    return (await seedPresets).filter((preset) => !!preset && typeof preset === 'object'
      && (preset as Record<string, unknown>).scope === scope)
  })
  return desktopStore
}
async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response
  try { response = await fetch(`${endpoint}${path}`, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } }) }
  catch { throw new ScenePresetApiError('Не удалось подключиться к локальному хранилищу пресетов.') }
  if (!response.ok) {
    let message = 'Не удалось выполнить операцию с пресетом.'
    try { const data = await response.json() as { error?: string }; if (data.error === 'Invalid scope' || data.error === 'Invalid preset document') message = 'Файл пресета имеет неверный формат.' } catch { /* Keep the short fallback. */ }
    throw new ScenePresetApiError(message, response.status)
  }
  try { return await response.json() } catch { throw new ScenePresetApiError('Локальный сервер вернул некорректный ответ.', response.status) }
}
export async function listScenePresets(scope: ScenePresetScope): Promise<ScenePresetSummary[]> {
  if (usesPackagedPresetStorage(window.location.protocol, window.location.hostname)) return packagedStore().list(scope)
  const value = await request(`?scope=${encodeURIComponent(scope)}`) as { presets?: unknown }
  if (!Array.isArray(value?.presets)) throw new ScenePresetApiError('Некорректный список пресетов.')
  return value.presets.map(item => {
    if (!item || typeof item !== 'object') throw new ScenePresetApiError('Некорректный список пресетов.')
    const preset = item as Record<string, unknown>
    if (preset.scope !== scope || typeof preset.id !== 'string' || typeof preset.name !== 'string' || typeof preset.savedAt !== 'string') throw new ScenePresetApiError('Некорректный список пресетов.')
    return { id: preset.id, name: preset.name, scope, savedAt: preset.savedAt }
  })
}
export async function readScenePreset(scope: ScenePresetScope, id: string): Promise<ScenePresetV1> {
  if (usesPackagedPresetStorage(window.location.protocol, window.location.hostname)) return packagedStore().read(scope, id)
  try { return parseScenePreset(await request(`/${encodeURIComponent(id)}?scope=${encodeURIComponent(scope)}`), scope, normalizeConfig) }
  catch (error) { if (error instanceof ScenePresetApiError) throw error; throw new ScenePresetApiError('Пресет не подходит для выбранной сцены.') }
}
export async function saveScenePreset(
  preset: ScenePresetV1,
  expectedScope: ScenePresetScope = preset.scope,
): Promise<ScenePresetV1> {
  let validated: ScenePresetV1
  try { validated = parseScenePreset(preset, expectedScope, normalizeConfig) }
  catch (error) {
    const message = error instanceof ScenePresetValidationError && error.code === 'scope-mismatch'
      ? 'Этот пресет предназначен для другой сцены.'
      : 'Параметры пресета имеют неверный тип или выходят за допустимый диапазон.'
    throw new ScenePresetApiError(message)
  }
  if (usesPackagedPresetStorage(window.location.protocol, window.location.hostname)) return packagedStore().save(validated, expectedScope)
  try { return parseScenePreset(await request('', { method: 'PUT', body: JSON.stringify(validated) }), expectedScope, normalizeConfig) }
  catch (error) { if (error instanceof ScenePresetApiError) throw error; throw new ScenePresetApiError('Не удалось сохранить пресет.') }
}
