import { expect, it, vi } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG, getConfig, normalizeConfig, SCENE_CONFIG_PRESETS } from './config'
import * as configApi from './config'

it('defaults the gallery to a restrained deep blue moonlit palette', () => {
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery).toMatchObject({
    cloudCoolTint: 1.35, cloudWhiteHighlight: 0.24,
    coldLightIntensity: 0.58, moonLightIntensity: 1.25, moonFillIntensity: 0.22,
    moonCloudLightIntensity: 0.72, moonScatteringIntensity: 0.62,
  })
})

it('loads moonlit gallery settings from legacy schemas and preserves schema v10 data in v11', () => {
  for (const schemaVersion of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    const imported = normalizeConfig({ schemaVersion, scenes: { gallery: { moonBrightness: 1.1, cloudLayerCount: 7 } } })
    expect(imported.schemaVersion).toBe(11)
    expect(imported.scenes.gallery).toMatchObject({ moonBrightness: 1.1, cloudLayerCount: 7 })
    expect(imported.scenes.identity).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity)
    expect(Object.isFrozen(imported.scenes.gallery)).toBe(true)
  }

  const schemaTen = normalizeConfig({ schemaVersion: 10, global: { dprMax: 1.4 }, scenes: {
    gallery: { cloudLayerCount: 12, moonBrightness: 1.35 },
    galaxy: { spin: 4.6, armWidth: 0.16, randomness: 0.065, coreSize: 0.24, thickness: 0.05 },
  } })
  expect(schemaTen.global.dprMax).toBe(1.4)
  expect(schemaTen.scenes.gallery).toMatchObject({ cloudLayerCount: 12, moonBrightness: 1.35 })
  expect(schemaTen.scenes.galaxy).toMatchObject({ spin: 4.6, armWidth: 0.16, randomness: 0.065, coreSize: 0.24, thickness: 0.05 })
})

it('keeps explicitly saved gallery lighting when applying new palette defaults', () => {
  const saved = normalizeConfig({ schemaVersion: 11, scenes: { gallery: {
    cloudCoolTint: 0.7, cloudWhiteHighlight: 0.9, moonLightIntensity: 2.2, moonFillIntensity: 0.4,
  } } })
  expect(saved.scenes.gallery).toMatchObject({
    cloudCoolTint: 0.7, cloudWhiteHighlight: 0.9, moonLightIntensity: 2.2, moonFillIntensity: 0.4,
  })
})

it('expands only the old schema v9 cloud maximum while preserving intentional lower counts', () => {
  expect(normalizeConfig({ schemaVersion: 9, scenes: { gallery: { cloudLayerCount: 12 } } }).scenes.gallery.cloudLayerCount).toBe(18)
  expect(normalizeConfig({ schemaVersion: 9, scenes: { gallery: { cloudLayerCount: 7 } } }).scenes.gallery.cloudLayerCount).toBe(7)
  expect(normalizeConfig({ schemaVersion: 9, scenes: { gallery: { cloudLayerCount: 0 } } }).scenes.gallery.cloudLayerCount).toBe(0)
  expect(normalizeConfig({ schemaVersion: 10, scenes: { gallery: { cloudLayerCount: 12 } } }).scenes.gallery.cloudLayerCount).toBe(12)
})

it('normalizes schema v6 atmosphere controls and supplies them to schema v5 documents', () => {
  const oldGallery = normalizeConfig({ schemaVersion: 5, scenes: { gallery: { moonBrightness: 1.1, cloudDensity: 1.4 } } })
  expect(oldGallery.schemaVersion).toBe(11)
  expect(oldGallery.scenes.gallery).toMatchObject({
    moonBrightness: 1.1, cloudDensity: 1.4, cloudIntensity: 1, cloudScale: 1,
    cloudLayerCount: 18, hazeHeight: 0, moonCloudLightIntensity: 0.72,
  })

  const currentGallery = normalizeConfig({ schemaVersion: 6, scenes: { gallery: {
    cloudIntensity: 1.6, cloudLayerCount: 4, hazeHeight: 2.5, moonCloudLightIntensity: 1.2,
  } } })
  expect(currentGallery.scenes.gallery).toMatchObject({
    cloudIntensity: 1.6, cloudLayerCount: 4, hazeHeight: 2.5, moonCloudLightIntensity: 1.2,
  })

  const invalid = normalizeConfig({ schemaVersion: 6, scenes: { gallery: {
    cloudIntensity: -0.1, cloudLayerCount: 10.5, hazeHeight: 3.1, moonCloudLightIntensity: Infinity,
  } } })
  expect(invalid.scenes.gallery).toMatchObject({
    cloudIntensity: 1, cloudScale: 1, cloudLayerCount: 18, hazeHeight: 0, moonCloudLightIntensity: 0.72,
  })
})

it('migrates bounded moon source, color, halo radius, and godray controls into schema v11', () => {
  const migrated = normalizeConfig({ schemaVersion: 6, scenes: { gallery: { moonPositionX: 2.4, moonLightColor: '#abcde0' } } })
  expect(migrated.schemaVersion).toBe(11)
  expect(migrated.scenes.gallery).toMatchObject({
    moonLightColor: '#ABCDE0', moonPositionX: 2.4, moonPositionY: 16, moonPositionZ: -126,
    moonTargetX: 0, moonTargetY: -2.35, moonTargetZ: -34, moonHaloRadius: 1,
    moonGodRaysIntensity: 0.12,
  })

  const bounded = normalizeConfig({ schemaVersion: 7, scenes: { gallery: {
    moonLightColor: 'not-a-color', moonPositionX: 100, moonPositionY: -50, moonPositionZ: -500,
    moonTargetX: 50, moonTargetY: 80, moonTargetZ: 120, moonHaloRadius: 8, moonGodRaysIntensity: 4,
  } } })
  expect(bounded.scenes.gallery).toMatchObject({
    moonLightColor: '#C3D8F2', moonPositionX: 0.2, moonPositionY: 16, moonPositionZ: -126,
    moonTargetX: 0, moonTargetY: -2.35, moonTargetZ: -34, moonHaloRadius: 1,
    moonGodRaysIntensity: 0.12,
  })
})

it('persists bounded cloud volume settings while keeping old settings compatible', () => {
  const migrated = normalizeConfig({ schemaVersion: 7, scenes: { gallery: { cloudLayerCount: 6 } } })
  expect(migrated.schemaVersion).toBe(11)
  expect(migrated.scenes.gallery).toMatchObject({ cloudScale: 1, cloudLayerCount: 6, cloudDriftSpeed: 0.82 })

  const bounded = normalizeConfig({ schemaVersion: 9, scenes: { gallery: { cloudScale: 99, cloudLayerCount: 99, cloudDriftSpeed: 99 } } })
  expect(bounded.scenes.gallery).toMatchObject({ cloudScale: 1, cloudLayerCount: 18, cloudDriftSpeed: 0.82 })
})

it('migrates old configs to bounded scene 04 dissolve settings', () => {
  expect(normalizeConfig({ schemaVersion: 4 }).scenes.identity).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity)
  expect(normalizeConfig({ schemaVersion: 5, scenes: { identity: { dissolveDuration: 6, particleCount: 4000, particleSize: 3, edgeWidth: 0.06 } } }).scenes.identity)
    .toMatchObject({ dissolveDuration: 6, particleCount: 4000, particleSize: 3, edgeWidth: 0.06 })
  expect(normalizeConfig({ schemaVersion: 5, scenes: { identity: { dissolveDuration: 4, particleCount: 12000 } } }).scenes.identity)
    .toMatchObject({ dissolveDuration: 4, particleCount: 12000 })
  expect(normalizeConfig({ schemaVersion: 5, scenes: { identity: { dissolveDuration: 100, particleCount: 100001, particleSize: 0, edgeWidth: 1 } } }).scenes.identity)
    .toEqual(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity)
})

it('provides bounded scene 04 vortex controls with center dissolve at half petal progress', () => {
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity).toMatchObject({
    particleCount: 80000, particleBrightness: 1.25, vortexRadius: 0.8, vortexExpansion: 0.45,
    swirlSpeed: 1, swirlAcceleration: 0.1, centerDissolveAt: 0.5,
  })
  expect(normalizeConfig({ schemaVersion: 5, scenes: { identity: {
    particleCount: 100000, particleBrightness: 2, vortexRadius: 3, vortexExpansion: 1.5,
    swirlSpeed: 8, swirlAcceleration: 3, centerDissolveAt: 0.9,
  } } }).scenes.identity).toMatchObject({
    particleCount: 100000, particleBrightness: 2, vortexRadius: 3, vortexExpansion: 1.5,
    swirlSpeed: 8, swirlAcceleration: 3, centerDissolveAt: 0.9,
  })
  expect(normalizeConfig({ schemaVersion: 5, scenes: { identity: {
    particleCount: 100001, particleBrightness: 2.1, vortexRadius: 0.4, vortexExpansion: -0.1,
    swirlSpeed: 9, swirlAcceleration: 4, centerDissolveAt: 1,
  } } }).scenes.identity).toMatchObject(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity)
})

it('normalizes bounded scene 04 portrait assembly controls', () => {
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity).toMatchObject({
    portraitStart: 12, portraitDuration: 8.5, portraitFraction: 0.4, portraitDetail: 1.5,
    portraitBrightness: 1.8, portraitSize: 1.8, portraitScale: 1.05, portraitOffsetX: 0, portraitOffsetY: 0,
  })
  expect(normalizeConfig({ schemaVersion: 5, scenes: { identity: {
    portraitStart: 40, portraitDuration: 0.5, portraitFraction: 0.9, portraitDetail: 3,
    portraitBrightness: 0.5, portraitSize: 3, portraitScale: 2, portraitOffsetX: 4, portraitOffsetY: -4,
  } } }).scenes.identity).toMatchObject({
    portraitStart: 12, portraitDuration: 8.5, portraitFraction: 0.4, portraitDetail: 1.5,
    portraitBrightness: 1.8, portraitSize: 1.8, portraitScale: 1.05, portraitOffsetX: 0, portraitOffsetY: 0,
  })
  expect(normalizeConfig({ schemaVersion: 5, scenes: { identity: {
    portraitStart: 0, portraitDuration: 2, portraitFraction: 0, portraitDetail: 0.5,
    portraitBrightness: 1.1, portraitSize: 0.6, portraitScale: 0.55, portraitOffsetX: -1, portraitOffsetY: 1,
  } } }).scenes.identity).toMatchObject({
    portraitStart: 0, portraitDuration: 2, portraitFraction: 0, portraitDetail: 0.5,
    portraitBrightness: 1.1, portraitSize: 0.6, portraitScale: 0.55, portraitOffsetX: -1, portraitOffsetY: 1,
  })
})

it('defaults scene 04 portrait capture to the approved fraction-of-dissolve controls', () => {
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity).toMatchObject({
    particleCount: 80000,
    portraitStartProgress: 0.3,
    portraitFraction: 0.4,
    portraitMinTurns: 0,
    portraitMaxTurns: 2,
    portraitSteering: 1,
    portraitBraking: 1,
    portraitSettledBrightness: 1.15,
    vortexSpeedMultiplier: 0.9,
  })
  expect(normalizeConfig({ schemaVersion: 4 }).scenes.identity).toMatchObject({
    particleCount: 80000,
    portraitStartProgress: 0.3,
    portraitFraction: 0.4,
    portraitMinTurns: 0,
    portraitMaxTurns: 2,
    portraitSteering: 1,
    portraitBraking: 1,
    portraitSettledBrightness: 1.15,
    vortexSpeedMultiplier: 0.9,
  })
})

it('normalizes capture limits and repairs turn ordering without losing legacy settings', () => {
  const legacy = normalizeConfig({ schemaVersion: 1, scenes: { identity: { portraitStart: 9, portraitFraction: 0.3 } } })
  expect(legacy.scenes.identity).toMatchObject({
    portraitStart: 9,
    portraitStartProgress: 0.3,
    portraitFraction: 0.3,
    portraitMinTurns: 0,
    portraitMaxTurns: 2,
  })

  const valid = normalizeConfig({ schemaVersion: 5, scenes: { identity: {
    particleCount: 100000, portraitStartProgress: 0, portraitFraction: 0,
    portraitMinTurns: 3.5, portraitMaxTurns: 1.5, portraitSteering: 1.8,
    portraitBraking: 1.8, portraitSettledBrightness: 1.4, vortexSpeedMultiplier: 0.75,
  } } }).scenes.identity
  expect(valid).toMatchObject({
    particleCount: 100000, portraitStartProgress: 0, portraitFraction: 0,
    portraitMinTurns: 3.5, portraitMaxTurns: 3.5, portraitSteering: 1.8,
    portraitBraking: 1.8, portraitSettledBrightness: 1.4, vortexSpeedMultiplier: 0.75,
  })

  const supportedLimits = normalizeConfig({ schemaVersion: 5, scenes: { identity: {
    portraitMinTurns: 4, portraitMaxTurns: 4, portraitSteering: 2, portraitBraking: 0.25,
  } } }).scenes.identity
  expect(supportedLimits).toMatchObject({ portraitMinTurns: 4, portraitMaxTurns: 4, portraitSteering: 2, portraitBraking: 0.25 })

  const upperBounds = normalizeConfig({ schemaVersion: 5, scenes: { identity: {
    portraitStartProgress: 1, portraitFraction: 0.45,
  } } }).scenes.identity
  expect(upperBounds).toMatchObject({ portraitStartProgress: 1, portraitFraction: 0.45 })

  const otherScenes = normalizeConfig({ schemaVersion: 5, scenes: {
    identity: { portraitStartProgress: 0.5 },
    prologue: { fontSize: 72 },
    galaxy: { starCount: 42000 },
  } })
  expect(otherScenes.scenes.prologue.fontSize).toBe(72)
  expect(otherScenes.scenes.galaxy.starCount).toBe(42000)

  const damaged = normalizeConfig({ schemaVersion: 5, scenes: { identity: {
    particleCount: 100001, portraitStartProgress: -0.1, portraitFraction: 0.5,
    portraitMinTurns: -1, portraitMaxTurns: 9, portraitSteering: 5,
    portraitBraking: Number.NaN, portraitSettledBrightness: 0.5, vortexSpeedMultiplier: 3,
  } } }).scenes.identity
  expect(damaged).toMatchObject({
    particleCount: 80000, portraitStartProgress: 0.3, portraitFraction: 0.4,
    portraitMinTurns: 0, portraitMaxTurns: 2, portraitSteering: 1,
    portraitBraking: 1, portraitSettledBrightness: 1.15, vortexSpeedMultiplier: 0.9,
  })
})

it('uses immutable schema v11 defaults and the local Great Vibes prologue face', () => {
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.schemaVersion).toBe(11)
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fontFamily).toBe('great-vibes')
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue).toMatchObject({
    interphraseInterval: 1.35,
    particleCount: 1800,
    windStrength: 1.15,
    turbulence: 0.3,
    fractureWidth: 0.08,
    fractureDuration: 1.5,
    particleDuration: 2.2,
    particleFadeDuration: 1.2,
    promptHandwritingDuration: 0.65,
    glow: 0.45,
  })
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.flowerGrowthDuration).toBe(9)
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom).toMatchObject({
    flowerBloomDuration: 16, cameraApproachDuration: 10.7, cameraBloomSync: 0.67,
    cameraFinalDistance: 2.3, cameraFinalHeight: 2.55, cameraTargetX: 0.27, cameraTargetY: 1.25,
    textPositionX: 0.1, textPositionY: 0.52, textSize: 36, textColor: '#C7AD77',
    textWritingDuration: 4.2, textParticleCount: 1800,
  })
  expect(getConfig()).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG)
  expect(normalizeConfig({})).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG)
  expect(Object.isFrozen(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue)).toBe(true)
})

it('merges a known partial override into defaults field by field', () => {
  expect(normalizeConfig({ schemaVersion: 1, scenes: { prologue: { fontSize: 64 } } }))
    .toEqual({ ...DEFAULT_SCENE_COMPOSER_CONFIG, scenes: {
      ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes,
      galaxy: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.galaxy, blackHoleEnabled: false },
      prologue: { ...DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue, fontSize: 64 },
    } })
})

it('migrates schema v1 particle settings and preserves compatible fields', () => {
  const migrated = normalizeConfig({ schemaVersion: 1, global: { quality: 'low' }, scenes: {
    prologue: { fontSize: 72, particleCount: 120, particleSpeed: 2, particleSpread: 1.2, particleDuration: 9, particleReturnFraction: 0.9 },
  } })

  expect(migrated.schemaVersion).toBe(11)
  expect(migrated.global.quality).toBe('low')
  expect(migrated.scenes.prologue).toMatchObject({
    fontSize: 72, particleCount: 300, windStrength: 2.3, turbulence: 0.36,
    fractureWidth: 0.08, fractureDuration: 1.5, particleDuration: 9, particleFadeDuration: 1.2,
    promptHandwritingDuration: 0.65,
  })
  expect(Object.isFrozen(migrated.scenes.prologue)).toBe(true)
})

it('maps schema v1 renderer aliases without exposing them in the v2 model', () => {
  const migrated = normalizeConfig({ schemaVersion: 1, scenes: { prologue: {
    particleSpeed: 2, particleSpread: 0.6, particleReturnFraction: 0.8,
  } } })
  const prologue = migrated.scenes.prologue

  expect(prologue.windStrength).toBeCloseTo(2.3, 5)
  expect(prologue.turbulence).toBeCloseTo(0.18, 5)
  expect(prologue).not.toHaveProperty('particleSpeed')
  expect(prologue).not.toHaveProperty('particleSpread')
  expect(prologue).not.toHaveProperty('particleReturnFraction')
})

it('keeps preparation typography and card style defaults when JSON provides a partial override', () => {
  const config = normalizeConfig({ schemaVersion: 1, scenes: { preparation: { typeScale: 1.05 } } })

  expect(config.scenes.preparation).toMatchObject({ typeScale: 1.05, lineHeight: 1.08, cardOpacity: 1 })
  expect(config.scenes.preparation.fontFamily).toBe('marck-script')
})

it('falls back per field, drops unknown keys, and rejects unsupported versions', () => {
  const malformed = normalizeConfig({ schemaVersion: 2, unexpected: 'value', global: { quality: 'ultra', playbackSpeed: 99 },
    scenes: { prologue: { fontFamily: 'remote-font', fontSize: 'large', particleCount: 9000, windStrength: 3.1,
      turbulence: -0.1, fractureWidth: 0.2, fractureDuration: 0.7, particleDuration: 21,
      particleFadeDuration: 0.4,
      promptHandwritingDuration: 0.9, extra: true }, futureScene: { enabled: true } } })
  expect(malformed.global).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG.global)
  expect(malformed.scenes.prologue).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue)
  expect(Object.keys(malformed)).toEqual(['schemaVersion', 'global', 'scenes', 'preset'])
  expect(normalizeConfig({ schemaVersion: 12, scenes: { prologue: { fontSize: 72 } } })).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG)
})

it('accepts schema v2 inclusive bounds and defaults out-of-range or non-finite values', () => {
  const config = normalizeConfig({ schemaVersion: 2, global: { playbackSpeed: 0.25 }, scenes: { prologue: {
    fontSize: 160, particleCount: 300, windStrength: 3, turbulence: 1, fractureWidth: 0.18,
    fractureDuration: 4, particleDuration: 20, particleFadeDuration: 4, promptHandwritingDuration: 0.8,
    particleReturnFraction: 1, pulseFrequency: 6,
  } } })
  expect(config.global.playbackSpeed).toBe(0.25)
  expect(config.scenes.prologue.fontSize).toBe(160)
  expect(config.scenes.prologue).toMatchObject({ particleCount: 300, windStrength: 3, turbulence: 1,
    fractureWidth: 0.18, fractureDuration: 4, particleDuration: 20, particleFadeDuration: 4, promptHandwritingDuration: 0.8,
  })
  expect(config.scenes.prologue).not.toHaveProperty('particleReturnFraction')
  expect(config.scenes.prologue.pulseFrequency).toBe(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.pulseFrequency)
  expect(normalizeConfig({ schemaVersion: 1, scenes: { prologue: { seed: Number.NaN } } }).scenes.prologue.seed)
    .toBe(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.seed)
})

it('fills additive awakening settings in old documents while preserving previous artistic choices', () => {
  for (const schemaVersion of [1, 2]) {
    const old = normalizeConfig({ schemaVersion, scenes: { prologue: { glow: 1.1, fontSize: 64, particleDuration: 4 } } })
    expect(old.scenes.prologue).toMatchObject({
      glow: 1.1, fontSize: 64, particleDuration: 4,
      coreIntensity: 1, innerGlowRadius: 16, outerGlowRadius: 95,
      touchDuration: 0.85, copyVariant: 'legacy', secondFontScale: 0.86,
      atmosphereDensity: 42, particleSizeMin: 0.6, particleSizeMax: 1.8,
    })
  }
  const invalid = normalizeConfig({ schemaVersion: 2, scenes: { prologue: {
    coreIntensity: Infinity, touchDuration: 0.2, atmosphereDensity: -1, copyVariant: 'future',
    particleSizeMin: 2, particleSizeMax: 0.5,
  } } })
  expect(invalid.scenes.prologue).toMatchObject({ coreIntensity: 1, touchDuration: 0.85,
    atmosphereDensity: 42, copyVariant: 'legacy', particleSizeMin: 2, particleSizeMax: 2 })
  expect(normalizeConfig({ schemaVersion: 2, scenes: { prologue: { copyVariant: 'legacy' } } }).scenes.prologue.copyVariant).toBe('legacy')
})

it('normalizes the seed formation controls and a bounded scene-local quality tier', () => {
  const config = normalizeConfig({ schemaVersion: 2, scenes: { growth: {
    particleQuality: 'high', formationDuration: 3.5, cloudRadius: 1.1, noiseStrength: 0.9,
  } } })
  expect(config.scenes.growth).toMatchObject({ particleQuality: 'high', formationDuration: 3.5, cloudRadius: 1.1, noiseStrength: 0.9 })
  expect(Object.isFrozen(config.scenes.growth)).toBe(true)
  expect(normalizeConfig({ schemaVersion: 2, scenes: { growth: {
    particleQuality: 'ultra', formationDuration: 3.6, cloudRadius: -1,
  } } }).scenes.growth).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth)
})

it('normalizes animation durations with backward-compatible defaults and bounds', () => {
  expect(normalizeConfig({ schemaVersion: 2 }).scenes).toMatchObject({
    growth: { flowerGrowthDuration: 9 }, bloom: { flowerBloomDuration: 16 },
  })
  expect(normalizeConfig({ schemaVersion: 2, scenes: {
    growth: { flowerGrowthDuration: 2 }, bloom: { flowerBloomDuration: 30 },
  } }).scenes).toMatchObject({
    growth: { flowerGrowthDuration: 9 }, bloom: { flowerBloomDuration: 16 },
  })
  expect(normalizeConfig({ schemaVersion: 2, scenes: {
    growth: { flowerGrowthDuration: 4 }, bloom: { flowerBloomDuration: 24 },
  } }).scenes).toMatchObject({
    growth: { flowerGrowthDuration: 4 }, bloom: { flowerBloomDuration: 24 },
  })
  expect(normalizeConfig({ schemaVersion: 1, scenes: { bloom: { flowerBloomDuration: 12 } } }).scenes.bloom.flowerBloomDuration).toBe(12)
})

it('normalizes additive bloom camera and calligraphy fields while preserving older overrides', () => {
  const migrated = normalizeConfig({ schemaVersion: 4, scenes: {
    bloom: { flowerBloomDuration: 18, cameraFinalDistance: 2.8, textColor: '#aabbcc', unexpected: true },
  } })
  expect(migrated.scenes.bloom).toMatchObject({
    flowerBloomDuration: 18, cameraApproachDuration: 10.7, cameraBloomSync: 0.67,
    cameraFinalDistance: 2.8, textPositionX: 0.1, textSize: 36, textColor: '#AABBCC',
    textWritingDuration: 4.2, textParticleCount: 1800,
  })
  expect(migrated.scenes.bloom).not.toHaveProperty('unexpected')
  const invalid = normalizeConfig({ schemaVersion: 5, scenes: { bloom: {
    cameraApproachDuration: 40, cameraBloomSync: 0.2, cameraFinalDistance: 1, cameraFinalHeight: 99,
    cameraTargetX: 4, cameraTargetY: -2, textPositionX: 0.8, textPositionY: 4, textSize: 10,
    textColor: 'gold', textWritingDuration: 0, textParticleCount: 12,
  } } }).scenes.bloom
  expect(invalid).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.bloom)
  expect(Object.isFrozen(invalid)).toBe(true)
})

it('migrates schema v2 documents with galaxy defaults and bounds the new controls', () => {
  const migrated = normalizeConfig({ schemaVersion: 2, scenes: { growth: { seedScale: 1.2 } } })
  expect(migrated.schemaVersion).toBe(11)
  expect(migrated.scenes.galaxy).toMatchObject({ seed: 'andromeda', starCount: 32000, arms: 5, palette: 'spore', cameraEndAngle: 0.785 })
  const galaxy = normalizeConfig({ schemaVersion: 4, scenes: { galaxy: {
    starCount: 90000, arms: 8, quality: 'high', palette: 'custom', coreColor: '#A1B2C3', fogLayers: 8,
    cameraEase: 'power3', nebulaEnabled: false, rotationSpeed: 0.04,
  } } }).scenes.galaxy
  expect(galaxy).toMatchObject({ starCount: 90000, arms: 8, quality: 'high', palette: 'custom', coreColor: '#A1B2C3', fogLayers: 8, cameraEase: 'power3', nebulaEnabled: false, rotationSpeed: 0.04 })
  expect(normalizeConfig({ schemaVersion: 4, scenes: { galaxy: { starCount: 90001, arms: 1, coreColor: 'red' } } }).scenes.galaxy)
    .toMatchObject({ starCount: 32000, arms: 5, coreColor: '#FFE6AD', coreSize: 0.24, coreDensity: 0.2, armWidth: 0.16, randomness: 0.065, blackHoleEnabled: false })
  expect(Object.isFrozen(galaxy)).toBe(true)
})

it('migrates schema v3 galaxy spin from turns to radians and converts schema v4 geometry units', () => {
  const legacy = normalizeConfig({ schemaVersion: 3, scenes: { galaxy: { spin: 1.2 } } })
  const current = normalizeConfig({ schemaVersion: 4, scenes: { galaxy: {
    seed: 154684308, spin: 4.6, radius: 8.2, armWidth: 0.64, scatter: 0.33,
    coreSize: 1.55, coreDensity: 0.4, thickness: 0.12,
  } } })

  expect(legacy.schemaVersion).toBe(11)
  expect(legacy.scenes.galaxy.spin).toBeCloseTo(1.2 * Math.PI * 2, 10)
  expect(current.schemaVersion).toBe(11)
  expect(current.scenes.galaxy).toMatchObject({
    seed: '154684308', spin: 4.6, armWidth: 0.16,
    coreSize: 1.55 / 8.2, coreDensity: 0.248, thickness: 0.12 / 8.2,
    blackHoleEnabled: false,
  })
  expect(current.scenes.galaxy.randomness).toBeCloseTo(0.065)
  expect(normalizeConfig({ schemaVersion: 5, scenes: { galaxy: { seed: 'andromeda', blackHoleEnabled: true } } }).scenes.galaxy)
    .toMatchObject({ seed: 'andromeda', blackHoleEnabled: true })
})

it('uses the reference galaxy geometry and optional black center by default', () => {
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.galaxy).toMatchObject({
    seed: 'andromeda', starCount: 32000, arms: 5, spin: 4.6, armWidth: 0.16, randomness: 0.065,
    randomnessPower: 3.6, coreSize: 0.24, coreDensity: 0.2, thickness: 0.05,
    brightStarCount: 175, brightStarSize: 1.4, starSize: 1.03, brightness: 1.14,
    twinkle: 0.5, nebulaIntensity: 0.46, blackHoleEnabled: true,
    backgroundStarCount: 5200, backgroundBrightness: 1, backgroundDepth: 42,
    rotationSpeed: 0.045, palette: 'spore', cameraEndAngle: 0.785,
  })
  expect(SCENE_CONFIG_PRESETS['vasilisa-cinematic'].patch.scenes?.galaxy).toMatchObject({
    palette: 'spore', blackHoleEnabled: true, coreSize: 0.24, armWidth: 0.16, randomness: 0.065,
    backgroundBrightness: 1,
  })
})

it('exposes an observable immutable store with scoped reset', async () => {
  expect(configApi).toHaveProperty('subscribeConfig')
  expect(configApi).toHaveProperty('updateConfig')
  expect(configApi).toHaveProperty('resetConfig')
  if (!('subscribeConfig' in configApi) || !('updateConfig' in configApi) || !('resetConfig' in configApi)) return

  await configApi.resetConfig('all')
  const seen: typeof DEFAULT_SCENE_COMPOSER_CONFIG[] = []
  const unsubscribe = configApi.subscribeConfig((next) => seen.push(next))
  await configApi.updateConfig({ scenes: { prologue: { fontSize: 70 } } })
  expect(getConfig().scenes.prologue.fontSize).toBe(70)
  expect(seen).toHaveLength(1)
  const notification = seen[0]
  if (!notification) throw new Error('Config listener was not notified')
  expect(Object.isFrozen(notification.scenes.prologue)).toBe(true)
  await configApi.resetConfig('prologue')
  expect(getConfig().scenes.prologue.fontSize).toBe(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.prologue.fontSize)
  expect(getConfig().global).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG.global)
  unsubscribe()
})

it('resets identity and gallery scopes independently', async () => {
  await configApi.resetConfig('all')
  await configApi.updateConfig({ scenes: { identity: { portraitDuration: 10 }, gallery: { moonBrightness: 1.4 } } })

  await configApi.resetConfig('gallery')
  expect(getConfig().scenes.gallery).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery)
  expect(getConfig().scenes.identity.portraitDuration).toBe(10)

  await configApi.resetConfig('identity')
  expect(getConfig().scenes.identity).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity)
  expect(getConfig().scenes.gallery).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery)
})

it('applies a font change only after the requested local face is ready', async () => {
  let resolveLoad: (faces: FontFace[]) => void = () => undefined
  const load = vi.fn(() => new Promise<FontFace[]>((resolve) => { resolveLoad = resolve }))
  const check = vi.fn(() => true)
  vi.stubGlobal('document', { fonts: { load, check } })
  try {
    await resetForFontTest()
    const before = getConfig()
    const listener = vi.fn()
    const unsubscribe = configApi.subscribeConfig(listener)
    let settled = false
    const update = configApi.updateConfig({ scenes: { prologue: { fontFamily: 'caveat' } } }).then((value) => { settled = true; return value })
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    expect(getConfig()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
    resolveLoad([{} as FontFace])
    await expect(update).resolves.toMatchObject({ scenes: { prologue: { fontFamily: 'caveat' } } })
    expect(settled).toBe(true)
    expect(check).toHaveBeenCalledWith('400 16px "Caveat"', expect.any(String))
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  } finally {
    vi.unstubAllGlobals()
  }
})

async function resetForFontTest() {
  await configApi.resetConfig('all')
}
