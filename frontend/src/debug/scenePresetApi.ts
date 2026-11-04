import { parseScenePreset, type ScenePresetScope, type ScenePresetV1 } from './scenePresetModel'

export interface ScenePresetSummary { id: string; name: string; scope: ScenePresetScope; savedAt: string }
export class ScenePresetApiError extends Error { constructor(message: string, readonly status?: number) { super(message); this.name = 'ScenePresetApiError' } }
const endpoint = '/__scene-presets'
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
  try { return parseScenePreset(await request(`/${encodeURIComponent(id)}?scope=${encodeURIComponent(scope)}`), scope) }
  catch (error) { if (error instanceof ScenePresetApiError) throw error; throw new ScenePresetApiError('Пресет не подходит для выбранной сцены.') }
}
export async function saveScenePreset(preset: ScenePresetV1): Promise<ScenePresetV1> {
  try { return parseScenePreset(await request('', { method: 'PUT', body: JSON.stringify(preset) }), preset.scope) }
  catch (error) { if (error instanceof ScenePresetApiError) throw error; throw new ScenePresetApiError('Не удалось сохранить пресет.') }
}
