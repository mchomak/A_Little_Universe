import {
  DEFAULT_SCENE_COMPOSER_CONFIG,
  SCENE_CONFIG_PRESETS,
  getConfig,
  normalizeConfig,
  resetConfig,
  updateConfig,
  type SceneComposerConfig,
  type SceneComposerConfigPatch,
  type ConfigResetScope,
  type ScenePresetId,
} from '../systems/scene-config/config'

export type ComposerFieldPath =
  | `global.${keyof SceneComposerConfig['global'] & string}`
  | `scenes.preload.${keyof SceneComposerConfig['scenes']['preload'] & string}`
  | `scenes.preparation.${keyof SceneComposerConfig['scenes']['preparation'] & string}`
  | `scenes.prologue.${keyof SceneComposerConfig['scenes']['prologue'] & string}`
  | `scenes.growth.${keyof SceneComposerConfig['scenes']['growth'] & string}`
  | `scenes.bloom.${keyof SceneComposerConfig['scenes']['bloom'] & string}`
  | `scenes.identity.${keyof SceneComposerConfig['scenes']['identity'] & string}`
  | `scenes.gallery.${keyof SceneComposerConfig['scenes']['gallery'] & string}`
  | `scenes.gallery.cloudLayers.${keyof SceneComposerConfig['scenes']['gallery']['cloudLayers'] & string}.${keyof SceneComposerConfig['scenes']['gallery']['cloudLayers']['far'] & string}`
  | `scenes.galaxy.${keyof SceneComposerConfig['scenes']['galaxy'] & string}`

export type ComposerImportResult =
  | { ok: true; config: SceneComposerConfig }
  | { ok: false; reason: 'json' | 'document' | 'version' | 'font' }

export type ComposerResetResult =
  | { ok: true; config: SceneComposerConfig }
  | { ok: false; reason: 'font'; config: SceneComposerConfig }

export function setComposerField(path: ComposerFieldPath, value: unknown) {
  if (path === 'global.dprMin' && typeof value === 'number') {
    const current = getConfig().global
    return updateConfig({ global: { dprMin: value, dprMax: Math.max(value, current.dprMax) } })
  }
  if (path === 'global.dprMax' && typeof value === 'number') {
    const current = getConfig().global
    return updateConfig({ global: { dprMin: Math.min(current.dprMin, value), dprMax: value } })
  }
  const parts = path.split('.')
  const patch = parts.reduceRight<unknown>((child, key) => ({ [key]: child }), value)
  return updateConfig(patch as SceneComposerConfigPatch)
}

export async function importComposerJson(source: string): Promise<ComposerImportResult> {
  let document: unknown
  try {
    document = JSON.parse(source)
  } catch {
    return { ok: false, reason: 'json' }
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) return { ok: false, reason: 'document' }
  if (!('schemaVersion' in document) || !Number.isInteger(document.schemaVersion) || Number(document.schemaVersion) < 1 || Number(document.schemaVersion) > 19) return { ok: false, reason: 'version' }
  const root = document as Record<string, unknown>
  if ('global' in root && !isRecord(root.global)) return { ok: false, reason: 'document' }
  if ('scenes' in root && !isRecord(root.scenes)) return { ok: false, reason: 'document' }
  const scenes = isRecord(root.scenes) ? root.scenes : {}
  for (const section of ['preload', 'preparation', 'prologue', 'growth', 'bloom', 'identity', 'gallery', 'galaxy']) {
    if (section in scenes && !isRecord(scenes[section])) return { ok: false, reason: 'document' }
  }
  const preparation = scenes.preparation as Record<string, unknown> | undefined
  const prologue = scenes.prologue as Record<string, unknown> | undefined
  const config = await updateConfig(createCloudCompatibleImportPatch(document, getConfig().scenes.gallery.cloudLayers))
  if (
    (preparation && 'fontFamily' in preparation && config.scenes.preparation.fontFamily !== normalizeConfigFont(preparation.fontFamily, 'preparation')) ||
    (prologue && 'fontFamily' in prologue && config.scenes.prologue.fontFamily !== normalizeConfigFont(prologue.fontFamily, 'prologue'))
  ) return { ok: false, reason: 'font' }
  return { ok: true, config }
}

function createCloudCompatibleImportPatch(
  document: unknown,
  activeCloudLayers: SceneComposerConfig['scenes']['gallery']['cloudLayers'],
): SceneComposerConfigPatch {
  const root = isRecord(document) ? document : {}
  const version = typeof root.schemaVersion === 'number' ? root.schemaVersion : 1
  const scenes = isRecord(root.scenes) ? root.scenes : undefined
  const gallery = scenes && isRecord(scenes.gallery) ? scenes.gallery : undefined
  if (!gallery || version >= 14) return document as SceneComposerConfigPatch

  const legacyKeys = ['cloudDensity', 'cloudOpacity', 'cloudIntensity', 'cloudScale', 'cloudLayerCount', 'cloudDriftSpeed', 'cloudForegroundAmount', 'cloudBackgroundAmount', 'cloudNearFloorAmount']
  if (!legacyKeys.some((key) => key in gallery)) return document as SceneComposerConfigPatch

  const normalizedLayers = normalizeConfig(document).scenes.gallery.cloudLayers
  const importedLayerSettings = isRecord(gallery.cloudLayers) ? gallery.cloudLayers : {}
  const hasCompleteLegacyOpacity = 'cloudOpacity' in gallery
    && 'cloudBackgroundAmount' in gallery
    && 'cloudForegroundAmount' in gallery
    && 'cloudNearFloorAmount' in gallery
  const legacyOpacity = finiteNumber(gallery.cloudOpacity, 0.88, 0, 1.8)
  const legacyRegionAmounts = {
    far: { key: 'cloudBackgroundAmount', fallback: 0.78 },
    mid: undefined,
    nearLow: { key: 'cloudForegroundAmount', fallback: 1 },
    waterline: { key: 'cloudNearFloorAmount', fallback: 1 },
  } as const
  const migratedLayers: Record<string, Record<string, unknown>> = {}
  for (const layer of ['far', 'mid', 'nearLow', 'waterline'] as const) {
    const migrated = normalizedLayers[layer]
    const importedLayer = isRecord(importedLayerSettings[layer]) ? importedLayerSettings[layer] : {}
    const fields: Record<string, unknown> = { ...importedLayer }
    if ('cloudLayerCount' in gallery) fields.count = migrated.count
    if ('cloudDensity' in gallery) fields.density = migrated.density
    if ('cloudScale' in gallery) fields.scale = migrated.scale
    if ('cloudIntensity' in gallery) fields.brightness = migrated.brightness
    if ('cloudDriftSpeed' in gallery) fields.driftSpeed = migrated.driftSpeed
    const hasLegacyOpacityInput = 'cloudOpacity' in gallery
      || 'cloudForegroundAmount' in gallery
      || 'cloudBackgroundAmount' in gallery
      || 'cloudNearFloorAmount' in gallery
    if (hasLegacyOpacityInput && !('opacity' in importedLayer)) {
      if (hasCompleteLegacyOpacity) {
        fields.opacity = migrated.opacity
      } else {
        const baseMultiplier = 'cloudOpacity' in gallery ? legacyOpacity / 0.88 : 1
        const regional = legacyRegionAmounts[layer]
        const regionalMultiplier = regional && regional.key in gallery
          ? finiteNumber(gallery[regional.key], regional.fallback, 0, 1.6) / regional.fallback
          : 1
        fields.opacity = activeCloudLayers[layer].opacity * baseMultiplier * regionalMultiplier
      }
    }
    migratedLayers[layer] = fields
  }

  return {
    ...root,
    scenes: {
      ...scenes,
      gallery: { ...gallery, cloudLayers: { ...importedLayerSettings, ...migratedLayers } },
    },
  } as SceneComposerConfigPatch
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback
}

export function exportComposerJson() {
  const config = getConfig()
  const prologue: Record<string, unknown> = { ...config.scenes.prologue }
  delete prologue.particleSpeed
  delete prologue.particleSpread
  delete prologue.particleReturnFraction
  const scenes = { ...config.scenes, prologue }
  return JSON.stringify({ ...config, scenes }, null, 2)
}

export function resetComposerField(path: ComposerFieldPath) {
  const value = path.split('.').reduce<unknown>((current, key) => {
    return (current as Record<string, unknown>)[key]
  }, DEFAULT_SCENE_COMPOSER_CONFIG)
  return setComposerField(path, value)
}

export function applyComposerPreset(id: ScenePresetId) {
  return updateConfig(SCENE_CONFIG_PRESETS[id].patch as SceneComposerConfigPatch)
}

export function resetComposerScope(scope: ConfigResetScope) {
  return resetConfig(scope).then((config): ComposerResetResult => {
    const preparationFailed = (scope === 'all' || scope === 'preparation') && config.scenes.preparation.fontFamily !== DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preparation.fontFamily
    const prologueFailed = (scope === 'all' || scope === 'prologue') && config.scenes.prologue.fontFamily !== DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fontFamily
    return preparationFailed || prologueFailed ? { ok: false, reason: 'font', config } : { ok: true, config }
  })
}

function normalizeConfigFont(value: unknown, scene: 'preparation' | 'prologue') {
  return scene === 'preparation'
    ? normalizeConfig({ schemaVersion: 1, scenes: { preparation: { fontFamily: value } } }).scenes.preparation.fontFamily
    : normalizeConfig({ schemaVersion: 1, scenes: { prologue: { fontFamily: value } } }).scenes.prologue.fontFamily
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
