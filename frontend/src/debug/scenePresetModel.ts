import type { SceneComposerConfig, SceneComposerConfigPatch } from '../systems/scene-config/config'

export type ScenePresetScope = 'preload' | 'prologue' | 'growth' | 'bloom' | 'identity' | 'gallery' | 'galaxy'

export interface ScenePresetV1 {
  formatVersion: 1
  configSchemaVersion: number
  id: string
  name: string
  scope: ScenePresetScope
  savedAt: string
  scene: SceneComposerConfig['scenes'][ScenePresetScope]
  openingBackground?: SceneComposerConfig['scenes']['openingBackground']
}

export type ScenePresetValidationErrorCode =
  | 'document'
  | 'format-version'
  | 'config-schema-version'
  | 'id'
  | 'name'
  | 'scope'
  | 'scope-mismatch'
  | 'saved-at'
  | 'scene'
  | 'opening-background'

export class ScenePresetValidationError extends Error {
  constructor(readonly code: ScenePresetValidationErrorCode) {
    super(`Invalid scene preset: ${code}`)
    this.name = 'ScenePresetValidationError'
  }
}

const presetScopes = new Set<ScenePresetScope>(['preload', 'prologue', 'growth', 'bloom', 'identity', 'gallery', 'galaxy'])
const openingScopes = new Set<ScenePresetScope>(['preload', 'prologue', 'growth', 'bloom', 'identity'])
const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/
const currentConfigSchemaVersion = 26

type ScenePresetNormalizer = (input: unknown) => SceneComposerConfig

export function captureScenePreset(config: SceneComposerConfig, scope: ScenePresetScope, name: string): ScenePresetV1 {
  if (!name.trim()) throw new ScenePresetValidationError('name')
  const preset: ScenePresetV1 = {
    formatVersion: 1,
    configSchemaVersion: config.schemaVersion,
    id: globalThis.crypto.randomUUID(),
    name,
    scope,
    savedAt: new Date().toISOString(),
    scene: structuredClone(config.scenes[scope]),
  }
  return preset
}

export function parseScenePreset(
  value: unknown,
  expectedScope?: ScenePresetScope,
  normalizeConfig?: ScenePresetNormalizer,
): ScenePresetV1 {
  if (!isRecord(value)) throw new ScenePresetValidationError('document')
  if (value.formatVersion !== 1) throw new ScenePresetValidationError('format-version')
  if (
    !Number.isInteger(value.configSchemaVersion)
    || Number(value.configSchemaVersion) < 1
    || Number(value.configSchemaVersion) > currentConfigSchemaVersion
  ) {
    throw new ScenePresetValidationError('config-schema-version')
  }
  if (typeof value.id !== 'string' || !safeIdPattern.test(value.id)) throw new ScenePresetValidationError('id')
  if (typeof value.name !== 'string' || !value.name.trim()) throw new ScenePresetValidationError('name')
  if (typeof value.scope !== 'string' || !presetScopes.has(value.scope as ScenePresetScope)) {
    throw new ScenePresetValidationError('scope')
  }
  if (expectedScope !== undefined && value.scope !== expectedScope) {
    throw new ScenePresetValidationError('scope-mismatch')
  }
  const scope = value.scope as ScenePresetScope
  if (typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt))) {
    throw new ScenePresetValidationError('saved-at')
  }
  if (!isRecord(value.scene)) throw new ScenePresetValidationError('scene')
  if ('openingBackground' in value && (!openingScopes.has(scope) || !isRecord(value.openingBackground))) {
    throw new ScenePresetValidationError('opening-background')
  }
  let scene: ScenePresetV1['scene']
  try {
    scene = structuredClone(value.scene) as ScenePresetV1['scene']
  } catch {
    throw new ScenePresetValidationError('document')
  }
  if (normalizeConfig) validateSceneValues(scene, scope, normalizeConfig)
  try {
    const preset: ScenePresetV1 = {
      formatVersion: 1,
      configSchemaVersion: Number(value.configSchemaVersion),
      id: value.id,
      name: value.name,
      scope,
      savedAt: value.savedAt,
      scene,
    }
    if ('openingBackground' in value) {
      preset.openingBackground = structuredClone(value.openingBackground) as SceneComposerConfig['scenes']['openingBackground']
    }
    return preset
  } catch {
    throw new ScenePresetValidationError('document')
  }
}

export function scenePresetPatch(preset: ScenePresetV1, expectedScope: ScenePresetScope): SceneComposerConfigPatch {
  const validPreset = parseScenePreset(preset, expectedScope)
  const scenes: Record<string, unknown> = { [validPreset.scope]: structuredClone(validPreset.scene) }
  return { scenes } as SceneComposerConfigPatch
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateSceneValues(
  scene: ScenePresetV1['scene'],
  scope: ScenePresetScope,
  normalizeConfig: ScenePresetNormalizer,
): void {
  try {
    const normalizedConfig = normalizeConfig({
      schemaVersion: currentConfigSchemaVersion,
      scenes: { [scope]: scene },
    })
    const normalizedScene = normalizedConfig.scenes[scope]
    if (!matchesKnownValues(scene, normalizedScene)) throw new Error('Scene values were normalized')
  } catch {
    throw new ScenePresetValidationError('scene')
  }
}

function matchesKnownValues(candidate: unknown, normalized: unknown): boolean {
  if (Array.isArray(candidate)) {
    return Array.isArray(normalized)
      && candidate.length === normalized.length
      && candidate.every((value, index) => matchesKnownValues(value, normalized[index]))
  }
  if (isRecord(candidate)) {
    if (!isRecord(normalized)) return false
    return Object.entries(candidate).every(([key, value]) => {
      if (!Object.prototype.hasOwnProperty.call(normalized, key)) return true
      return matchesKnownValues(value, normalized[key])
    })
  }
  return Object.is(candidate, normalized)
}
