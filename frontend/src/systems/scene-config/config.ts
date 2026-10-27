import '../../styles/fonts.css'
import { type ArtFontId, isArtFontId } from './fontIds'

export type QualityProfile = 'standard' | 'low'
export type ScenePresetId = 'moonlit-letter' | 'stardust'
export type ConfigResetScope = 'all' | 'global' | 'preload' | 'preparation' | 'prologue' | 'preset'

type DeepPartial<T> = { [Key in keyof T]?: T[Key] extends object ? DeepPartial<T[Key]> : T[Key] }
export type SceneComposerConfigPatch = DeepPartial<SceneComposerConfig>

export interface SceneComposerConfig {
  readonly schemaVersion: 1
  readonly global: Readonly<{
    quality: QualityProfile
    dprMin: number
    dprMax: number
    playbackSpeed: number
  }>
  readonly scenes: Readonly<{
    preload: Readonly<{ glow: number; particleCount: number; movementSpeed: number; collapseDuration: number }>
    preparation: Readonly<{
      fontFamily: ArtFontId
      spacing: number
      entranceDuration: number
      typeScale: number
      lineHeight: number
      cardOpacity: number
    }>
    prologue: Readonly<{
      fontFamily: ArtFontId
      fontSize: number
      lineHeight: number
      positionY: number
      handwritingDuration: number
      handwritingRhythm: number
      interphraseInterval: number
      readableHold: number
      particleCount: number
      particleSpeed: number
      particleDuration: number
      particleSpread: number
      particleReturnFraction: number
      glow: number
      pulseAmplitude: number
      pulseFrequency: number
      seed: number
    }>
  }>
  readonly preset: ScenePresetId
}

export const DEFAULT_SCENE_COMPOSER_CONFIG: SceneComposerConfig = deepFreeze({
  schemaVersion: 1,
  global: { quality: 'standard', dprMin: 1, dprMax: 1.5, playbackSpeed: 1 },
  scenes: {
    preload: { glow: 1, particleCount: 150, movementSpeed: 1, collapseDuration: 1.25 },
    preparation: { fontFamily: 'marck-script', spacing: 24, entranceDuration: 0.8, typeScale: 1, lineHeight: 1.08, cardOpacity: 1 },
    prologue: {
      fontFamily: 'marck-script', fontSize: 48, lineHeight: 1.3, positionY: 40,
      handwritingDuration: 4.8, handwritingRhythm: 0.82, interphraseInterval: 1.2, readableHold: 2,
      particleCount: 1800, particleSpeed: 1, particleDuration: 4, particleSpread: 1,
      particleReturnFraction: 0.75, glow: 1, pulseAmplitude: 0.08, pulseFrequency: 0.8, seed: 1420577,
    },
  },
  preset: 'moonlit-letter',
})

export const SCENE_CONFIG_PRESETS = deepFreeze({
  'moonlit-letter': {
    label: 'Moonlit Letter',
    patch: { preset: 'moonlit-letter', scenes: { prologue: { glow: 0.9, pulseAmplitude: 0.07, particleSpread: 0.95 } } },
  },
  stardust: {
    label: 'Stardust',
    patch: { preset: 'stardust', scenes: { prologue: { glow: 1.25, particleCount: 2600, particleSpread: 1.25 } } },
  },
})

let activeConfig = DEFAULT_SCENE_COMPOSER_CONFIG
let updateRevision = 0
let startupConfigRequest: Promise<void> | undefined
const configListeners = new Set<(config: SceneComposerConfig) => void>()

export function normalizeConfig(input: unknown): SceneComposerConfig {
  const root = asRecord(input)
  if (!root || (root.schemaVersion !== undefined && root.schemaVersion !== 1)) return DEFAULT_SCENE_COMPOSER_CONFIG
  const globalInput = asRecord(root.global)
  const scenesInput = asRecord(root.scenes)
  const preloadInput = asRecord(scenesInput?.preload)
  const preparationInput = asRecord(scenesInput?.preparation)
  const prologueInput = asRecord(scenesInput?.prologue)

  const global = {
    quality: enumValue(globalInput?.quality, ['standard', 'low'] as const, DEFAULT_SCENE_COMPOSER_CONFIG.global.quality),
    dprMin: numberValue(globalInput?.dprMin, DEFAULT_SCENE_COMPOSER_CONFIG.global.dprMin, 0.5, 1.5),
    dprMax: numberValue(globalInput?.dprMax, DEFAULT_SCENE_COMPOSER_CONFIG.global.dprMax, 1, 2),
    playbackSpeed: numberValue(globalInput?.playbackSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.global.playbackSpeed, 0.25, 4),
  }
  if (global.dprMin > global.dprMax) {
    global.dprMin = DEFAULT_SCENE_COMPOSER_CONFIG.global.dprMin
    global.dprMax = DEFAULT_SCENE_COMPOSER_CONFIG.global.dprMax
  }

  const scenes = {
    preload: {
      glow: numberValue(preloadInput?.glow, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preload.glow, 0, 2),
      particleCount: numberValue(preloadInput?.particleCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preload.particleCount, 40, 300, true),
      movementSpeed: numberValue(preloadInput?.movementSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preload.movementSpeed, 0.1, 4),
      collapseDuration: numberValue(preloadInput?.collapseDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preload.collapseDuration, 0, 4),
    },
    preparation: {
      fontFamily: fontValue(preparationInput?.fontFamily, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preparation.fontFamily),
      spacing: numberValue(preparationInput?.spacing, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preparation.spacing, 0, 64),
      entranceDuration: numberValue(preparationInput?.entranceDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preparation.entranceDuration, 0, 5),
      typeScale: numberValue(preparationInput?.typeScale, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preparation.typeScale, 0.9, 1.1),
      lineHeight: numberValue(preparationInput?.lineHeight, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preparation.lineHeight, 0.9, 1.5),
      cardOpacity: numberValue(preparationInput?.cardOpacity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preparation.cardOpacity, 0.85, 1),
    },
    prologue: {
      fontFamily: fontValue(prologueInput?.fontFamily, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fontFamily),
      fontSize: numberValue(prologueInput?.fontSize, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fontSize, 16, 160),
      lineHeight: numberValue(prologueInput?.lineHeight, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.lineHeight, 0.8, 2.5),
      positionY: numberValue(prologueInput?.positionY, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.positionY, 10, 80),
      handwritingDuration: numberValue(prologueInput?.handwritingDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.handwritingDuration, 0.5, 20),
      handwritingRhythm: numberValue(prologueInput?.handwritingRhythm, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.handwritingRhythm, 0.1, 3),
      interphraseInterval: numberValue(prologueInput?.interphraseInterval, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.interphraseInterval, 0, 8),
      readableHold: numberValue(prologueInput?.readableHold, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.readableHold, 0, 30),
      particleCount: numberValue(prologueInput?.particleCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleCount, 100, 6000, true),
      particleSpeed: numberValue(prologueInput?.particleSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleSpeed, 0.1, 10),
      particleDuration: numberValue(prologueInput?.particleDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleDuration, 0.1, 20),
      particleSpread: numberValue(prologueInput?.particleSpread, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleSpread, 0, 2),
      particleReturnFraction: numberValue(prologueInput?.particleReturnFraction, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleReturnFraction, 0, 1),
      glow: numberValue(prologueInput?.glow, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.glow, 0, 2),
      pulseAmplitude: numberValue(prologueInput?.pulseAmplitude, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.pulseAmplitude, 0, 1),
      pulseFrequency: numberValue(prologueInput?.pulseFrequency, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.pulseFrequency, 0, 5),
      seed: numberValue(prologueInput?.seed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.seed, 0, 2_147_483_647, true),
    },
  }
  const preset = enumValue(root.preset, ['moonlit-letter', 'stardust'] as const, DEFAULT_SCENE_COMPOSER_CONFIG.preset)
  // Construct each level explicitly so unknown keys never enter the active model.
  return deepFreeze({ schemaVersion: 1, global, scenes, preset })
}
export function getConfig(): SceneComposerConfig { return activeConfig }

export function subscribeConfig(listener: (config: SceneComposerConfig) => void): () => void {
  configListeners.add(listener)
  return () => configListeners.delete(listener)
}

export async function updateConfig(patch: SceneComposerConfigPatch): Promise<SceneComposerConfig> {
  const revision = ++updateRevision
  return applyConfig(normalizeConfig(mergePartial(activeConfig, patch)), revision, false)
}

export async function resetConfig(scope: ConfigResetScope): Promise<SceneComposerConfig> {
  if (scope === 'all') return updateConfig(DEFAULT_SCENE_COMPOSER_CONFIG)
  if (scope === 'global') return updateConfig({ global: DEFAULT_SCENE_COMPOSER_CONFIG.global })
  if (scope === 'preset') return updateConfig({ preset: DEFAULT_SCENE_COMPOSER_CONFIG.preset })
  const sceneKey = scope
  return updateConfig({ scenes: { [sceneKey]: DEFAULT_SCENE_COMPOSER_CONFIG.scenes[sceneKey] } })
}

/** Load a same-origin optional startup override without touching preload readiness. */
export function loadStartupConfig(): Promise<void> {
  startupConfigRequest ??= readStartupConfig()
  return startupConfigRequest
}

async function readStartupConfig() {
  const revision = updateRevision
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}scene-composer.json`, {
      cache: 'no-cache', signal: AbortSignal.timeout(2000),
    })
    if (!response.ok || revision !== updateRevision) return
    const input: unknown = await response.json()
    if (revision !== updateRevision) return
    await applyConfig(normalizeConfig(input), revision, true)
  } catch {
    // This file is intentionally optional; defaults remain active on HTTP, JSON, or network errors.
  }
}

async function applyConfig(candidate: SceneComposerConfig, revision: number, fallbackFailedFonts: boolean): Promise<SceneComposerConfig> {
  const current = activeConfig
  const changedFaces = changedFontFaces(current, candidate)
  let loadArtFont: ((id: ArtFontId) => Promise<boolean>) | undefined
  if (changedFaces.length || fallbackFailedFonts) {
    try { loadArtFont = (await import('./fontCatalog')).loadArtFont }
    catch { return activeConfig }
  }
  const readiness = new Map<ArtFontId, boolean>()
  for (const id of changedFaces) readiness.set(id, (await loadArtFont!(id)))
  if (revision !== updateRevision) return activeConfig

  if (Array.from(readiness.values()).some((ready) => !ready)) {
    if (!fallbackFailedFonts) return activeConfig
    const fallback = normalizeConfig({
      ...candidate,
      scenes: {
        ...candidate.scenes,
        preparation: { ...candidate.scenes.preparation, fontFamily: DEFAULT_SCENE_COMPOSER_CONFIG.scenes.preparation.fontFamily },
        prologue: { ...candidate.scenes.prologue, fontFamily: DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fontFamily },
      },
    })
    const fallbackFaces = changedFontFaces(current, fallback)
    for (const id of fallbackFaces) {
      const ready = readiness.get(id) ?? (await loadArtFont!(id))
      if (!ready) return activeConfig
    }
    if (revision !== updateRevision) return activeConfig
    activeConfig = fallback
  } else activeConfig = candidate

  for (const listener of configListeners) listener(activeConfig)
  return activeConfig
}

function changedFontFaces(current: SceneComposerConfig, next: SceneComposerConfig): ArtFontId[] {
  const candidate = [next.scenes.preparation.fontFamily, next.scenes.prologue.fontFamily]
  const active = new Set([current.scenes.preparation.fontFamily, current.scenes.prologue.fontFamily])
  return [...new Set(candidate.filter((id) => !active.has(id)))]
}

function mergePartial(base: unknown, patch: unknown): unknown {
  const baseRecord = asRecord(base)
  const patchRecord = asRecord(patch)
  if (!baseRecord || !patchRecord) return patch === undefined ? base : patch
  const result: Record<string, unknown> = { ...baseRecord }
  for (const [key, value] of Object.entries(patchRecord)) {
    if (value !== undefined) result[key] = mergePartial(result[key], value)
  }
  return result
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function numberValue(value: unknown, fallback: number, min: number, max: number, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) return fallback
  return value
}

function enumValue<const Values extends readonly string[]>(value: unknown, allowed: Values, fallback: Values[number]): Values[number] {
  return typeof value === 'string' && allowed.includes(value) ? value as Values[number] : fallback
}

function fontValue(value: unknown, fallback: ArtFontId): ArtFontId {
  return isArtFontId(value) ? value : fallback
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}
