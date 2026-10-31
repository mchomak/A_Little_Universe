import { expect, it, vi } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG, getConfig, normalizeConfig, SCENE_CONFIG_PRESETS } from './config'
import * as configApi from './config'

it('uses immutable schema v5 defaults and the local Great Vibes prologue face', () => {
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.schemaVersion).toBe(5)
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
    cameraFinalDistance: 2.3, cameraFinalHeight: 2.3, cameraTargetX: 0.27, cameraTargetY: 1.25,
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

  expect(migrated.schemaVersion).toBe(5)
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
  expect(normalizeConfig({ schemaVersion: 6, scenes: { prologue: { fontSize: 72 } } })).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG)
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
  expect(migrated.schemaVersion).toBe(5)
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

  expect(legacy.schemaVersion).toBe(5)
  expect(legacy.scenes.galaxy.spin).toBeCloseTo(1.2 * Math.PI * 2, 10)
  expect(current.schemaVersion).toBe(5)
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
