import { expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG, getConfig, resetConfig, updateConfig } from '../systems/scene-config/config'
import { captureScenePreset, parseScenePreset, scenePresetPatch } from './scenePresetModel'

it('captures the complete scene and its shared opening background', () => {
  const config = {
    ...DEFAULT_SCENE_COMPOSER_CONFIG,
    scenes: {
      ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
      growth: {
        ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth,
        formationDuration: 3.5,
        flowerGrowthDuration: 14,
      },
    },
  }

  const preset = captureScenePreset(config, 'growth', 'Long growth')

  expect(preset).toMatchObject({
    formatVersion: 1,
    configSchemaVersion: 23,
    name: 'Long growth',
    scope: 'growth',
    scene: config.scenes.growth,
    openingBackground: config.scenes.openingBackground,
  })
  expect(preset.id).toMatch(/^[a-zA-Z0-9_-]+$/)
  expect(Number.isNaN(Date.parse(preset.savedAt))).toBe(false)
})

it('rejects an empty capture name with a stable validation code', () => {
  let caught: unknown
  try {
    captureScenePreset(DEFAULT_SCENE_COMPOSER_CONFIG, 'growth', '   ')
  } catch (error) {
    caught = error
  }

  expect(caught).toMatchObject({ name: 'ScenePresetValidationError', code: 'name' })
})

it('parses a partial known scene configuration for normalization by the config store', () => {
  const document = {
    formatVersion: 1,
    configSchemaVersion: 14,
    id: 'growth-long',
    name: 'Long growth',
    scope: 'growth',
    savedAt: '2026-11-03T10:00:00.000Z',
    scene: { formationDuration: 3.5 },
  }

  expect(parseScenePreset(document, 'growth')).toEqual(document)
})

it('rejects a preset with a blank display name', () => {
  let caught: unknown
  try {
    parseScenePreset({
      formatVersion: 1,
      configSchemaVersion: 21,
      id: 'growth-long',
      name: '  ',
      scope: 'growth',
      savedAt: '2026-11-03T10:00:00.000Z',
      scene: { formationDuration: 3.5 },
    })
  } catch (error) {
    caught = error
  }

  expect(caught).toMatchObject({ name: 'ScenePresetValidationError', code: 'name' })
})

it('rejects a preset format version it does not support with a stable error code', () => {
  let caught: unknown
  try {
    parseScenePreset({
      formatVersion: 2,
      configSchemaVersion: 21,
      id: 'growth-long',
      name: 'Long growth',
      scope: 'growth',
      savedAt: '2026-11-03T10:00:00.000Z',
      scene: { formationDuration: 3.5 },
    }, 'growth')
  } catch (error) {
    caught = error
  }

  expect(caught).toBeInstanceOf(Error)
  expect(caught).toMatchObject({ name: 'ScenePresetValidationError', code: 'format-version' })
})

it('rejects an empty preset id with a stable validation code', () => {
  let caught: unknown
  try {
    parseScenePreset({
      formatVersion: 1,
      configSchemaVersion: 21,
      id: '',
      name: 'Long growth',
      scope: 'growth',
      savedAt: '2026-11-03T10:00:00.000Z',
      scene: { formationDuration: 3.5 },
    })
  } catch (error) {
    caught = error
  }

  expect(caught).toMatchObject({ name: 'ScenePresetValidationError', code: 'id' })
})

it('rejects a preset saved for another active scope', () => {
  let caught: unknown
  try {
    parseScenePreset({
      formatVersion: 1,
      configSchemaVersion: 21,
      id: 'growth-long',
      name: 'Long growth',
      scope: 'growth',
      savedAt: '2026-11-03T10:00:00.000Z',
      scene: { formationDuration: 3.5 },
    }, 'gallery')
  } catch (error) {
    caught = error
  }

  expect(caught).toMatchObject({ name: 'ScenePresetValidationError', code: 'scope-mismatch' })
})

it('rejects opening background data for a scope that does not use it', () => {
  let caught: unknown
  try {
    parseScenePreset({
      formatVersion: 1,
      configSchemaVersion: 21,
      id: 'gallery-night',
      name: 'Gallery night',
      scope: 'gallery',
      savedAt: '2026-11-03T10:00:00.000Z',
      scene: { moonBrightness: 1.2 },
      openingBackground: { zoom: 1, offsetX: 0, offsetY: 0 },
    }, 'gallery')
  } catch (error) {
    caught = error
  }

  expect(caught).toMatchObject({ name: 'ScenePresetValidationError', code: 'opening-background' })
})

it('builds an application patch containing only the selected scene and linked opening background', () => {
  const config = DEFAULT_SCENE_COMPOSER_CONFIG
  const preset = captureScenePreset(config, 'growth', 'Long growth')

  expect(scenePresetPatch(preset, 'growth')).toEqual({
    scenes: {
      growth: config.scenes.growth,
      openingBackground: config.scenes.openingBackground,
    },
  })
})

it('applies a partial preset without changing unrelated branches or retaining unknown fields', async () => {
  await resetConfig('all')
  try {
    const before = await updateConfig({
      global: { quality: 'low' },
      scenes: { prologue: { fontSize: 80 }, growth: { flowerGrowthDuration: 14 } },
    })
    const preset = parseScenePreset({
      formatVersion: 1,
      configSchemaVersion: 14,
      id: 'growth-partial',
      name: 'Partial growth',
      scope: 'growth',
      savedAt: '2026-11-03T10:00:00.000Z',
      scene: { formationDuration: 3.5, futureSetting: true },
    }, 'growth')

    await updateConfig(scenePresetPatch(preset, 'growth'))
    const after = getConfig()

    expect(after.scenes.growth.formationDuration).toBe(3.5)
    expect(after.scenes.growth.flowerGrowthDuration).toBe(14)
    expect(after.scenes.growth).not.toHaveProperty('futureSetting')
    expect(after.scenes.prologue).toEqual(before.scenes.prologue)
    expect(after.global).toEqual(before.global)
    expect(after.scenes.openingBackground).toEqual(before.scenes.openingBackground)
  } finally {
    await resetConfig('all')
  }
})

