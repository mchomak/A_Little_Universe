import '../../styles/fonts.css'
import { type ArtFontId, isArtFontId } from './fontIds'

export type QualityProfile = 'standard' | 'low'
export type ScenePresetId = 'moonlit-letter' | 'stardust' | 'vasilisa-cinematic'
export type GalaxyPalette = 'vasilisa' | 'spore' | 'ember' | 'emerald' | 'ice' | 'rose' | 'custom'
export type SeedQuality = 'low' | 'standard' | 'high'
export type ConfigResetScope = 'all' | 'global' | 'preload' | 'preparation' | 'prologue' | 'growth' | 'galaxy' | 'preset'

type DeepPartial<T> = { [Key in keyof T]?: T[Key] extends object ? DeepPartial<T[Key]> : T[Key] }
export type SceneComposerConfigPatch = DeepPartial<SceneComposerConfig>

export interface SceneComposerConfig {
  readonly schemaVersion: 4
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
      windStrength: number
      turbulence: number
      fractureWidth: number
      fractureDuration: number
      promptHandwritingDuration: number
      particleFadeDuration: number
      particleDuration: number
      glow: number
      pulseAmplitude: number
      pulseFrequency: number
      coreIntensity: number
      innerGlowRadius: number
      outerGlowRadius: number
      phraseResponse: number
      touchIntensity: number
      touchDuration: number
      waveStrength: number
      waveRadius: number
      atmosphereDensity: number
      hazeIntensity: number
      spaceDepth: number
      driftSpeed: number
      secondFontScale: number
      textGap: number
      textGlow: number
      copyVariant: 'awakening' | 'legacy'
      particleSizeMin: number
      particleSizeMax: number
      particleGlow: number
      seed: number
    }>
    growth: Readonly<{
      particleQuality: SeedQuality
      particleSize: number
      particleOpacity: number
      cloudRadius: number
      noiseStrength: number
      attractionStrength: number
      attractionRampDuration: number
      morphDamping: number
      formationDuration: number
      freeParticleFraction: number
      pearlColor: string
      roseColor: string
      lavenderColor: string
      coreGlow: number
      seedScale: number
    }>
    galaxy: Readonly<{
      quality: SeedQuality
      seed: number
      starCount: number
      arms: number
      radius: number
      spin: number
      armWidth: number
      scatter: number
      coreSize: number
      coreDensity: number
      thickness: number
      distribution: 'balanced' | 'core' | 'arms'
      starSize: number
      brightness: number
      twinkle: number
      twinkleSpeed: number
      brightStarCount: number
      brightStarSize: number
      brightStarIntensity: number
      backgroundStarCount: number
      backgroundBrightness: number
      backgroundSize: number
      backgroundDepth: number
      backgroundGasDensity: number
      backgroundGasBrightness: number
      nebulaEnabled: boolean
      nebulaDensity: number
      nebulaBrightness: number
      nebulaSaturation: number
      nebulaOpacity: number
      nebulaScale: number
      nebulaIntensity: number
      nebulaSpeed: number
      fogDensity: number
      fogLayers: number
      fogDepth: number
      fogDissipation: number
      fogStart: number
      fogEnd: number
      fogTurbulence: number
      fogAfterOpacity: number
      palette: GalaxyPalette
      coreColor: string
      innerColor: string
      armColor: string
      nebulaColor: string
      brightColor: string
      backgroundColor: string
      exposure: number
      coreGlow: number
      rotationSpeed: number
      motionSpeed: number
      revealMotion: number
      idleMotion: number
      firstStarsAt: number
      galaxyRevealAt: number
      revealDuration: number
      pauseDuration: number
      backgroundTransition: number
      cameraStartDistance: number
      cameraEndDistance: number
      cameraStartAngle: number
      cameraEndAngle: number
      cameraFocusX: number
      cameraFocusY: number
      cameraDuration: number
      cameraEase: 'sine' | 'power2' | 'power3'
      cameraSlowdown: number
      compositionScale: number
    }>
  }>
  readonly preset: ScenePresetId
}

export const DEFAULT_SCENE_COMPOSER_CONFIG: SceneComposerConfig = deepFreeze({
  schemaVersion: 4,
  global: { quality: 'standard', dprMin: 1, dprMax: 1.5, playbackSpeed: 1 },
  scenes: {
    preload: { glow: 1, particleCount: 150, movementSpeed: 1, collapseDuration: 1.25 },
    preparation: { fontFamily: 'marck-script', spacing: 24, entranceDuration: 0.8, typeScale: 1, lineHeight: 1.08, cardOpacity: 1 },
    prologue: {
      fontFamily: 'marck-script', fontSize: 48, lineHeight: 1.3, positionY: 40,
      handwritingDuration: 3.5, handwritingRhythm: 0.82, interphraseInterval: 1.5, readableHold: 2,
      particleCount: 1800, windStrength: 1.15, turbulence: 0.3, fractureWidth: 0.08,
      fractureDuration: 1.5, particleDuration: 2.2, particleFadeDuration: 1.2, promptHandwritingDuration: 0.65,
      glow: 0.45, pulseAmplitude: 0.035, pulseFrequency: 0.22, seed: 1420577,
      coreIntensity: 1, innerGlowRadius: 16, outerGlowRadius: 95, phraseResponse: 0.12,
      touchIntensity: 0.55, touchDuration: 0.85, waveStrength: 0.14, waveRadius: 70,
      atmosphereDensity: 42, hazeIntensity: 0.035, spaceDepth: 0.35, driftSpeed: 0.035,
      secondFontScale: 0.86, textGap: 34, textGlow: 0.22, copyVariant: 'awakening',
      particleSizeMin: 0.6, particleSizeMax: 1.8, particleGlow: 0.95,
    },
    growth: {
      particleQuality: 'standard', particleSize: 1.4, particleOpacity: 0.7,
      cloudRadius: 0.6, noiseStrength: 0.55, attractionStrength: 11.5,
      attractionRampDuration: 2.8, morphDamping: 7.2, formationDuration: 3.2,
      freeParticleFraction: 0.08, pearlColor: '#FFF4E8', roseColor: '#F4CCDA',
      lavenderColor: '#D7CCF1', coreGlow: 0.55, seedScale: 1,
    },
    galaxy: {
      quality: 'standard', seed: 154684308, starCount: 32000, arms: 5, radius: 8.2,
      spin: 4.6, armWidth: 0.64, scatter: 0.33, coreSize: 1.55, coreDensity: 0.4,
      thickness: 0.12, distribution: 'balanced', starSize: 1.08, brightness: 0.64,
      twinkle: 0.5, twinkleSpeed: 0.72, brightStarCount: 220, brightStarSize: 2.05,
      brightStarIntensity: 1.25, backgroundStarCount: 1700, backgroundBrightness: 0.34,
      backgroundSize: 0.8, backgroundDepth: 42, backgroundGasDensity: 0.035,
      backgroundGasBrightness: 0.1, nebulaEnabled: true, nebulaDensity: 0.5,
      nebulaBrightness: 0.69, nebulaSaturation: 1.15, nebulaOpacity: 0.72, nebulaScale: 1.35,
      nebulaIntensity: 0.88, nebulaSpeed: 0.018, fogDensity: 0.28, fogLayers: 4,
      fogDepth: 14, fogDissipation: 0.84, fogStart: 1.5, fogEnd: 8.5,
      fogTurbulence: 0.18, fogAfterOpacity: 0.008, palette: 'vasilisa',
      coreColor: '#FFE8C1', innerColor: '#879DFF', armColor: '#C261FF',
      nebulaColor: '#A253EC', brightColor: '#F6E7FF', backgroundColor: '#02030A',
      exposure: 1, coreGlow: 0.9, rotationSpeed: 0.03, motionSpeed: 1,
      revealMotion: 1, idleMotion: 0.3, firstStarsAt: 0.25, galaxyRevealAt: 1.2,
      revealDuration: 10.4, pauseDuration: 4.2, backgroundTransition: 7,
      cameraStartDistance: 6.4, cameraEndDistance: 16, cameraStartAngle: 0.18,
      cameraEndAngle: 0.785, cameraFocusX: 0, cameraFocusY: 0, cameraDuration: 10,
      cameraEase: 'sine', cameraSlowdown: 3, compositionScale: 1,
    },
  },
  preset: 'moonlit-letter',
})

export const SCENE_CONFIG_PRESETS = deepFreeze({
  'moonlit-letter': {
    label: 'Moonlit Letter',
    patch: { preset: 'moonlit-letter', scenes: { prologue: { glow: 0.9, pulseAmplitude: 0.07, turbulence: 0.29 } } },
  },
  stardust: {
    label: 'Stardust',
    patch: { preset: 'stardust', scenes: { prologue: { glow: 1.25, particleCount: 2600, turbulence: 0.38 } } },
  },
  'vasilisa-cinematic': {
    label: 'Vasilisa Cinematic',
    patch: { preset: 'vasilisa-cinematic', scenes: { galaxy: { palette: 'vasilisa',
      coreColor: '#FFE8C1', innerColor: '#879DFF', armColor: '#C261FF', nebulaColor: '#A253EC',
      brightColor: '#F6E7FF', backgroundColor: '#02030A', starCount: 32000, arms: 5, spin: 4.6,
      rotationSpeed: 0.03, coreGlow: 0.9, brightness: 0.64, coreSize: 1.55,
      coreDensity: 0.4, armWidth: 0.64, scatter: 0.33, thickness: 0.12,
      twinkle: 0.5, starSize: 1.08, brightStarCount: 220,
      brightStarSize: 2.05, brightStarIntensity: 1.25, nebulaDensity: 0.5,
      nebulaBrightness: 0.69, nebulaSaturation: 1.15, nebulaOpacity: 0.72, nebulaIntensity: 0.88 } } },
  },
})

let activeConfig = DEFAULT_SCENE_COMPOSER_CONFIG
let updateRevision = 0
let startupConfigRequest: Promise<void> | undefined
const configListeners = new Set<(config: SceneComposerConfig) => void>()

export function normalizeConfig(input: unknown): SceneComposerConfig {
  const root = asRecord(input)
  const inputVersion = root?.schemaVersion === undefined ? 1 : root.schemaVersion
  if (!root || (inputVersion !== 1 && inputVersion !== 2 && inputVersion !== 3 && inputVersion !== 4)) return DEFAULT_SCENE_COMPOSER_CONFIG
  const migratingV1 = inputVersion === 1
  const globalInput = asRecord(root.global)
  const scenesInput = asRecord(root.scenes)
  const preloadInput = asRecord(scenesInput?.preload)
  const preparationInput = asRecord(scenesInput?.preparation)
  const prologueInput = asRecord(scenesInput?.prologue)
  const growthInput = asRecord(scenesInput?.growth)
  const galaxyInput = asRecord(scenesInput?.galaxy)
  const galaxySettingsInput = inputVersion === 3 && typeof galaxyInput?.spin === 'number'
    ? { ...galaxyInput, spin: galaxyInput.spin * Math.PI * 2 }
    : galaxyInput
  const legacyParticleSpeed = numberValue(prologueInput?.particleSpeed, 1, 0.1, 10)
  const legacyParticleSpread = numberValue(prologueInput?.particleSpread, 1, 0, 2)
  const windStrength = numberValue(
    prologueInput?.windStrength ?? (migratingV1 ? clamp(legacyParticleSpeed * 1.15, 0.2, 3) : undefined),
    DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.windStrength, 0.2, 3,
  )
  const turbulence = numberValue(
    prologueInput?.turbulence ?? (migratingV1 ? legacyParticleSpread * 0.3 : undefined),
    DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.turbulence, 0, 1,
  )

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
      particleCount: migratingV1
        ? migrateLegacyNumber(prologueInput?.particleCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleCount, 100, 6000, 300, 6000, true)
        : numberValue(prologueInput?.particleCount, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleCount, 300, 6000, true),
      windStrength,
      turbulence,
      fractureWidth: numberValue(prologueInput?.fractureWidth, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fractureWidth, 0, 0.18),
      fractureDuration: numberValue(prologueInput?.fractureDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fractureDuration, 0.8, 4),
      promptHandwritingDuration: numberValue(prologueInput?.promptHandwritingDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.promptHandwritingDuration, 0.2, 0.8),
      particleFadeDuration: numberValue(prologueInput?.particleFadeDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleFadeDuration, 0.5, 4),
      particleDuration: numberValue(prologueInput?.particleDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleDuration, 0.1, 20),
      glow: numberValue(prologueInput?.glow, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.glow, 0, 2),
      pulseAmplitude: numberValue(prologueInput?.pulseAmplitude, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.pulseAmplitude, 0, 1),
      pulseFrequency: numberValue(prologueInput?.pulseFrequency, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.pulseFrequency, 0, 5),
      coreIntensity: numberValue(prologueInput?.coreIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.coreIntensity, 0.2, 2),
      innerGlowRadius: numberValue(prologueInput?.innerGlowRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.innerGlowRadius, 6, 40),
      outerGlowRadius: numberValue(prologueInput?.outerGlowRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.outerGlowRadius, 40, 160),
      phraseResponse: numberValue(prologueInput?.phraseResponse, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.phraseResponse, 0, 0.6),
      touchIntensity: numberValue(prologueInput?.touchIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.touchIntensity, 0, 1.5),
      touchDuration: numberValue(prologueInput?.touchDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.touchDuration, 0.7, 1),
      waveStrength: numberValue(prologueInput?.waveStrength, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.waveStrength, 0, 0.5),
      waveRadius: numberValue(prologueInput?.waveRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.waveRadius, 30, 120),
      atmosphereDensity: numberValue(prologueInput?.atmosphereDensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.atmosphereDensity, 0, 120, true),
      hazeIntensity: numberValue(prologueInput?.hazeIntensity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.hazeIntensity, 0, 0.12),
      spaceDepth: numberValue(prologueInput?.spaceDepth, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.spaceDepth, 0, 1),
      driftSpeed: numberValue(prologueInput?.driftSpeed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.driftSpeed, 0, 0.2),
      secondFontScale: numberValue(prologueInput?.secondFontScale, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.secondFontScale, 0.6, 1.2),
      textGap: numberValue(prologueInput?.textGap, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.textGap, 20, 100),
      textGlow: numberValue(prologueInput?.textGlow, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.textGlow, 0, 1),
      copyVariant: enumValue(prologueInput?.copyVariant, ['awakening', 'legacy'] as const, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.copyVariant),
      particleSizeMin: numberValue(prologueInput?.particleSizeMin, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleSizeMin, 0.25, 2.5),
      particleSizeMax: numberValue(prologueInput?.particleSizeMax, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleSizeMax, 0.5, 4),
      particleGlow: numberValue(prologueInput?.particleGlow, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.particleGlow, 0, 2),
      seed: numberValue(prologueInput?.seed, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.seed, 0, 2_147_483_647, true),
    },
    growth: {
      particleQuality: enumValue(growthInput?.particleQuality, ['low', 'standard', 'high'] as const, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.particleQuality),
      particleSize: numberValue(growthInput?.particleSize, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.particleSize, 0.5, 3),
      particleOpacity: numberValue(growthInput?.particleOpacity, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.particleOpacity, 0, 1.5),
      cloudRadius: numberValue(growthInput?.cloudRadius, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.cloudRadius, 0.3, 1.2),
      noiseStrength: numberValue(growthInput?.noiseStrength, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.noiseStrength, 0, 2),
      attractionStrength: numberValue(growthInput?.attractionStrength, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.attractionStrength, 2, 24),
      attractionRampDuration: numberValue(growthInput?.attractionRampDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.attractionRampDuration, 0.5, 3.5),
      morphDamping: numberValue(growthInput?.morphDamping, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.morphDamping, 2, 14),
      formationDuration: numberValue(growthInput?.formationDuration, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.formationDuration, 2.5, 3.5),
      freeParticleFraction: numberValue(growthInput?.freeParticleFraction, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.freeParticleFraction, 0, 0.2),
      pearlColor: colorValue(growthInput?.pearlColor, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.pearlColor),
      roseColor: colorValue(growthInput?.roseColor, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.roseColor),
      lavenderColor: colorValue(growthInput?.lavenderColor, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.lavenderColor),
      coreGlow: numberValue(growthInput?.coreGlow, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.coreGlow, 0, 1.5),
      seedScale: numberValue(growthInput?.seedScale, DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.seedScale, 0.65, 1.4),
    },
    galaxy: normalizeGalaxy(galaxySettingsInput),
  }
  if (scenes.prologue.particleSizeMin > scenes.prologue.particleSizeMax) {
    scenes.prologue.particleSizeMax = scenes.prologue.particleSizeMin
  }
  const preset = enumValue(root.preset, ['moonlit-letter', 'stardust', 'vasilisa-cinematic'] as const, DEFAULT_SCENE_COMPOSER_CONFIG.preset)
  // Construct each level explicitly so unknown keys never enter the active model.
  return deepFreeze({ schemaVersion: 4, global, scenes, preset })
}
function normalizeGalaxy(input: Record<string, unknown> | undefined): SceneComposerConfig['scenes']['galaxy'] {
  const d = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.galaxy
  return {
    quality: enumValue(input?.quality, ['low', 'standard', 'high'] as const, d.quality),
    seed: numberValue(input?.seed, d.seed, 0, 2_147_483_647, true),
    starCount: numberValue(input?.starCount, d.starCount, 8000, 90000, true),
    arms: numberValue(input?.arms, d.arms, 2, 8, true), radius: numberValue(input?.radius, d.radius, 4, 14),
    spin: numberValue(input?.spin, d.spin, 0.2, 18), armWidth: numberValue(input?.armWidth, d.armWidth, 0.12, 1.1),
    scatter: numberValue(input?.scatter, d.scatter, 0, 1), coreSize: numberValue(input?.coreSize, d.coreSize, 0.4, 3),
    coreDensity: numberValue(input?.coreDensity, d.coreDensity, 0.1, 1), thickness: numberValue(input?.thickness, d.thickness, 0.08, 1.6),
    distribution: enumValue(input?.distribution, ['balanced', 'core', 'arms'] as const, d.distribution),
    starSize: numberValue(input?.starSize, d.starSize, 0.25, 3.5), brightness: numberValue(input?.brightness, d.brightness, 0.1, 1.5),
    twinkle: numberValue(input?.twinkle, d.twinkle, 0, 1), twinkleSpeed: numberValue(input?.twinkleSpeed, d.twinkleSpeed, 0, 3),
    brightStarCount: numberValue(input?.brightStarCount, d.brightStarCount, 0, 200, true),
    brightStarSize: numberValue(input?.brightStarSize, d.brightStarSize, 1, 8), brightStarIntensity: numberValue(input?.brightStarIntensity, d.brightStarIntensity, 0, 3),
    backgroundStarCount: numberValue(input?.backgroundStarCount, d.backgroundStarCount, 0, 6000, true),
    backgroundBrightness: numberValue(input?.backgroundBrightness, d.backgroundBrightness, 0, 1), backgroundSize: numberValue(input?.backgroundSize, d.backgroundSize, 0.2, 2.5),
    backgroundDepth: numberValue(input?.backgroundDepth, d.backgroundDepth, 15, 100),
    backgroundGasDensity: numberValue(input?.backgroundGasDensity, d.backgroundGasDensity, 0, 0.8),
    backgroundGasBrightness: numberValue(input?.backgroundGasBrightness, d.backgroundGasBrightness, 0, 1),
    nebulaEnabled: typeof input?.nebulaEnabled === 'boolean' ? input.nebulaEnabled : d.nebulaEnabled,
    nebulaDensity: numberValue(input?.nebulaDensity, d.nebulaDensity, 0, 1), nebulaBrightness: numberValue(input?.nebulaBrightness, d.nebulaBrightness, 0, 1.5),
    nebulaSaturation: numberValue(input?.nebulaSaturation, d.nebulaSaturation, 0, 1.5), nebulaOpacity: numberValue(input?.nebulaOpacity, d.nebulaOpacity, 0, 1),
    nebulaScale: numberValue(input?.nebulaScale, d.nebulaScale, 0.3, 4), nebulaIntensity: numberValue(input?.nebulaIntensity, d.nebulaIntensity, 0, 2),
    nebulaSpeed: numberValue(input?.nebulaSpeed, d.nebulaSpeed, 0, 0.1), fogDensity: numberValue(input?.fogDensity, d.fogDensity, 0, 1),
    fogLayers: numberValue(input?.fogLayers, d.fogLayers, 1, 8, true), fogDepth: numberValue(input?.fogDepth, d.fogDepth, 4, 30),
    fogDissipation: numberValue(input?.fogDissipation, d.fogDissipation, 0, 1), fogStart: numberValue(input?.fogStart, d.fogStart, 0, 8),
    fogEnd: numberValue(input?.fogEnd, d.fogEnd, 4, 18), fogTurbulence: numberValue(input?.fogTurbulence, d.fogTurbulence, 0, 1),
    fogAfterOpacity: numberValue(input?.fogAfterOpacity, d.fogAfterOpacity, 0, 0.2),
    palette: enumValue(input?.palette, ['vasilisa', 'spore', 'ember', 'emerald', 'ice', 'rose', 'custom'] as const, d.palette),
    coreColor: colorValue(input?.coreColor, d.coreColor), innerColor: colorValue(input?.innerColor, d.innerColor),
    armColor: colorValue(input?.armColor, d.armColor), nebulaColor: colorValue(input?.nebulaColor, d.nebulaColor),
    brightColor: colorValue(input?.brightColor, d.brightColor), backgroundColor: colorValue(input?.backgroundColor, d.backgroundColor),
    exposure: numberValue(input?.exposure, d.exposure, 0.3, 1.8), coreGlow: numberValue(input?.coreGlow, d.coreGlow, 0, 2),
    rotationSpeed: numberValue(input?.rotationSpeed, d.rotationSpeed, 0, 0.04), motionSpeed: numberValue(input?.motionSpeed, d.motionSpeed, 0, 2),
    revealMotion: numberValue(input?.revealMotion, d.revealMotion, 0, 3), idleMotion: numberValue(input?.idleMotion, d.idleMotion, 0, 0.6),
    firstStarsAt: numberValue(input?.firstStarsAt, d.firstStarsAt, 0, 6), galaxyRevealAt: numberValue(input?.galaxyRevealAt, d.galaxyRevealAt, 0, 10),
    revealDuration: numberValue(input?.revealDuration, d.revealDuration, 5, 18), pauseDuration: numberValue(input?.pauseDuration, d.pauseDuration, 0, 12),
    backgroundTransition: numberValue(input?.backgroundTransition, d.backgroundTransition, 2, 18),
    cameraStartDistance: numberValue(input?.cameraStartDistance, d.cameraStartDistance, 3, 12), cameraEndDistance: numberValue(input?.cameraEndDistance, d.cameraEndDistance, 9, 28),
    cameraStartAngle: numberValue(input?.cameraStartAngle, d.cameraStartAngle, -0.3, 0.8), cameraEndAngle: numberValue(input?.cameraEndAngle, d.cameraEndAngle, 0.1, 0.95),
    cameraFocusX: numberValue(input?.cameraFocusX, d.cameraFocusX, -3, 3), cameraFocusY: numberValue(input?.cameraFocusY, d.cameraFocusY, -3, 3),
    cameraDuration: numberValue(input?.cameraDuration, d.cameraDuration, 5, 18),
    cameraEase: enumValue(input?.cameraEase, ['sine', 'power2', 'power3'] as const, d.cameraEase),
    cameraSlowdown: numberValue(input?.cameraSlowdown, d.cameraSlowdown, 0, 8), compositionScale: numberValue(input?.compositionScale, d.compositionScale, 0.65, 1.4),
  }
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

function migrateLegacyNumber(value: unknown, fallback: number, legacyMin: number, legacyMax: number, min: number, max: number, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < legacyMin || value > legacyMax || (integer && !Number.isInteger(value))) return fallback
  return clamp(value, min, max)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function enumValue<const Values extends readonly string[]>(value: unknown, allowed: Values, fallback: Values[number]): Values[number] {
  return typeof value === 'string' && allowed.includes(value) ? value as Values[number] : fallback
}

function fontValue(value: unknown, fallback: ArtFontId): ArtFontId {
  return isArtFontId(value) ? value : fallback
}

function colorValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[\da-f]{6}$/iu.test(value) ? value.toUpperCase() : fallback
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}
