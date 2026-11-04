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
  if (openingScopes.has(scope)) preset.openingBackground = structuredClone(config.scenes.openingBackground)
  return preset
}

export function parseScenePreset(value: unknown, expectedScope?: ScenePresetScope): ScenePresetV1 {
  if (!isRecord(value)) throw new ScenePresetValidationError('document')
  if (value.formatVersion !== 1) throw new ScenePresetValidationError('format-version')
  if (!Number.isInteger(value.configSchemaVersion) || Number(value.configSchemaVersion) < 1) {
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
  try {
    return structuredClone(value) as unknown as ScenePresetV1
  } catch {
    throw new ScenePresetValidationError('document')
  }
}

export function scenePresetPatch(preset: ScenePresetV1, expectedScope: ScenePresetScope): SceneComposerConfigPatch {
  const validPreset = parseScenePreset(preset, expectedScope)
  const scenes: Record<string, unknown> = { [validPreset.scope]: validPreset.scene }
  if (openingScopes.has(validPreset.scope) && validPreset.openingBackground !== undefined) {
    scenes.openingBackground = validPreset.openingBackground
  }
  return { scenes } as SceneComposerConfigPatch
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
