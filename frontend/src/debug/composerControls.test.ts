import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetConfig, getConfig } from '../systems/scene-config/config'
import { applyComposerPreset, exportComposerJson, importComposerJson, resetComposerField, resetComposerScope, setComposerField } from './composerControls'

const fontLoader = vi.hoisted(() => ({ load: vi.fn(async (): Promise<boolean> => true) }))

vi.mock('../systems/scene-config/fontCatalog', () => ({ loadArtFont: fontLoader.load }))

afterEach(async () => {
  fontLoader.load.mockResolvedValue(true)
  await resetConfig('all')
})

describe('Scene Composer controls', () => {
  it('maps a prologue font-size control to the shared config store', async () => {
    await setComposerField('scenes.prologue.fontSize', 72)

    expect(getConfig().scenes.prologue.fontSize).toBe(72)
  })

  it('imports partial JSON over the active config', async () => {
    await setComposerField('global.quality', 'low')

    const result = await importComposerJson('{"schemaVersion":1,"scenes":{"prologue":{"fontSize":72}}}')

    expect(result.ok).toBe(true)
    expect(getConfig().global.quality).toBe('low')
    expect(getConfig().scenes.prologue.fontSize).toBe(72)
  })

  it('imports schema v2 particle controls through the shared config store', async () => {
    const result = await importComposerJson(JSON.stringify({ schemaVersion: 2, scenes: { prologue: {
      particleCount: 2200, windStrength: 2, turbulence: 0.6, fractureWidth: 0.12,
      fractureDuration: 3, particleDuration: 3.5, particleFadeDuration: 3.2, promptHandwritingDuration: 0.4, glow: 0.9,
    } } }))

    expect(result.ok).toBe(true)
    expect(getConfig().scenes.prologue).toMatchObject({
      particleCount: 2200, windStrength: 2, turbulence: 0.6, fractureWidth: 0.12,
      fractureDuration: 3, particleDuration: 3.5, particleFadeDuration: 3.2, promptHandwritingDuration: 0.4, glow: 0.9,
    })
  })

  it('keeps schema v12 scene settings compatible and round-trips island controls introduced in v13', async () => {
    const legacy = await importComposerJson(JSON.stringify({
      schemaVersion: 12,
      scenes: { growth: { islandRadius: 0.9, grassDensity: 440, windSpeed: 0.6 } },
    }))
    expect(legacy.ok).toBe(true)
    expect(getConfig().scenes.growth).toMatchObject({
      islandRadius: 0.9, islandThickness: 0.24, islandDepth: 0.58, islandRoughness: 0.5,
      grassDensity: 440, grassHeight: 0.14, windStrength: 1, windSpeed: 0.6,
    })

    await setComposerField('scenes.growth.islandThickness', 0.38)
    await setComposerField('scenes.growth.islandDepth', 1.1)
    await setComposerField('scenes.growth.islandRoughness', 0.8)
    await setComposerField('scenes.growth.grassHeight', 0.22)
    await setComposerField('scenes.growth.windStrength', 1.7)
    const exported = JSON.parse(exportComposerJson()) as { schemaVersion: number; scenes: { growth: Record<string, unknown> } }
    expect(exported.schemaVersion).toBe(18)
    expect(exported.scenes.growth).toMatchObject({
      islandThickness: 0.38, islandDepth: 1.1, islandRoughness: 0.8, grassHeight: 0.22, windStrength: 1.7,
    })
    expect((await importComposerJson(JSON.stringify(exported))).ok).toBe(true)
  })

  it('migrates Scene 02 moonlight defaults from schema v13 and round-trips schema v15 controls', async () => {
    const legacy = await importComposerJson(JSON.stringify({
      schemaVersion: 13,
      scenes: { growth: { islandDepth: 0.58, windSpeed: 0.8 } },
    }))
    expect(legacy.ok).toBe(true)
    expect(getConfig().scenes.growth).toMatchObject({
      moonLightIntensity: 1.2, moonLightColor: '#AFC9F5', moonBeamRadius: 2,
      moonBeamSoftness: 0.6, moonBeamIntensity: 0.55, moonScatteringIntensity: 0.35,
      moonPositionX: -0.65, moonPositionY: 5.5, moonPositionZ: 1,
    })

    await setComposerField('scenes.growth.moonLightIntensity', 1.1)
    await setComposerField('scenes.growth.moonLightColor', '#D0DCF5')
    await setComposerField('scenes.growth.moonBeamRadius', 3.1)
    await setComposerField('scenes.growth.moonBeamSoftness', 0.4)
    await setComposerField('scenes.growth.moonBeamIntensity', 0.7)
    await setComposerField('scenes.growth.moonPositionX', 1.25)
    await setComposerField('scenes.growth.moonPositionY', 6.5)
    await setComposerField('scenes.growth.moonPositionZ', -2.25)

    const exported = JSON.parse(exportComposerJson()) as { schemaVersion: number; scenes: { growth: Record<string, unknown> } }
    expect(exported.schemaVersion).toBe(18)
    expect(exported.scenes.growth).toMatchObject({
      moonLightIntensity: 1.1, moonLightColor: '#D0DCF5', moonBeamRadius: 3.1,
      moonBeamSoftness: 0.4, moonBeamIntensity: 0.7,
      moonPositionX: 1.25, moonPositionY: 6.5, moonPositionZ: -2.25,
    })
    expect((await importComposerJson(JSON.stringify(exported))).ok).toBe(true)
  })

  it('imports schema v15 growth settings and round-trips schema v18 fall and trail controls', async () => {
    const legacy = await importComposerJson(JSON.stringify({ schemaVersion: 15, scenes: {
      growth: { seedFallDuration: 2.6, seedCameraLag: 0.42, islandRevealDuration: 2.25, moonPositionX: 2.25, moonPositionY: 6.1, moonPositionZ: -1.75 },
      gallery: { cloudDensity: 1.33, cloudOpacity: 0.63 },
    } }))
    expect(legacy.ok).toBe(true)
    expect(getConfig().scenes.growth).toMatchObject({
      seedOrbitCount: 3, seedOrbitRadius: 0.4, seedOrbitTilt: 0.62, seedOrbitSpeed: 0.85,
      seedFallDuration: 2.6, seedCameraLag: 0.42, islandRevealDuration: 2.25,
      seedTrailIntensity: 1.2, seedTrailSpread: 0.36, seedTrailLifetime: 1,
      seedTrailLiftSpeed: 0.8, seedTrailParticleCount: 60, seedImpactStrength: 0.6, seedImpactRadius: 0.72,
      seedImpactParticles: 64, seedImpactLifetime: 0.85, moonScatteringIntensity: 0.35,
      seedCameraFollowSpeed: 3, seedSpinSpeed: 1, seedWobbleAmplitude: 0.08,
      cloudCount: 18, cloudDensity: 0.8, cloudScale: 1, cloudDriftSpeed: 0.3,
      cloudOpacity: 0.42, cloudLightIntensity: 0.7,
      cloudSizeVariation: 0.72, cloudLightVariation: 0.55, cloudPathDensity: 0.65,
      cloudShapeVariation: 0.65, cloudDepthVariation: 0.65,
      moonPositionX: 2.25, moonPositionY: 6.1, moonPositionZ: -1.75,
    })

    await setComposerField('scenes.growth.seedOrbitCount', 4)
    await setComposerField('scenes.growth.seedCameraFollowSpeed', 5)
    await setComposerField('scenes.growth.seedFallAcceleration', 3.6)
    await setComposerField('scenes.growth.seedFallHeight', 4.7)
    await setComposerField('scenes.growth.seedSpinSpeed', 2)
    await setComposerField('scenes.growth.seedTumbleSpeed', 1.2)
    await setComposerField('scenes.growth.seedWobbleAmplitude', 0.2)
    await setComposerField('scenes.growth.seedOrbitRadius', 0.5)
    await setComposerField('scenes.growth.seedOrbitTilt', 0.8)
    await setComposerField('scenes.growth.seedOrbitSpeed', 1.3)
    await setComposerField('scenes.growth.seedFallDuration', 3.4)
    await setComposerField('scenes.growth.cloudSizeVariation', 0.82)
    await setComposerField('scenes.growth.cloudLightVariation', 0.64)
    await setComposerField('scenes.growth.cloudPathDensity', 0.9)
    await setComposerField('scenes.growth.cloudShapeVariation', 0.88)
    await setComposerField('scenes.growth.cloudDepthVariation', 0.78)
    await setComposerField('scenes.growth.seedCameraLag', 0.5)
    await setComposerField('scenes.growth.islandRevealDuration', 2.2)
    await setComposerField('scenes.growth.seedTrailIntensity', 1.3)
    await setComposerField('scenes.growth.seedTrailSpread', 0.3)
    await setComposerField('scenes.growth.seedTrailLifetime', 1.1)
    await setComposerField('scenes.growth.seedTrailLiftSpeed', 0.8)
    await setComposerField('scenes.growth.seedTrailParticleCount', 88)
    await setComposerField('scenes.growth.seedImpactStrength', 0.8)
    await setComposerField('scenes.growth.seedImpactRadius', 0.9)
    await setComposerField('scenes.growth.seedImpactParticles', 120)
    await setComposerField('scenes.growth.seedImpactLifetime', 1.2)
    await setComposerField('scenes.growth.moonScatteringIntensity', 1.1)
    await setComposerField('scenes.growth.cloudCount', 4)
    await setComposerField('scenes.growth.cloudDensity', 1.4)
    await setComposerField('scenes.growth.cloudScale', 1.2)
    await setComposerField('scenes.growth.cloudDriftSpeed', 0.9)
    await setComposerField('scenes.growth.cloudOpacity', 0.7)
    await setComposerField('scenes.growth.cloudLightIntensity', 1.5)

    const exported = JSON.parse(exportComposerJson()) as { schemaVersion: number; scenes: { growth: Record<string, unknown>; gallery: Record<string, unknown> } }
    expect(exported.schemaVersion).toBe(18)
    expect(exported.scenes.growth).toMatchObject({
      seedOrbitCount: 4, seedOrbitRadius: 0.5, seedOrbitTilt: 0.8, seedOrbitSpeed: 1.3,
      seedFallDuration: 3.4, seedCameraLag: 0.5, islandRevealDuration: 2.2,
      seedCameraFollowSpeed: 5, seedFallAcceleration: 3.6, seedFallHeight: 4.7,
      seedSpinSpeed: 2, seedTumbleSpeed: 1.2, seedWobbleAmplitude: 0.2,
      seedTrailIntensity: 1.3, seedTrailSpread: 0.3, seedTrailLifetime: 1.1,
      seedTrailLiftSpeed: 0.8, seedTrailParticleCount: 88, seedImpactStrength: 0.8, seedImpactRadius: 0.9,
      seedImpactParticles: 120, seedImpactLifetime: 1.2, moonScatteringIntensity: 1.1,
      cloudCount: 4, cloudDensity: 1.4, cloudScale: 1.2, cloudDriftSpeed: 0.9,
      cloudOpacity: 0.7, cloudLightIntensity: 1.5,
      cloudSizeVariation: 0.82, cloudLightVariation: 0.64, cloudPathDensity: 0.9,
      cloudShapeVariation: 0.88, cloudDepthVariation: 0.78,
      moonPositionX: 2.25, moonPositionY: 6.1, moonPositionZ: -1.75,
    })
    expect(exported.scenes.gallery).toMatchObject({ cloudDensity: 1.33, cloudOpacity: 0.63 })
    expect((await importComposerJson(JSON.stringify(exported))).ok).toBe(true)
  })

  it('rejects import when the requested font is not ready and preserves the active config', async () => {
    await setComposerField('scenes.prologue.fontSize', 72)
    const before = getConfig()
    fontLoader.load.mockResolvedValue(false)

    const result = await importComposerJson('{"schemaVersion":1,"scenes":{"prologue":{"fontFamily":"bad-script","fontSize":96}}}')

    expect(result).toEqual({ ok: false, reason: 'font' })
    expect(getConfig()).toBe(before)
  })

  it('reports a font readiness failure during scene reset without changing the active config', async () => {
    await setComposerField('scenes.preparation.fontFamily', 'caveat')
    await setComposerField('scenes.prologue.fontFamily', 'caveat')
    await setComposerField('scenes.preparation.spacing', 36)
    const before = getConfig()
    fontLoader.load.mockResolvedValue(false)

    const result = await resetComposerScope('preparation')

    expect(fontLoader.load).toHaveBeenLastCalledWith('marck-script')
    expect(result).toEqual({ ok: false, reason: 'font', config: before })
    expect(getConfig()).toBe(before)
  })

  it('preserves the active config when the import has an invalid section shape', async () => {
    await setComposerField('scenes.prologue.fontSize', 72)

    const result = await importComposerJson('{"schemaVersion":1,"scenes":null}')

    expect(result.ok).toBe(false)
    expect(getConfig().scenes.prologue.fontSize).toBe(72)
  })

  it('rejects an invalid gallery section in imported JSON without changing the active config', async () => {
    const before = getConfig()

    const result = await importComposerJson('{"schemaVersion":5,"scenes":{"gallery":null}}')

    expect(result).toEqual({ ok: false, reason: 'document' })
    expect(getConfig()).toBe(before)
  })

  it('imports, exports, live-edits, and resets moonlit gallery settings in the shared config store', async () => {
    const imported = await importComposerJson(JSON.stringify({ schemaVersion: 9, scenes: { gallery: {
      cloudLayerCount: 12,
      moonBrightness: 1.35, cloudDensity: 1.2, cloudOpacity: 1.1, cloudDriftVariation: 0.85,
      cloudForegroundAmount: 1.2, cloudBackgroundAmount: 0.6, cloudNearFloorAmount: 0.9,
      cloudCoolTint: 1.2, cloudWhiteHighlight: 0.7, hazeMotionSpeed: 0.4, reflectionStrength: 0.4,
    } } }))
    expect(imported.ok).toBe(true)
    expect(getConfig().scenes.gallery).toMatchObject({ cloudLayerCount: 18, moonBrightness: 1.35, cloudDensity: 1.2, cloudOpacity: 1.1, cloudDriftVariation: 0.85, reflectionStrength: 0.4 })

    await setComposerField('scenes.gallery.moonSize', 1.4)
    expect(getConfig().scenes.gallery.moonSize).toBe(1.4)
    const exported = JSON.parse(exportComposerJson()) as { schemaVersion: number; scenes: { gallery: Record<string, unknown> } }
    expect(exported.schemaVersion).toBe(18)
    expect(exported.scenes.gallery).toMatchObject({ cloudLayerCount: 18, moonSize: 1.4, cloudDensity: 1.2, cloudOpacity: 1.1, cloudDriftVariation: 0.85, cloudCoolTint: 1.2, reflectionStrength: 0.4 })
    expect((await importComposerJson(JSON.stringify(exported))).ok).toBe(true)

    await resetComposerField('scenes.gallery.moonSize')
    await resetComposerScope('gallery')
    expect(getConfig().scenes.gallery).toEqual({
      frameIntensity: 1, particleCount: 220, moonBrightness: 0.8, moonSize: 1,
      cloudDensity: 1.12, cloudOpacity: 0.88, cloudIntensity: 1, cloudScale: 1, cloudLayerCount: 18, cloudDriftSpeed: 0.82,
      cloudDriftVariation: 0.65, cloudForegroundAmount: 1, cloudBackgroundAmount: 0.78, cloudNearFloorAmount: 1,
      cloudCoolTint: 1, cloudWhiteHighlight: 0.48,
      hazeDensity: 0.22, hazeHeight: 0, hazeMotionSpeed: 0.2, reflectionStrength: 0.24,
      reflectionBlur: 0.8, threadOpacity: 0.38, coldLightIntensity: 0.8,
      moonLightIntensity: 1.8, moonFillIntensity: 0.45, moonHaloIntensity: 1.2,
      moonCloudLightIntensity: 1, moonScatteringIntensity: 0.85,
      moonLightColor: '#C3D8F2', moonPositionX: 0.2, moonPositionY: 16, moonPositionZ: -126,
      moonTargetX: 0, moonTargetY: -2.35, moonTargetZ: -34, moonHaloRadius: 1, moonGodRaysIntensity: 0.12,
    })
  })

  it('exports the active config snapshot as JSON', async () => {
    await setComposerField('global.quality', 'low')

    const exported = JSON.parse(exportComposerJson()) as {
      schemaVersion: number
      global: { quality: string }
      scenes: { prologue: Record<string, unknown> }
    }

    expect(exported.schemaVersion).toBe(18)
    expect(exported.global.quality).toBe('low')
    expect(exported.scenes.prologue).not.toHaveProperty('particleSpeed')
    expect(exported.scenes.prologue).not.toHaveProperty('particleSpread')
    expect(exported.scenes.prologue).not.toHaveProperty('particleReturnFraction')
  })

  it('imports, exports, and resets the schema v7 atmosphere controls', async () => {
    const result = await importComposerJson(JSON.stringify({ schemaVersion: 6, scenes: { gallery: {
      cloudIntensity: 1.35, cloudDensity: 1.2, cloudLayerCount: 6,
      hazeDensity: 0.9, hazeHeight: -1.1, moonCloudLightIntensity: 1.4,
    } } }))

    expect(result.ok).toBe(true)
    expect(getConfig().scenes.gallery).toMatchObject({
      cloudIntensity: 1.35, cloudDensity: 1.2, cloudLayerCount: 6,
      hazeDensity: 0.9, hazeHeight: -1.1, moonCloudLightIntensity: 1.4,
    })

    const exported = JSON.parse(exportComposerJson()) as { schemaVersion: number; scenes: { gallery: Record<string, unknown> } }
    expect(exported.schemaVersion).toBe(18)
    expect(exported.scenes.gallery).toMatchObject({ cloudIntensity: 1.35, cloudLayerCount: 6, hazeHeight: -1.1, moonCloudLightIntensity: 1.4 })

    await resetComposerField('scenes.gallery.hazeHeight')
    expect(getConfig().scenes.gallery.hazeHeight).toBe(0)
  })

  it('imports and exports production-ready galaxy settings and the Vasilisa preset', async () => {
    const result = await importComposerJson(JSON.stringify({ schemaVersion: 5, scenes: { galaxy: {
      seed: 'orion', starCount: 42000, arms: 5, palette: 'custom', armColor: '#DDBBFF', nebulaEnabled: false, blackHoleEnabled: true,
    } } }))
    expect(result.ok).toBe(true)
    expect(getConfig().scenes.galaxy).toMatchObject({ seed: 'orion', starCount: 42000, arms: 5, palette: 'custom', armColor: '#DDBBFF', nebulaEnabled: false, blackHoleEnabled: true })
    const exported = JSON.parse(exportComposerJson()) as { scenes: { galaxy: Record<string, unknown> } }
    expect(exported.scenes.galaxy).toMatchObject({ seed: 'orion', starCount: 42000, arms: 5, palette: 'custom', blackHoleEnabled: true })
    await applyComposerPreset('vasilisa-cinematic')
    expect(getConfig().preset).toBe('vasilisa-cinematic')
    expect(getConfig().scenes.galaxy.palette).toBe('spore')
  })

  it('resets one control to its field default', async () => {
    await setComposerField('scenes.prologue.fontSize', 72)

    await resetComposerField('scenes.prologue.fontSize')

    expect(getConfig().scenes.prologue.fontSize).toBe(48)
  })

  it('updates every portrait capture setting through the shared Composer field API', async () => {
    const values: [
      `scenes.identity.${'portraitStartProgress' | 'portraitFraction' | 'portraitMinTurns' | 'portraitMaxTurns' | 'portraitSteering' | 'portraitBraking' | 'portraitSettledBrightness' | 'vortexSpeedMultiplier'}`,
      number,
    ][] = [
      ['scenes.identity.portraitStartProgress', 0.45],
      ['scenes.identity.portraitFraction', 0],
      ['scenes.identity.portraitMinTurns', 0.5],
      ['scenes.identity.portraitMaxTurns', 3],
      ['scenes.identity.portraitSteering', 1.5],
      ['scenes.identity.portraitBraking', 2],
      ['scenes.identity.portraitSettledBrightness', 1.3],
      ['scenes.identity.vortexSpeedMultiplier', 0.8],
    ]

    for (const [path, value] of values) await setComposerField(path, value)

    expect(getConfig().scenes.identity).toMatchObject({
      portraitStartProgress: 0.45, portraitFraction: 0, portraitMinTurns: 0.5, portraitMaxTurns: 3,
      portraitSteering: 1.5, portraitBraking: 2, portraitSettledBrightness: 1.3, vortexSpeedMultiplier: 0.8,
    })
  })

  it('updates and resets the new ash motion settings through Composer controls', async () => {
    await setComposerField('scenes.prologue.windStrength', 2.1)
    await setComposerField('scenes.prologue.fractureWidth', 0.12)
    await setComposerField('scenes.prologue.promptHandwritingDuration', 0.4)
    expect(getConfig().scenes.prologue).toMatchObject({ windStrength: 2.1, fractureWidth: 0.12, promptHandwritingDuration: 0.4 })

    await resetComposerField('scenes.prologue.windStrength')
    await resetComposerScope('prologue')

    expect(getConfig().scenes.prologue).toMatchObject({ windStrength: 1.15, fractureWidth: 0.08, promptHandwritingDuration: 0.65 })
  })

  it('resets one scene group to its defaults', async () => {
    await setComposerField('scenes.preload.glow', 1.75)

    await resetComposerScope('preload')

    expect(getConfig().scenes.preload.glow).toBe(1)
  })

  it('applies a named preset through the shared config store', async () => {
    await applyComposerPreset('stardust')

    expect(getConfig().preset).toBe('stardust')
    expect(getConfig().scenes.prologue.particleCount).toBe(2600)
  })

  it('keeps the configured DPR range ordered while changing a bound', async () => {
    await setComposerField('global.dprMin', 0.75)
    await setComposerField('global.dprMax', 1)

    await setComposerField('global.dprMin', 1.25)

    expect(getConfig().global.dprMin).toBe(1.25)
    expect(getConfig().global.dprMax).toBe(1.25)
  })
})
