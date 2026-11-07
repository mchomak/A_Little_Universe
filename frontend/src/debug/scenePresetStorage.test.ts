import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG } from '../systems/scene-config/config'
import { captureScenePreset } from './scenePresetModel'
import { createScenePresetStorage } from './scenePresetStorage'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem(key: string) { return values.get(key) ?? null },
    setItem(key: string, value: string) { values.set(key, value) },
  }
}

describe('packaged scene preset storage', () => {
  it('persists and lists presets by scope, then reads the selected preset', async () => {
    const backing = memoryStorage()
    const store = createScenePresetStorage(backing)
    const preset = captureScenePreset(DEFAULT_SCENE_COMPOSER_CONFIG, 'growth', 'Долгий рост')

    await expect(store.save(preset)).resolves.toEqual(preset)
    await expect(store.list('growth')).resolves.toEqual([{ id: preset.id, name: preset.name, scope: 'growth', savedAt: preset.savedAt }])
    await expect(store.list('gallery')).resolves.toEqual([])
    await expect(store.read('growth', preset.id)).resolves.toEqual(preset)
    expect(backing.values.size).toBe(1)
  })

  it('replaces by stable id and rejects a preset from a different scene scope', async () => {
    const store = createScenePresetStorage(memoryStorage())
    const preset = captureScenePreset(DEFAULT_SCENE_COMPOSER_CONFIG, 'growth', 'Рост')
    await store.save(preset)
    await store.save({ ...preset, name: 'Рост 2' })

    await expect(store.list('growth')).resolves.toHaveLength(1)
    await expect(store.read('growth', preset.id)).resolves.toMatchObject({ name: 'Рост 2' })
    await expect(store.save({ ...preset, scope: 'gallery' }, 'growth')).rejects.toThrow()
    await expect(store.read('gallery', preset.id)).rejects.toThrow(/не найден/)
  })

  it('rejects invalid known scene values before writing storage', async () => {
    const backing = memoryStorage()
    const store = createScenePresetStorage(backing)
    const preset = captureScenePreset(DEFAULT_SCENE_COMPOSER_CONFIG, 'growth', 'Рост')
    const invalidPreset = { ...preset, scene: { ...preset.scene, formationDuration: 4 } }

    await expect(store.save(invalidPreset)).rejects.toThrow()
    expect(backing.values.size).toBe(0)
  })

  it('does not return stored presets with invalid known scene values', async () => {
    const backing = memoryStorage()
    const store = createScenePresetStorage(backing)
    const preset = captureScenePreset(DEFAULT_SCENE_COMPOSER_CONFIG, 'growth', 'Рост')
    const invalidPreset = { ...preset, scene: { ...preset.scene, formationDuration: 4 } }
    backing.setItem('a-little-universe.scene-presets.v1.growth', JSON.stringify([invalidPreset]))

    await expect(store.list('growth')).resolves.toEqual([])
  })

  it('shows packaged presets on first run and lets user values replace a seed by id', async () => {
    const storage = memoryStorage()
    const seed = captureScenePreset(DEFAULT_SCENE_COMPOSER_CONFIG, 'growth', 'Исходный пресет')
    const store = createScenePresetStorage(storage, async (scope) => scope === 'growth' ? [seed] : [])

    await expect(store.list('growth')).resolves.toEqual([{ id: seed.id, name: seed.name, scope: 'growth', savedAt: seed.savedAt }])
    await expect(store.read('growth', seed.id)).resolves.toEqual(seed)
    await store.save({ ...seed, name: 'Пользовательская версия' })
    await expect(store.list('growth')).resolves.toMatchObject([{ id: seed.id, name: 'Пользовательская версия' }])
  })
})
