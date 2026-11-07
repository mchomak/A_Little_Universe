import { expect, it } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG, getConfig, normalizeConfig, resetConfig, updateConfig, type SceneComposerConfig } from '../systems/scene-config/config'
import { captureScenePreset, parseScenePreset, scenePresetPatch, type ScenePresetScope } from './scenePresetModel'

const presetScopes: ScenePresetScope[] = ['preload', 'prologue', 'growth', 'bloom', 'identity', 'gallery', 'galaxy']

it('captures only the selected scene and keeps its internal config keys', () => {
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
    configSchemaVersion: 26,
    name: 'Long growth',
    scope: 'growth',
    scene: config.scenes.growth,
  })
  expect(preset).not.toHaveProperty('openingBackground')
  expect(preset.scene).toHaveProperty('lilyBudGlow')
  expect(preset.scene).toHaveProperty('seedFallDuration')
  expect(preset.id).toMatch(/^[a-zA-Z0-9_-]+$/)
  expect(Number.isNaN(Date.parse(preset.savedAt))).toBe(false)
})

it.each(presetScopes)('captures and parses the existing %s preset scope', (scope) => {
  const preset = captureScenePreset(DEFAULT_SCENE_COMPOSER_CONFIG, scope, `Preset ${scope}`)

  expect(parseScenePreset(preset, scope, normalizeConfig)).toEqual(preset)
  expect(scenePresetPatch(preset, scope)).toEqual({
    scenes: { [scope]: DEFAULT_SCENE_COMPOSER_CONFIG.scenes[scope] },
  })
  expect(preset).not.toHaveProperty('openingBackground')
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

  expect(parseScenePreset(document, 'growth', normalizeConfig)).toEqual(document)
})

it('ignores additional preset envelope fields after validating the known envelope', () => {
  const parsed = parseScenePreset({
    formatVersion: 1,
    configSchemaVersion: 26,
    id: 'growth-with-extra-field',
    name: 'Growth',
    scope: 'growth',
    savedAt: '2026-11-03T10:00:00.000Z',
    scene: { formationDuration: 3.5 },
    futureEnvelopeField: 'ignored',
  }, 'growth')

  expect(parsed).not.toHaveProperty('futureEnvelopeField')
  expect(parsed.scene).toEqual({ formationDuration: 3.5 })
})

it('accepts only known Scene Composer schema versions', () => {
  const base = {
    formatVersion: 1,
    configSchemaVersion: 1,
    id: 'growth-old-schema',
    name: 'Old schema',
    scope: 'growth',
    savedAt: '2026-11-03T10:00:00.000Z',
    scene: { formationDuration: 3.5 },
  }

  for (let configSchemaVersion = 1; configSchemaVersion <= 26; configSchemaVersion += 1) {
    expect(parseScenePreset({ ...base, configSchemaVersion }, 'growth', normalizeConfig).configSchemaVersion)
      .toBe(configSchemaVersion)
  }
  expect(() => parseScenePreset({ ...base, configSchemaVersion: 27 }, 'growth'))
    .toThrowError(expect.objectContaining({ code: 'config-schema-version' }))
})

it('preserves a valid value from an old schema for the normalizer at the apply boundary', () => {
  const parsed = parseScenePreset({
    formatVersion: 1,
    configSchemaVersion: 16,
    id: 'growth-legacy-duration',
    name: 'Legacy growth',
    scope: 'growth',
    savedAt: '2026-11-03T10:00:00.000Z',
    scene: { seedFallDuration: 3.6 },
  }, 'growth', normalizeConfig)

  expect(parsed.scene).toEqual({ seedFallDuration: 3.6 })
})

it.each(['3.5', 4])('rejects invalid known scene values before patching: %s', (formationDuration) => {
  const document = {
    formatVersion: 1,
    configSchemaVersion: 26,
    id: 'growth-invalid-value',
    name: 'Invalid growth',
    scope: 'growth',
    savedAt: '2026-11-03T10:00:00.000Z',
    scene: { formationDuration },
  }

  expect(parseScenePreset(document, 'growth').scene).toEqual(document.scene)
  expect(() => parseScenePreset(document, 'growth', normalizeConfig))
    .toThrowError(expect.objectContaining({ code: 'scene' }))
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

it('builds an independent application patch containing only the selected scene', () => {
  const config = DEFAULT_SCENE_COMPOSER_CONFIG
  const preset = captureScenePreset(config, 'growth', 'Long growth')
  const patch = scenePresetPatch(preset, 'growth')

  expect(patch).toEqual({
    scenes: {
      growth: config.scenes.growth,
    },
  })
  const patchedGrowth = (patch.scenes as SceneComposerConfig['scenes']).growth
  expect(patchedGrowth).not.toBe(preset.scene)
  expect(patchedGrowth.lilyBudGlow).not.toBe((preset.scene as SceneComposerConfig['scenes']['growth']).lilyBudGlow)
})

it('reads a legacy opening background but does not apply it with the scoped scene', () => {
  const config = DEFAULT_SCENE_COMPOSER_CONFIG
  const legacyPreset = {
    ...captureScenePreset(config, 'growth', 'Legacy growth'),
    openingBackground: { zoom: 2, offsetX: 0.4, offsetY: -0.3 },
  }

  expect(parseScenePreset(legacyPreset, 'growth').openingBackground).toEqual(legacyPreset.openingBackground)
  expect(scenePresetPatch(legacyPreset, 'growth')).toEqual({ scenes: { growth: config.scenes.growth } })
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
      scene: { formationDuration: 3.5, futureSetting: true, lilyBudGlow: { enabled: false } },
    }, 'growth')

    await updateConfig(scenePresetPatch(preset, 'growth'))
    const after = getConfig()

    expect(after.scenes.growth.formationDuration).toBe(3.5)
    expect(after.scenes.growth.flowerGrowthDuration).toBe(14)
    expect(after.scenes.growth.lilyBudGlow.enabled).toBe(false)
    expect(after.scenes.growth.lilyBudGlow.intensity).toBe(before.scenes.growth.lilyBudGlow.intensity)
    expect(after.scenes.growth).not.toHaveProperty('futureSetting')
    expect(after.scenes.prologue).toEqual(before.scenes.prologue)
    expect(after.global).toEqual(before.global)
    expect(after.scenes.openingBackground).toEqual(before.scenes.openingBackground)
  } finally {
    await resetConfig('all')
  }
})

