import { expect, it, vi } from 'vitest'
import { DEFAULT_SCENE_COMPOSER_CONFIG, getConfig, normalizeConfig, SCENE_CONFIG_PRESETS } from './config'

it('normalizes the shared opening background crop in partial schema v14 configs', () => {
  const partial = normalizeConfig({ schemaVersion: 14, scenes: { openingBackground: { zoom: 2.18, offsetX: -4, offsetY: 0.35 } } })
  expect(partial.schemaVersion).toBe(24)
  expect(partial.scenes.openingBackground).toEqual({ zoom: 2.18, offsetX: -1, offsetY: 0.35 })

  const missing = normalizeConfig({ schemaVersion: 14, scenes: { prologue: { fontSize: 72 } } })
  expect(missing.scenes.openingBackground).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 })
})
import * as configApi from './config'

it('combines scene 02 growth, gallery, and Lily controls in schema v24', () => {
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.schemaVersion).toBe(24)
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth).toMatchObject({
    vfxCoreIntensity: 0.65, vfxPulseEnabled: true, vfxPulseBrightness: 1.45,
    vfxPulseWidth: 0.2, vfxPulseSpeed: 1, vfxPulseTrailFade: 1.4,
    vfxPulseColor: '#F4DFB8', vfxPulseLeafBoost: 0.6, vfxPulseBudBoost: 0.55,
    vfxParticleCount: 440, vfxParticleSize: 3.4, vfxParticleSizeVariation: 0.65,
    vfxParticleSpeed: 0.95, vfxParticleBrightness: 1.15, vfxParticleGlow: 1.35,
    vfxParticleLifetime: 2.3, vfxParticleSpread: 0.65, vfxParticleTint: '#FFF4E8',
    seedFallDuration: 8, seedFallHeight: 3.2, islandRadius: 0.82, moonLightIntensity: 1.2,
  })

  const imported = normalizeConfig({ schemaVersion: 19, scenes: {
    openingBackground: { zoom: 2.1, offsetX: 0.3, offsetY: -0.2 },
    growth: { seedFallDuration: 11, seedFallHeight: 4.2, islandRadius: 0.95,
      vfxParticleCount: 500, vfxPulseEnabled: false, vfxPulseColor: '#d8c994' },
  } })
  expect(imported.schemaVersion).toBe(24)
  expect(imported.scenes.openingBackground).toEqual({ zoom: 2.1, offsetX: 0.3, offsetY: -0.2 })
  expect(imported.scenes.growth).toMatchObject({ seedFallDuration: 11, seedFallHeight: 4.2, islandRadius: 0.95,
    vfxParticleCount: 500, vfxPulseEnabled: false, vfxPulseColor: '#D8C994' })

  const oldParticleSettings = normalizeConfig({ schemaVersion: 12, scenes: { growth: {
    vfxParticleCount: 88, vfxParticleSize: 2, vfxParticleSpeed: 0.75, vfxParticleBrightness: 0.7,
  } } })
  expect(oldParticleSettings.scenes.growth).toMatchObject({
    vfxParticleCount: 88, vfxParticleSize: 2, vfxParticleSpeed: 0.75, vfxParticleBrightness: 0.7,
  })
})

it('persists Lily growth VFX controls and restores them without schema downgrade', async () => {
  const saved = new Map<string, string>()
  vi.stubGlobal('window', { localStorage: {
    setItem: (key: string, value: string) => saved.set(key, value),
    getItem: (key: string) => saved.get(key) ?? null,
  } })
  await configApi.resetConfig('all')
  await configApi.updateConfig({ scenes: { growth: {
    vfxPulseEnabled: false, vfxPulseSpeed: 1.4, vfxPulseColor: '#D8C994', vfxParticleCount: 224,
    lilyBudGlow: { enabled: false, intensity: 0.9, color: '#D8C994' },
    lilyLeafMaterial: { edgeLightIntensity: 0.45 },
    growthVortex: { enabled: false, particleCount: 640 },
  }, bloom: { lilyBloomPollen: { particleCount: 96, innerCupGlow: 0.8 } } } })
  expect(JSON.parse(saved.get('a-little-universe:dev:lily-growth-particles:v3') ?? '{}')).toMatchObject({
    vfxPulseEnabled: false, vfxPulseSpeed: 1.4, vfxPulseColor: '#D8C994', vfxParticleCount: 224,
    lilyBudGlow: { enabled: false, intensity: 0.9, color: '#D8C994' },
    lilyLeafMaterial: { edgeLightIntensity: 0.45 },
    growthVortex: { enabled: false, particleCount: 640 },
    lilyBloomPollen: { particleCount: 96, innerCupGlow: 0.8 },
  })

  vi.resetModules()
  const reloaded = await import('./config')
  expect(reloaded.getConfig().schemaVersion).toBe(24)
  expect(reloaded.getConfig().scenes.growth).toMatchObject({
    vfxPulseEnabled: false, vfxPulseSpeed: 1.4, vfxPulseColor: '#D8C994', vfxParticleCount: 224,
    seedFallDuration: 8, seedFallHeight: 3.2, islandRadius: 0.82,
    lilyBudGlow: { enabled: false, intensity: 0.9, color: '#D8C994' },
    lilyLeafMaterial: { edgeLightIntensity: 0.45 },
    growthVortex: { enabled: false, particleCount: 640 },
  })
  expect(reloaded.getConfig().scenes.bloom.lilyBloomPollen).toMatchObject({ particleCount: 96, innerCupGlow: 0.8 })
  await reloaded.resetConfig('all')
  await configApi.resetConfig('all')
  vi.unstubAllGlobals()
  vi.resetModules()
})

it('preserves old Lily localStorage particle values without replacing current growth settings', async () => {
  const saved = new Map<string, string>([['a-little-universe:dev:lily-growth-particles:v3', JSON.stringify({
    vfxParticleCount: 88, vfxParticleSize: 2, vfxParticleSpeed: 0.75, vfxParticleBrightness: 0.7,
    vfxPulseEnabled: false, vfxPulseColor: '#D8C994',
  })]])
  vi.stubGlobal('window', { localStorage: {
    setItem: (key: string, value: string) => saved.set(key, value),
    getItem: (key: string) => saved.get(key) ?? null,
  } })

  vi.resetModules()
  const restored = await import('./config')
  expect(restored.getConfig().schemaVersion).toBe(24)
  expect(restored.getConfig().scenes.growth).toMatchObject({
    vfxParticleCount: 88, vfxParticleSize: 2, vfxParticleSpeed: 0.75, vfxParticleBrightness: 0.7,
    vfxPulseEnabled: false, vfxPulseColor: '#D8C994',
    seedFallDuration: 8, seedFallHeight: 3.2, islandRadius: 0.82,
    moonLightIntensity: 1.2, moonPositionY: 5.5,
  })
  expect(restored.getConfig().scenes.openingBackground).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 })

  await restored.resetConfig('all')
  await configApi.resetConfig('all')
  vi.unstubAllGlobals()
  vi.resetModules()
})

it('migrates saved schema v12 water controls and fills the independent polish controls', () => {
  const saved = normalizeConfig({ schemaVersion: 12, scenes: { gallery: {
    reflectionStrength: 0.36, reflectionBlur: 0.48, waterDistortion: 0.01,
    waterRippleSpeed: 0.2, waterNormalStrength: 0.25, moonHighlightStrength: 0.8, waterOpacity: 0.94,
  } } })

  expect(saved.schemaVersion).toBe(24)
  expect(saved.scenes.gallery).toMatchObject({
    reflectionStrength: 0.36, reflectionBlur: 0.48, waterDistortion: 0.01,
    waterRippleSpeed: 0.2, waterNormalStrength: 0.25, moonHighlightStrength: 0.8, waterOpacity: 0.94,
    waterBaseBrightness: 0.72, reflectionFalloff: 1.25, waterDistortionScale: 0.87, moonReflectionSpread: 2,
  })
})

it('migrates schema v13 cloud masters into four independently editable cloud layers and keeps water values', () => {
  const migrated = normalizeConfig({ schemaVersion: 13, scenes: { gallery: {
    cloudDensity: 1.4, cloudOpacity: 0.7, cloudIntensity: 1.3, cloudScale: 1.2,
    cloudLayerCount: 18, cloudDriftSpeed: 0.6, cloudDriftVariation: 0.4,
    cloudForegroundAmount: 1.2, cloudBackgroundAmount: 0.8, cloudNearFloorAmount: 1.1,
    reflectionStrength: 0.31, reflectionBlur: 0.44, reflectionFalloff: 1.76, waterBaseBrightness: 0.42,
    waterDistortion: 0.021, waterDistortionScale: 1.7, waterRippleSpeed: 0.28,
    waterNormalStrength: 0.31, moonHighlightStrength: 1.1, moonReflectionSpread: 1.42, waterOpacity: 0.82,
  } } })

  expect(migrated.schemaVersion).toBe(24)
  expect(migrated.scenes.gallery.cloudLayers).toMatchObject({
    far: { density: 1.4, scale: 1.2, brightness: 1.3, driftSpeed: 0.6 },
    mid: { density: 1.4, scale: 1.2, brightness: 1.3, driftSpeed: 0.6 },
    nearLow: { density: 1.4, scale: 1.2, brightness: 1.3, driftSpeed: 0.6 },
    waterline: { density: 1.4, scale: 1.2, brightness: 1.3, driftSpeed: 0.6 },
  })
  expect(Object.values(migrated.scenes.gallery.cloudLayers).reduce((sum, layer) => sum + layer.count, 0)).toBe(18)
  expect(migrated.scenes.gallery).toMatchObject({
    reflectionStrength: 0.31, reflectionBlur: 0.44, reflectionFalloff: 1.76, waterBaseBrightness: 0.42,
    waterDistortion: 0.021, waterDistortionScale: 1.7, waterRippleSpeed: 0.28,
    waterNormalStrength: 0.31, moonHighlightStrength: 1.1, moonReflectionSpread: 1.42, waterOpacity: 0.82,
  })
})

it('retains the full waterline count range exposed by the Scene 05 controls', () => {
  const fullCapacity = normalizeConfig({ schemaVersion: 14, scenes: { gallery: { cloudLayers: { waterline: { count: 32 } } } } })
  const aboveCapacity = normalizeConfig({ schemaVersion: 14, scenes: { gallery: { cloudLayers: { waterline: { count: 33 } } } } })
  expect(fullCapacity.scenes.gallery.cloudLayers.waterline.count).toBe(32)
  expect(aboveCapacity.scenes.gallery.cloudLayers.waterline.count).toBe(8)
})

it('adds an independently persisted lunar cloud layer and preserves schema v18 imports', () => {
  const imported = normalizeConfig({ schemaVersion: 18, scenes: { gallery: {
    cloudLayers: { far: { count: 12 }, mid: { count: 20 }, nearLow: { count: 24 }, waterline: { count: 32 } },
  } } })
  const disabledLegacyClouds = normalizeConfig({ schemaVersion: 18, scenes: { gallery: { cloudLayerCount: 0 } } })

  expect(imported.schemaVersion).toBe(24)
  expect(imported.scenes.gallery.cloudLayers).toMatchObject({
    far: { count: 12 }, mid: { count: 20 }, nearLow: { count: 24 }, waterline: { count: 32 }, moon: { count: 2 },
  })
  expect(Object.values(imported.scenes.gallery.cloudLayers).reduce((sum, layer) => sum + layer.count, 0)).toBe(90)
  expect(Object.values(disabledLegacyClouds.scenes.gallery.cloudLayers).reduce((sum, layer) => sum + layer.count, 0)).toBe(0)
})

it('migrates schema v19 photo-particle defaults into schema v24', () => {
  const migrated = normalizeConfig({ schemaVersion: 19, scenes: { gallery: { moonBrightness: 1.1 } } })

  expect(DEFAULT_SCENE_COMPOSER_CONFIG.schemaVersion).toBe(24)
  expect(migrated.schemaVersion).toBe(24)
  expect(migrated.scenes.gallery).toMatchObject({
    collageParticleCount: 640,
    collageParticleSize: 2.6,
    collageNoiseStrength: 0.035,
    collageDepth: 0.42,
    collageGlow: 1,
    collageAssembleDuration: 5,
    collageRevealDuration: 2.5,
    collageStaggerDelay: 0.14,
    collagePhotoScale: 0.9,
    collagePhotoGap: 0.3,
  })
})

it('keeps collage settings within their inclusive DEV limits', () => {
  const minimums = normalizeConfig({ schemaVersion: 20, scenes: { gallery: {
    collageParticleCount: 96, collageParticleSize: 1, collageNoiseStrength: 0, collageDepth: 0,
    collageGlow: 0, collageAssembleDuration: 5, collageRevealDuration: 1.5, collageStaggerDelay: 0,
    collagePhotoScale: 0.5, collagePhotoGap: 0.1,
  } } })
  const maximums = normalizeConfig({ schemaVersion: 20, scenes: { gallery: {
    collageParticleCount: 2400, collageParticleSize: 8, collageNoiseStrength: 0.12, collageDepth: 0.8,
    collageGlow: 2, collageAssembleDuration: 10, collageRevealDuration: 6, collageStaggerDelay: 0.5,
    collagePhotoScale: 1, collagePhotoGap: 1.5,
  } } })
  const outOfRange = normalizeConfig({ schemaVersion: 20, scenes: { gallery: {
    collageParticleCount: 2401, collageParticleSize: 8.1, collageNoiseStrength: -0.01, collageDepth: 0.81,
    collageGlow: -0.01, collageAssembleDuration: 10.1, collageRevealDuration: 1.4, collageStaggerDelay: 0.51,
    collagePhotoScale: 1.1, collagePhotoGap: 1.6,
  } } })

  expect(minimums.scenes.gallery).toMatchObject({
    collageParticleCount: 96, collageParticleSize: 1, collageNoiseStrength: 0, collageDepth: 0,
    collageGlow: 0, collageAssembleDuration: 5, collageRevealDuration: 1.5, collageStaggerDelay: 0,
    collagePhotoScale: 0.5, collagePhotoGap: 0.1,
  })
  expect(maximums.scenes.gallery).toMatchObject({
    collageParticleCount: 2400, collageParticleSize: 8, collageNoiseStrength: 0.12, collageDepth: 0.8,
    collageGlow: 2, collageAssembleDuration: 10, collageRevealDuration: 6, collageStaggerDelay: 0.5,
    collagePhotoScale: 1, collagePhotoGap: 1.5,
  })
  expect(outOfRange.scenes.gallery).toMatchObject({
    collageParticleCount: 640, collageParticleSize: 2.6, collageNoiseStrength: 0.035, collageDepth: 0.42,
    collageGlow: 1, collageAssembleDuration: 5, collageRevealDuration: 2.5, collageStaggerDelay: 0.14,
    collagePhotoScale: 0.9, collagePhotoGap: 0.3,
  })
})

it('migrates and bounds the adjustable gallery aisle width in schema v15', () => {
  const oldSettings = normalizeConfig({ schemaVersion: 14, scenes: { gallery: { moonBrightness: 1.1 } } })
  const customized = normalizeConfig({ schemaVersion: 15, scenes: { gallery: {
    galleryWidth: 9.4, columnVisible: false, columnScale: 1.5, columnDepth: 0.4, columnOffsetX: 0.5, columnOffsetY: -0.25,
  } } })
  const bounded = normalizeConfig({ schemaVersion: 15, scenes: { gallery: {
    galleryWidth: 99, columnVisible: 'false', columnScale: 3.1, columnDepth: 2.1, columnOffsetX: -2.1, columnOffsetY: 2.1,
  } } })
  const tooNarrow = normalizeConfig({ schemaVersion: 15, scenes: { gallery: { galleryWidth: 5.9, columnScale: 0.5 } } })

  expect(oldSettings.schemaVersion).toBe(24)
  expect(oldSettings.scenes.gallery).toMatchObject({
    galleryWidth: 7, columnVisible: true, columnScale: 1, columnDepth: 0.15, columnOffsetX: 0, columnOffsetY: 0,
  })
  expect(customized.scenes.gallery).toMatchObject({
    galleryWidth: 9.4, columnVisible: false, columnScale: 1.5, columnDepth: 0.4, columnOffsetX: 0.5, columnOffsetY: -0.25,
  })
  expect(bounded.scenes.gallery.columnScale).toBe(1)
  expect(bounded.scenes.gallery).toMatchObject({
    galleryWidth: 7, columnVisible: true, columnScale: 1, columnDepth: 0.15, columnOffsetX: 0, columnOffsetY: 0,
  })
  expect(tooNarrow.scenes.gallery.columnScale).toBe(1)
  expect(tooNarrow.scenes.gallery.galleryWidth).toBe(7)
})

it('migrates gallery arch settings into schema v24 and bounds editor values', () => {
  const legacy = normalizeConfig({ schemaVersion: 15, scenes: { gallery: { columnScale: 1.4 } } })
  const customized = normalizeConfig({ schemaVersion: 16, scenes: { gallery: {
    archVisible: false, archScale: 21.5, archOpacity: 0.64, archPositionX: 3.5, archPositionY: 2,
    archPositionZ: -91, archRotationY: 0.75,
  } } })
  const bounded = normalizeConfig({ schemaVersion: 16, scenes: { gallery: {
    archVisible: 'false', archScale: 40, archOpacity: -1, archPositionX: 40, archPositionY: 30,
    archPositionZ: -20, archRotationY: 4,
  } } })

  expect(legacy.schemaVersion).toBe(24)
  expect(legacy.scenes.gallery).toMatchObject({
    columnScale: 1.4, archVisible: true, archScale: 19, archOpacity: 0.78,
    archPositionX: 0, archPositionY: 0, archPositionZ: -82, archRotationY: 0,
  })
  expect(customized.scenes.gallery).toMatchObject({
    archVisible: false, archScale: 21.5, archOpacity: 0.64, archPositionX: 3.5,
    archPositionY: 2, archPositionZ: -91, archRotationY: 0.75,
  })
  expect(bounded.scenes.gallery).toMatchObject({
    archVisible: true, archScale: 19, archOpacity: 0.78, archPositionX: 0,
    archPositionY: 0, archPositionZ: -82, archRotationY: 0,
  })
})

it('defaults the gallery to a restrained deep blue moonlit palette', () => {
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery).toMatchObject({
    cloudCoolTint: 1.35, cloudWhiteHighlight: 0.24,
    coldLightIntensity: 0.58, moonLightIntensity: 1.4, moonFillIntensity: 0.22,
    moonCloudLightIntensity: 0.72, moonScatteringIntensity: 0.62,
    waterBaseBrightness: 0.72, reflectionStrength: 0.64, reflectionBlur: 0.62,
    reflectionFalloff: 1.25, waterDistortion: 0.02, waterDistortionScale: 0.87,
    waterRippleSpeed: 1, waterNormalStrength: 0.5, moonHighlightStrength: 1.1,
    moonReflectionSpread: 2, waterOpacity: 1,
  })
})

it('loads moonlit gallery settings from legacy schemas and preserves schema v10 data in v15', () => {
  for (const schemaVersion of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    const imported = normalizeConfig({ schemaVersion, scenes: { gallery: { moonBrightness: 1.1, cloudLayerCount: 7 } } })
    expect(imported.schemaVersion).toBe(24)
    expect(imported.scenes.gallery).toMatchObject({ moonBrightness: 1.1 })
    expect(Object.values(imported.scenes.gallery.cloudLayers).reduce((sum, layer) => sum + layer.count, 0)).toBe(7)
    expect(imported.scenes.identity).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.identity)
    expect(Object.isFrozen(imported.scenes.gallery)).toBe(true)
  }

  const schemaTen = normalizeConfig({ schemaVersion: 10, global: { dprMax: 1.4 }, scenes: {
    gallery: { cloudLayerCount: 12, moonBrightness: 1.35 },
    galaxy: { spin: 4.6, armWidth: 0.16, randomness: 0.065, coreSize: 0.24, thickness: 0.05 },
  } })
  expect(schemaTen.global.dprMax).toBe(1.4)
  expect(schemaTen.scenes.gallery).toMatchObject({ moonBrightness: 1.35 })
  expect(Object.values(schemaTen.scenes.gallery.cloudLayers).reduce((sum, layer) => sum + layer.count, 0)).toBe(12)
  expect(schemaTen.scenes.galaxy).toMatchObject({ spin: 4.6, armWidth: 0.16, randomness: 0.065, coreSize: 0.24, thickness: 0.05 })
})

it('migrates gallery water controls into schema v15, retaining saved reflections and validating bounds', () => {
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.schemaVersion).toBe(24)
  for (const schemaVersion of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    const migrated = normalizeConfig({ schemaVersion, scenes: { gallery: {
      moonBrightness: 1.1, reflectionStrength: 0.24, reflectionBlur: 0.8,
    } } })
    expect(migrated.schemaVersion).toBe(24)
    expect(migrated.scenes.gallery).toMatchObject({
      moonBrightness: 1.1, reflectionStrength: 0.24, reflectionBlur: 0.8,
      waterDistortion: 0.02, waterDistortionScale: 0.87, waterRippleSpeed: 1, waterNormalStrength: 0.5,
      moonHighlightStrength: 1.1, moonReflectionSpread: 2, waterOpacity: 1,
      waterBaseBrightness: 0.72, reflectionFalloff: 1.25,
    })
  }

  const bounds = normalizeConfig({ schemaVersion: 12, scenes: { gallery: {
    reflectionStrength: 0.9, reflectionBlur: 1.5, reflectionFalloff: 0.25, waterBaseBrightness: 0,
    waterDistortion: 0.14, waterDistortionScale: 4.5, waterRippleSpeed: 3, waterNormalStrength: 3,
    moonHighlightStrength: 2, moonReflectionSpread: 4, waterOpacity: 1,
  } } })
  expect(bounds.scenes.gallery).toMatchObject({
    reflectionStrength: 0.9, reflectionBlur: 1.5, reflectionFalloff: 0.25, waterBaseBrightness: 0,
    waterDistortion: 0.14, waterDistortionScale: 4.5, waterRippleSpeed: 3, waterNormalStrength: 3,
    moonHighlightStrength: 2, moonReflectionSpread: 4, waterOpacity: 1,
  })

  const invalid = normalizeConfig({ schemaVersion: 12, scenes: { gallery: {
    reflectionStrength: -0.01, reflectionBlur: 1.51, reflectionFalloff: 2.51, waterBaseBrightness: -0.01,
    waterDistortion: 0.161, waterDistortionScale: 4.51, waterRippleSpeed: 3.01,
    waterNormalStrength: 3.01, moonHighlightStrength: 2.01, moonReflectionSpread: 4.01, waterOpacity: -0.01,
  } } })
  expect(invalid.scenes.gallery).toMatchObject({
    reflectionStrength: 0.64, reflectionBlur: 0.62, reflectionFalloff: 1.25, waterBaseBrightness: 0.72,
    waterDistortion: 0.02, waterDistortionScale: 0.87, waterRippleSpeed: 1, waterNormalStrength: 0.5,
    moonHighlightStrength: 1.1, moonReflectionSpread: 2, waterOpacity: 1,
  })
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
  const count = (schemaVersion: number, cloudLayerCount: number) => Object.values(normalizeConfig({ schemaVersion, scenes: { gallery: { cloudLayerCount } } }).scenes.gallery.cloudLayers).reduce((sum, layer) => sum + layer.count, 0)
  expect(count(9, 12)).toBe(18)
  expect(count(9, 7)).toBe(7)
  expect(count(9, 0)).toBe(0)
  expect(count(10, 12)).toBe(12)
})

it('normalizes schema v6 atmosphere controls and supplies them to schema v5 documents', () => {
  const oldGallery = normalizeConfig({ schemaVersion: 5, scenes: { gallery: { moonBrightness: 1.1, cloudDensity: 1.4 } } })
  expect(oldGallery.schemaVersion).toBe(24)
  expect(oldGallery.scenes.gallery).toMatchObject({
    moonBrightness: 1.1, hazeHeight: 0, moonCloudLightIntensity: 0.72,
  })
  expect(oldGallery.scenes.gallery.cloudLayers.far.density).toBe(1.4)

  const currentGallery = normalizeConfig({ schemaVersion: 6, scenes: { gallery: {
    cloudIntensity: 1.6, cloudLayerCount: 4, hazeHeight: 2.5, moonCloudLightIntensity: 1.2,
  } } })
  expect(currentGallery.scenes.gallery).toMatchObject({ hazeHeight: 2.5, moonCloudLightIntensity: 1.2 })
  expect(Object.values(currentGallery.scenes.gallery.cloudLayers).reduce((sum, layer) => sum + layer.count, 0)).toBe(4)
  expect(currentGallery.scenes.gallery.cloudLayers.waterline.brightness).toBe(1.6)

  const invalid = normalizeConfig({ schemaVersion: 6, scenes: { gallery: {
    cloudIntensity: -0.1, cloudLayerCount: 10.5, hazeHeight: 3.1, moonCloudLightIntensity: Infinity,
  } } })
  expect(invalid.scenes.gallery).toMatchObject({ hazeHeight: 0, moonCloudLightIntensity: 0.72 })
  expect(Object.values(invalid.scenes.gallery.cloudLayers).reduce((sum, layer) => sum + layer.count, 0)).toBe(18)
  expect(invalid.scenes.gallery.cloudLayers.nearLow.brightness).toBe(1)
})

it('migrates bounded moon source, color, halo radius, and godray controls into schema v15', () => {
  const migrated = normalizeConfig({ schemaVersion: 6, scenes: { gallery: { moonPositionX: 2.4, moonLightColor: '#abcde0' } } })
  expect(migrated.schemaVersion).toBe(24)
  expect(migrated.scenes.gallery).toMatchObject({
    moonLightColor: '#ABCDE0', moonPositionX: 2.4, moonPositionY: 24, moonPositionZ: -126,
    moonTargetX: 0, moonTargetY: 5.2, moonTargetZ: -34, moonHaloRadius: 1.7,
    moonGodRaysIntensity: 0.12,
  })

  const bounded = normalizeConfig({ schemaVersion: 7, scenes: { gallery: {
    moonLightColor: 'not-a-color', moonPositionX: 100, moonPositionY: -50, moonPositionZ: -500,
    moonTargetX: 50, moonTargetY: 80, moonTargetZ: 120, moonHaloRadius: 8, moonGodRaysIntensity: 4,
  } } })
  expect(bounded.scenes.gallery).toMatchObject({
    moonLightColor: '#C3D8F2', moonPositionX: 0.2, moonPositionY: 24, moonPositionZ: -126,
    moonTargetX: 0, moonTargetY: 5.2, moonTargetZ: -34, moonHaloRadius: 1.7,
    moonGodRaysIntensity: 0.12,
  })
})

it('persists bounded cloud volume settings while keeping old settings compatible', () => {
  const migrated = normalizeConfig({ schemaVersion: 7, scenes: { gallery: { cloudLayerCount: 6 } } })
  expect(migrated.schemaVersion).toBe(24)
  expect(Object.values(migrated.scenes.gallery.cloudLayers).reduce((sum, layer) => sum + layer.count, 0)).toBe(6)
  expect(migrated.scenes.gallery.cloudLayers.far.driftSpeed).toBe(0.48)

  const bounded = normalizeConfig({ schemaVersion: 9, scenes: { gallery: { cloudScale: 99, cloudLayerCount: 99, cloudDriftSpeed: 99 } } })
  expect(Object.values(bounded.scenes.gallery.cloudLayers).reduce((sum, layer) => sum + layer.count, 0)).toBe(18)
  expect(bounded.scenes.gallery.cloudLayers.far).toMatchObject({ scale: 1, driftSpeed: 0.82 })
})

it('accepts faster per-layer cloud and haze motion while retaining an explicit stop', () => {
  const config = normalizeConfig({ schemaVersion: 16, scenes: { gallery: {
    hazeMotionSpeed: 3,
    cloudLayers: {
      far: { driftSpeed: 3 },
      mid: { driftSpeed: 2.8 },
      nearLow: { driftSpeed: 2.6 },
      waterline: { driftSpeed: 0 },
    },
  } } })
  expect(config.scenes.gallery.hazeMotionSpeed).toBe(3)
  expect(config.scenes.gallery.cloudLayers).toMatchObject({
    far: { driftSpeed: 3 }, mid: { driftSpeed: 2.8 }, nearLow: { driftSpeed: 2.6 }, waterline: { driftSpeed: 0 },
  })
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.gallery.cloudLayers).toMatchObject({
    far: { driftSpeed: 0.48 }, mid: { driftSpeed: 0.68 }, nearLow: { driftSpeed: 0.62 }, waterline: { driftSpeed: 0.52 },
  })
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

it('uses immutable schema v24 defaults and the local Great Vibes prologue face', () => {
  expect(DEFAULT_SCENE_COMPOSER_CONFIG.schemaVersion).toBe(24)
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

it('keeps the floating island controls bounded and supplies defaults for older configs', () => {
  const legacy = normalizeConfig({ schemaVersion: 11, scenes: { growth: { seedScale: 1 } } })
  expect(legacy.scenes.growth).toMatchObject({
    islandRadius: 0.82, islandThickness: 0.24, islandDepth: 0.58, islandRoughness: 0.5,
    grassDensity: 360, grassHeight: 0.14, windStrength: 1, windSpeed: 0.8,
  })
  const bounded = normalizeConfig({ schemaVersion: 11, scenes: { growth: {
    islandRadius: 1.05, grassDensity: 720, windSpeed: 0,
  } } })
  expect(bounded.scenes.growth).toMatchObject({ islandRadius: 1.05, grassDensity: 720, windSpeed: 0 })
  expect(bounded.schemaVersion).toBe(24)
  const latest = normalizeConfig({ schemaVersion: 12, scenes: { growth: {
    islandRadius: 0.7, islandThickness: 0.4, islandDepth: 1.2, islandRoughness: 0.85,
    grassDensity: 500, grassHeight: 0.2, windStrength: 1.8, windSpeed: 2.1,
  } } })
  expect(latest.schemaVersion).toBe(24)
  expect(latest.scenes.growth).toMatchObject({
    islandRadius: 0.7, islandThickness: 0.4, islandDepth: 1.2, islandRoughness: 0.85,
    grassDensity: 500, grassHeight: 0.2, windStrength: 1.8, windSpeed: 2.1,
  })
  const invalid = normalizeConfig({ schemaVersion: 13, scenes: { growth: {
    islandRadius: 4, islandThickness: 0.8, islandDepth: 2, islandRoughness: 1.1,
    grassDensity: 721.7, grassHeight: 0.5, windStrength: -1, windSpeed: -1,
  } } })
  expect(invalid.scenes.growth).toMatchObject({
    islandRadius: 0.82, islandThickness: 0.24, islandDepth: 0.58, islandRoughness: 0.5,
    grassDensity: 360, grassHeight: 0.14, windStrength: 1, windSpeed: 0.8,
  })
})

it('migrates bounded Scene 02 moonlight controls from schema v13', () => {
  const legacy = normalizeConfig({ schemaVersion: 13, scenes: { growth: { islandDepth: 0.58 } } })
  expect(legacy.schemaVersion).toBe(24)
  expect(legacy.scenes.growth).toMatchObject({
    moonLightIntensity: 1.2, moonLightColor: '#AFC9F5', moonBeamRadius: 2,
    moonBeamSoftness: 0.6, moonBeamIntensity: 0.55,
    moonPositionX: -0.65, moonPositionY: 5.5, moonPositionZ: 1,
  })

  const configured = normalizeConfig({ schemaVersion: 14, scenes: { growth: {
    moonLightIntensity: 1.2, moonLightColor: '#aabbcc', moonBeamRadius: 3.2,
    moonBeamSoftness: 0.3, moonBeamIntensity: 0.8,
    moonPositionX: 2, moonPositionY: 7, moonPositionZ: -3,
  } } })
  expect(configured.scenes.growth).toMatchObject({
    moonLightIntensity: 1.2, moonLightColor: '#AABBCC', moonBeamRadius: 3.2,
    moonBeamSoftness: 0.3, moonBeamIntensity: 0.8,
    moonPositionX: 2, moonPositionY: 7, moonPositionZ: -3,
  })

  const invalid = normalizeConfig({ schemaVersion: 14, scenes: { growth: {
    moonLightIntensity: 4, moonLightColor: 'blue', moonBeamRadius: 0.2,
    moonBeamSoftness: 2, moonBeamIntensity: 2,
    moonPositionX: 8, moonPositionY: 0, moonPositionZ: -8,
  } } })
  expect(invalid.scenes.growth).toMatchObject({
    moonLightIntensity: 1.2, moonLightColor: '#AFC9F5', moonBeamRadius: 2,
    moonBeamSoftness: 0.6, moonBeamIntensity: 0.55,
    moonPositionX: -0.65, moonPositionY: 5.5, moonPositionZ: 1,
  })
})

it('migrates Scene 02 staging and cloud defaults from schema v15 without losing legacy moon positions', () => {
  const migrated = normalizeConfig({ schemaVersion: 15, scenes: {
    growth: { moonPositionX: 2.25, moonPositionY: 6.1, moonPositionZ: -1.75 },
    gallery: { cloudDensity: 1.33, cloudOpacity: 0.63 },
  } })

  expect(migrated.schemaVersion).toBe(24)
  expect(migrated.scenes.growth).toMatchObject({
    seedOrbitCount: 3, seedOrbitRadius: 0.4, seedOrbitTilt: 0.62, seedOrbitSpeed: 0.85,
    seedFallDuration: 8, seedFallAcceleration: 3.2, seedFallHeight: 3.2,
    seedCameraLag: 0.3, seedTumbleSpeed: 0.7, islandRevealDuration: 1.5,
    seedTrailIntensity: 1.2, seedTrailSpread: 0.36, seedTrailLifetime: 1,
    seedTrailLiftSpeed: 0.8, seedTrailParticleCount: 60, seedImpactStrength: 0.6, seedImpactRadius: 0.72,
    seedImpactParticles: 64, seedImpactLifetime: 0.85,
    moonScatteringIntensity: 0.35,
    moonPositionX: 2.25, moonPositionY: 6.1, moonPositionZ: -1.75,
    cloudCount: 20, cloudDensity: 0.9, cloudScale: 1, cloudDriftSpeed: 0.28,
    cloudOpacity: 0.48, cloudLightIntensity: 0.7,
    cloudSizeVariation: 0.72, cloudLightVariation: 0.55, cloudPathDensity: 0.65,
    cloudShapeVariation: 0.72, cloudDepthVariation: 0.8,
  })
  expect(migrated.scenes.gallery.cloudLayers.mid).toMatchObject({ density: 1.33, opacity: 0.63 })
})

it('preserves main v15 and Scene 02 v18 profiles in the combined schema', () => {
  const main = normalizeConfig({ schemaVersion: 15, scenes: {
    openingBackground: { zoom: 1.7, offsetX: 0.2 },
    gallery: { waterOpacity: 0.8, cloudLayers: { far: { density: 1.4, count: 4 } } },
    identity: { vortexSpeedMultiplier: 1.2 },
  } })
  expect(main.schemaVersion).toBe(24)
  expect(main.scenes.openingBackground).toMatchObject({ zoom: 1.7, offsetX: 0.2 })
  expect(main.scenes.gallery).toMatchObject({ waterOpacity: 0.8, cloudLayers: { far: { density: 1.4, count: 4 } } })
  expect(main.scenes.identity.vortexSpeedMultiplier).toBe(1.2)
  expect(main.scenes.growth).toMatchObject({ seedFallDuration: 8, seedFallHeight: 3.2 })

  const feature = normalizeConfig({ schemaVersion: 18, scenes: {
    growth: { seedFallDuration: 12, seedFallHeight: 4, cloudDepthVariation: 0.9 },
    gallery: { cloudDensity: 1.2, cloudOpacity: 0.7, cloudLayerCount: 9, cloudScale: 1.5,
      cloudIntensity: 1.3, cloudForegroundAmount: 0.6, cloudBackgroundAmount: 0.5 },
  } })
  expect(feature.schemaVersion).toBe(24)
  expect(feature.scenes.growth).toMatchObject({ seedFallDuration: 12, seedFallHeight: 4, cloudDepthVariation: 0.9 })
  expect(feature.scenes.gallery.cloudLayers.mid).toMatchObject({ density: 1.2, opacity: 0.7, scale: 1.5, brightness: 1.3 })
  expect(feature.scenes.gallery.cloudLayers.nearLow.opacity).toBeCloseTo(0.42)
  expect(feature.scenes.gallery.cloudLayers.far.opacity).toBeCloseTo(0.35)
  expect(Object.values(feature.scenes.gallery.cloudLayers).reduce((sum, layer) => sum + layer.count, 0)).toBe(9)
  expect(feature.scenes.openingBackground).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 })
})

it('normalizes bounded Scene 02 staging, scattering, and cloud controls', () => {
  const configured = normalizeConfig({ schemaVersion: 16, scenes: { growth: {
    seedOrbitCount: 5, seedOrbitRadius: 0.61, seedOrbitTilt: 1.15, seedOrbitSpeed: 1.8,
    seedFallDuration: 4.2, seedFallAcceleration: 3.5, seedFallHeight: 2.7,
    seedCameraLag: 0.75, seedCameraFollowSpeed: 7.5,
    seedSpinSpeed: 3.8, seedTumbleSpeed: 2.8, seedWobbleAmplitude: 0.3, islandRevealDuration: 2.8,
    seedTrailIntensity: 1.8, seedTrailSpread: 0.45, seedTrailLifetime: 1.6,
    seedTrailLiftSpeed: 1.8, seedTrailParticleCount: 121, seedImpactStrength: 0.95, seedImpactRadius: 1.1,
    seedImpactParticles: 179, seedImpactLifetime: 1.5, moonScatteringIntensity: 1.4,
    cloudCount: 6, cloudDensity: 1.9, cloudScale: 1.9, cloudDriftSpeed: 1.9,
    cloudOpacity: 0.95, cloudLightIntensity: 1.8,
    cloudSizeVariation: 0.88, cloudLightVariation: 0.71, cloudPathDensity: 0.92,
    cloudShapeVariation: 0.86, cloudDepthVariation: 0.72,
  } } })
  expect(configured.scenes.growth).toMatchObject({
    seedOrbitCount: 5, seedOrbitRadius: 0.61, seedOrbitTilt: 1.15, seedOrbitSpeed: 1.8,
    seedFallDuration: 4.2, seedFallAcceleration: 3.5, seedFallHeight: 2.7,
    seedCameraLag: 0.75, seedCameraFollowSpeed: 7.5,
    seedSpinSpeed: 3.8, seedTumbleSpeed: 2.8, seedWobbleAmplitude: 0.3, islandRevealDuration: 2.8,
    seedTrailIntensity: 1.8, seedTrailSpread: 0.45, seedTrailLifetime: 1.6,
    seedTrailLiftSpeed: 1.8, seedTrailParticleCount: 121, seedImpactStrength: 0.95, seedImpactRadius: 1.1,
    seedImpactParticles: 179, seedImpactLifetime: 1.5, moonScatteringIntensity: 1.4,
    cloudCount: 6, cloudDensity: 1.9, cloudScale: 1.9, cloudDriftSpeed: 1.9,
    cloudOpacity: 0.95, cloudLightIntensity: 1.8,
    cloudSizeVariation: 0.88, cloudLightVariation: 0.71, cloudPathDensity: 0.92,
    cloudShapeVariation: 0.86, cloudDepthVariation: 0.72,
  })

  const invalid = normalizeConfig({ schemaVersion: 16, scenes: { growth: {
    seedOrbitCount: 1.5, seedOrbitRadius: 0.7, seedOrbitTilt: 0, seedOrbitSpeed: 2.1,
    seedCameraFollowSpeed: 8.1, seedSpinSpeed: 4.1, seedWobbleAmplitude: 0.36,
    seedFallAcceleration: 5.1, seedFallHeight: 1.9, seedTumbleSpeed: 3.1,
    seedFallDuration: 20.1, seedCameraLag: 0.9, islandRevealDuration: 0.3,
    seedTrailIntensity: 2.1, seedTrailSpread: 0.6, seedTrailLifetime: 2.1,
    seedTrailLiftSpeed: 0.05, seedTrailParticleCount: 129, seedImpactStrength: -0.1, seedImpactRadius: 1.3,
    seedImpactParticles: 180.5, seedImpactLifetime: 1.7, moonScatteringIntensity: 1.6,
    cloudCount: -1, cloudDensity: 2.1, cloudScale: 0.3, cloudDriftSpeed: 2.1,
    cloudOpacity: 1.1, cloudLightIntensity: 2.1,
    cloudSizeVariation: 1.1, cloudLightVariation: -0.1, cloudPathDensity: 2,
    cloudShapeVariation: 1.1, cloudDepthVariation: -0.1,
  } } }).scenes.growth
  expect(invalid).toMatchObject({
    seedOrbitCount: 3, seedOrbitRadius: 0.4, seedOrbitTilt: 0.62, seedOrbitSpeed: 0.85,
    seedFallDuration: 8, seedFallAcceleration: 3.2, seedFallHeight: 3.2,
    seedCameraLag: 0.3, seedCameraFollowSpeed: 3,
    seedSpinSpeed: 1, seedTumbleSpeed: 0.7, seedWobbleAmplitude: 0.08, islandRevealDuration: 1.5,
    seedTrailIntensity: 1.2, seedTrailSpread: 0.36, seedTrailLifetime: 1,
    seedTrailLiftSpeed: 0.8, seedTrailParticleCount: 60, seedImpactStrength: 0.6, seedImpactRadius: 0.72,
    seedImpactParticles: 64, seedImpactLifetime: 0.85, moonScatteringIntensity: 0.35,
    cloudCount: 20, cloudDensity: 0.9, cloudScale: 1, cloudDriftSpeed: 0.28,
    cloudOpacity: 0.48, cloudLightIntensity: 0.7,
    cloudSizeVariation: 0.72, cloudLightVariation: 0.55, cloudPathDensity: 0.65,
    cloudShapeVariation: 0.72, cloudDepthVariation: 0.8,
  })
})

it('migrates schema v15 camera controls, preserves saved fall duration, and defaults missing fall duration', () => {
  const saved = normalizeConfig({ schemaVersion: 15, scenes: { growth: {
    seedFallDuration: 2.6, seedCameraLag: 0.42, islandRevealDuration: 2.25,
  } } })
  expect(saved.schemaVersion).toBe(24)
  expect(saved.scenes.growth).toMatchObject({
    seedFallDuration: 2.6, seedCameraLag: 0.42,
    seedCameraFollowSpeed: 3, seedSpinSpeed: 1, seedWobbleAmplitude: 0.08,
    islandRevealDuration: 2.25,
  })

  const missing = normalizeConfig({ schemaVersion: 15, scenes: { growth: { seedCameraLag: 0.3 } } })
  expect(missing.scenes.growth.seedFallDuration).toBe(8)
})

it('upgrades only the previous Scene 02 defaults in saved v16 and v17 profiles', () => {
  const oldDefaults = normalizeConfig({ schemaVersion: 16, scenes: { growth: { seedFallDuration: 3.6, cloudCount: 3 } } })
  expect(oldDefaults.scenes.growth).toMatchObject({ seedFallDuration: 8, seedFallHeight: 3.2, cloudCount: 18 })

  const customized = normalizeConfig({ schemaVersion: 16, scenes: { growth: { seedFallDuration: 2.6, cloudCount: 5 } } })
  expect(customized.scenes.growth).toMatchObject({ seedFallDuration: 2.6, seedFallHeight: 3.2, cloudCount: 5 })

  const v17Defaults = normalizeConfig({ schemaVersion: 17, scenes: { growth: { seedFallDuration: 4.8, seedFallHeight: 1.6 } } })
  expect(v17Defaults.scenes.growth).toMatchObject({ seedFallDuration: 8, seedFallHeight: 3.2 })

  const v17Customized = normalizeConfig({ schemaVersion: 17, scenes: { growth: { seedFallDuration: 7.5, seedFallHeight: 2.6 } } })
  expect(v17Customized.scenes.growth).toMatchObject({ seedFallDuration: 7.5, seedFallHeight: 2.6 })
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

  expect(migrated.schemaVersion).toBe(24)
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

it('ignores the retired preparation screen settings in older configuration files', () => {
  const config = normalizeConfig({ schemaVersion: 1, scenes: { preparation: { typeScale: 1.05 } } })

  expect(config.scenes).not.toHaveProperty('preparation')
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
  expect(normalizeConfig({ schemaVersion: 25, scenes: { prologue: { fontSize: 72 } } })).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG)
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
  expect(migrated.schemaVersion).toBe(24)
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

  expect(legacy.schemaVersion).toBe(24)
  expect(legacy.scenes.galaxy.spin).toBeCloseTo(1.2 * Math.PI * 2, 10)
  expect(current.schemaVersion).toBe(24)
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

it('migrates the current gallery width into independent A/B photo layout profiles', () => {
  const legacy = normalizeConfig({ schemaVersion: 16, scenes: { gallery: { galleryWidth: 9.4 } } })
  expect(legacy.schemaVersion).toBe(24)
  expect(legacy.scenes.gallery).toMatchObject({
    galleryLayoutVariant: 'between-columns',
    galleryLayoutA: { laneWidth: 9.4, offsetX: 0, offsetY: 0, offsetZ: 0 },
    galleryLayoutB: { laneWidth: 9.4, offsetX: 2, offsetY: 0.75, offsetZ: 2.1 },
  })
  const customized = normalizeConfig({ schemaVersion: 17, scenes: { gallery: {
    galleryLayoutVariant: 'between-columns',
    galleryLayoutA: { offsetX: 0.3, offsetY: -0.2, offsetZ: 1.1 },
    galleryLayoutB: { offsetX: -0.4, offsetY: 0.5, offsetZ: -2.1 },
  } } })
  expect(customized.scenes.gallery.galleryLayoutVariant).toBe('between-columns')
  expect(customized.scenes.gallery.galleryLayoutA).toEqual({ laneWidth: 7, offsetX: 0.3, offsetY: -0.2, offsetZ: 1.1 })
  expect(customized.scenes.gallery.galleryLayoutB).toEqual({ laneWidth: 7, offsetX: -0.4, offsetY: 0.5, offsetZ: -2.1 })
  const tightB = normalizeConfig({ schemaVersion: 17, scenes: { gallery: {
    galleryLayoutA: { offsetX: -3 },
    galleryLayoutB: { laneWidth: 6, offsetX: -2.75 },
  } } })
  expect(tightB.scenes.gallery.galleryLayoutA.offsetX).toBe(-3)
  expect(tightB.scenes.gallery.galleryLayoutB).toMatchObject({ laneWidth: 6, offsetX: -2.5 })
  const savedV17Profile = normalizeConfig({ schemaVersion: 17, scenes: { gallery: { galleryLayoutB: { offsetX: -3 } } } })
  expect(savedV17Profile.scenes.gallery.galleryLayoutB.offsetX).toBe(-2.5)
  const invalidBOffset = normalizeConfig({ schemaVersion: 17, scenes: { gallery: { galleryLayoutB: { laneWidth: 6, offsetX: -3.1 } } } })
  expect(invalidBOffset.scenes.gallery.galleryLayoutB).toMatchObject({ laneWidth: 6, offsetX: 2 })
})

it('migrates the B photo facing limit and keeps it within the Dev panel range', () => {
  const legacy = normalizeConfig({ schemaVersion: 17, scenes: { gallery: { galleryLayoutVariant: 'between-columns' } } })
  const customized = normalizeConfig({ schemaVersion: 18, scenes: { gallery: { galleryPhotoFacingMaxDegrees: 32 } } })
  const bounded = normalizeConfig({ schemaVersion: 18, scenes: { gallery: { galleryPhotoFacingMaxDegrees: 90 } } })
  const belowRange = normalizeConfig({ schemaVersion: 18, scenes: { gallery: { galleryPhotoFacingMaxDegrees: -5 } } })

  expect(legacy.schemaVersion).toBe(24)
  expect(legacy.scenes.gallery.galleryPhotoFacingMaxDegrees).toBe(45)
  expect(customized.scenes.gallery.galleryPhotoFacingMaxDegrees).toBe(32)
  expect(bounded.scenes.gallery.galleryPhotoFacingMaxDegrees).toBe(45)
  expect(belowRange.scenes.gallery.galleryPhotoFacingMaxDegrees).toBe(45)
})

it('imports schema v21 gallery settings into v23 without losing Lily defaults or custom values', () => {
  const migrated = normalizeConfig({ schemaVersion: 21, scenes: {
    openingBackground: { zoom: 1.7, offsetX: 0.2, offsetY: -0.3 },
    gallery: { galleryLayoutVariant: 'between-columns', galleryLayoutA: { laneWidth: 8.4 }, waterBaseBrightness: 0.6 },
    growth: { growthVortex: { particleCount: 720 }, lilyBudGlow: { intensity: 0.95 } },
    bloom: { lilyBloomPollen: { particleCount: 84, innerCupGlow: 0.9 } },
  } })

  expect(migrated.schemaVersion).toBe(24)
  expect(migrated.scenes.openingBackground).toEqual({ zoom: 1.7, offsetX: 0.2, offsetY: -0.3 })
  expect(migrated.scenes.gallery).toMatchObject({
    galleryLayoutVariant: 'between-columns', galleryLayoutA: { laneWidth: 8.4 }, waterBaseBrightness: 0.6,
  })
  expect(migrated.scenes.growth.growthVortex.particleCount).toBe(720)
  expect(migrated.scenes.growth.lilyBudGlow.intensity).toBe(0.95)
  expect(migrated.scenes.growth.lilyLeafMaterial).toEqual(DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth.lilyLeafMaterial)
  expect(migrated.scenes.bloom.lilyBloomPollen).toMatchObject({ particleCount: 84, innerCupGlow: 0.9 })
  expect(normalizeConfig({ schemaVersion: 22, scenes: { bloom: { lilyBloomPollen: { particleCount: 48 } } } }).schemaVersion).toBe(24)
})

it('merges colliding schema v20 collage settings with crop, Lily, pollen, and gallery layouts', () => {
  const migrated = normalizeConfig({ schemaVersion: 20, scenes: {
    openingBackground: { zoom: 1.6, offsetX: -0.2, offsetY: 0.15 },
    gallery: {
      galleryLayoutVariant: 'between-columns',
      galleryLayoutA: { laneWidth: 8.2, offsetX: -0.4 },
      galleryLayoutB: { laneWidth: 8.4, offsetX: 2.1 },
      collageParticleCount: 1200,
      collageParticleSize: 4.2,
      collageNoiseStrength: 0.08,
      collageDepth: 0.6,
      collageGlow: 1.4,
      collageAssembleDuration: 5,
      collageRevealDuration: 2.5,
      collageStaggerDelay: 0.3,
    },
    growth: { growthVortex: { particleCount: 720 }, lilyBudGlow: { intensity: 0.95 } },
    bloom: { lilyBloomPollen: { particleCount: 84, innerCupGlow: 0.9 } },
  } })

  expect(migrated.schemaVersion).toBe(24)
  expect(migrated.scenes.openingBackground).toEqual({ zoom: 1.6, offsetX: -0.2, offsetY: 0.15 })
  expect(migrated.scenes.gallery).toMatchObject({
    galleryLayoutVariant: 'between-columns',
    galleryLayoutA: { laneWidth: 8.2, offsetX: -0.4 },
    galleryLayoutB: { laneWidth: 8.4, offsetX: 2.1 },
    collageParticleCount: 1200,
    collageParticleSize: 4.2,
    collageNoiseStrength: 0.08,
    collageDepth: 0.6,
    collageGlow: 1.4,
    collageAssembleDuration: 5,
    collageRevealDuration: 2.5,
    collageStaggerDelay: 0.3,
  })
  expect(migrated.scenes.growth).toMatchObject({ growthVortex: { particleCount: 720 }, lilyBudGlow: { intensity: 0.95 } })
  expect(migrated.scenes.bloom.lilyBloomPollen).toMatchObject({ particleCount: 84, innerCupGlow: 0.9 })
})

it('imports review schema v23 collage profiles with a five-second assembly and preserves unrelated gallery tuning', () => {
  const migrated = normalizeConfig({ schemaVersion: 23, scenes: { gallery: {
    collageAssembleDuration: 0.72,
    collageRevealDuration: 0.68,
    collageParticleCount: 960,
    columnScale: 1.4,
    cloudCoolTint: 1.1,
  } } })

  expect(migrated.schemaVersion).toBe(24)
  expect(migrated.scenes.gallery).toMatchObject({
    collageAssembleDuration: 5,
    collageRevealDuration: 2.5,
    collageParticleCount: 960,
    collagePhotoScale: 0.9,
    collagePhotoGap: 0.3,
    columnScale: 1.4,
    cloudCoolTint: 1.1,
  })
})

it('accepts every supported schema from v1 through v23 and bounds Lily settings', () => {
  for (let schemaVersion = 1; schemaVersion <= 23; schemaVersion++) {
    expect(normalizeConfig({ schemaVersion, scenes: { growth: { flowerGrowthDuration: 8.5 } } }).schemaVersion).toBe(24)
  }

  const defaults = DEFAULT_SCENE_COMPOSER_CONFIG
  expect(defaults.scenes.growth.lilyBudGlow).toEqual({
    enabled: true, intensity: 0.48, color: '#E9B9CE', rimStrength: 0.28, bloomBoost: 0.7,
  })
  expect(defaults.scenes.growth.lilyLeafMaterial).toEqual({
    translucencyStrength: 0.32, edgeLightIntensity: 0.2, colorVariation: 0.24,
  })
  expect(defaults.scenes.growth.growthVortex).toEqual({
    enabled: true, particleCount: 360, particleSize: 1.8, sizeVariation: 0.55, brightness: 1,
    orbitRadius: 0.42, rotationSpeed: 1.55, verticalSpread: 0.9, spiralTightness: 1.4,
    dissipationDuration: 2.3, dissipationSpread: 1.35, color: '#EBD4A7',
  })
  expect(defaults.scenes.bloom.lilyBloomPollen).toEqual({
    enabled: true, particleCount: 48, particleSize: 1.6, glowIntensity: 0.75,
    riseSpeed: 0.09, spreadRadius: 0.28, lifetime: 3.8, innerCupGlow: 0.35,
  })
  expect(Object.isFrozen(defaults.scenes.growth.growthVortex)).toBe(true)

  const invalid = normalizeConfig({ schemaVersion: 24, scenes: {
    growth: { growthVortex: { particleCount: 1600.5, particleSize: 8.1, color: 'gold' } },
    bloom: { lilyBloomPollen: { particleCount: 601, lifetime: Number.NaN } },
  } })
  expect(invalid.scenes.growth.growthVortex).toEqual(defaults.scenes.growth.growthVortex)
  expect(invalid.scenes.bloom.lilyBloomPollen).toEqual(defaults.scenes.bloom.lilyBloomPollen)
})






