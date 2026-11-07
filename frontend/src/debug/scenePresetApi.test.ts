import { expect, it, vi } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { captureScenePreset, type ScenePresetScope } from './scenePresetModel'
import { exportScenePresetJson, importScenePresetJson, saveScenePreset, usesPackagedPresetStorage } from './scenePresetApi'

const scopes: ScenePresetScope[] = ['preload', 'prologue', 'growth', 'bloom', 'identity', 'gallery', 'galaxy']

it('uses persistent packaged storage only for the trusted Electron origin', () => {
  expect(usesPackagedPresetStorage('app:', 'bundle')).toBe(true)
  expect(usesPackagedPresetStorage('https:', 'bundle')).toBe(false)
  expect(usesPackagedPresetStorage('app:', 'attacker')).toBe(false)
})

it.each(scopes)('round-trips only the %s preset as JSON v1', (scope) => {
  const preset = captureScenePreset(DEFAULT_SCENE_COMPOSER_CONFIG, scope, `Проверка ${scope}`)

  const json = exportScenePresetJson(preset)

  expect(JSON.parse(json)).toMatchObject({ formatVersion: 1, scope })
  expect(importScenePresetJson(json, scope)).toEqual(preset)
})

it('reports malformed JSON in Russian', () => {
  expect(() => importScenePresetJson('{', 'growth')).toThrow(/повреждённый JSON/)
})

it('rejects a preset for another scope and invalid known values before returning it', () => {
  const preset = captureScenePreset(DEFAULT_SCENE_COMPOSER_CONFIG, 'growth', 'Рост')

  expect(() => importScenePresetJson(JSON.stringify(preset), 'gallery')).toThrow(/другой сцены/)
  expect(() => importScenePresetJson(JSON.stringify({
    ...preset,
    scene: { ...preset.scene, formationDuration: 4 },
  }), 'growth')).toThrow(/допустимый диапазон/)
})

it('rejects saving a preset relabeled for another scene before sending it to storage', async () => {
  const preset = captureScenePreset(DEFAULT_SCENE_COMPOSER_CONFIG, 'growth', 'Рост')
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(preset), { status: 200 }))
  vi.stubGlobal('window', { location: { protocol: 'https:', hostname: 'localhost' } })
  vi.stubGlobal('fetch', fetch)

  try {
    await expect(saveScenePreset({ ...preset, scope: 'gallery' }, 'growth')).rejects.toThrow(/другой сцены/)
    expect(fetch).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
  }
})
