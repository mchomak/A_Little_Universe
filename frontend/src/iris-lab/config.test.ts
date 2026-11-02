import { describe, expect, it } from 'vitest'
import { applyViewMode, builtInPresets, cameraViews, defaults, identifyIrisGradingPreset, irisGradingPresets, parseConfig, toggleIrisPreview, updateGradingColor, updateGradingSetting } from './config'
import { hexToOklch } from './gradingMath'

const legacyGrading = {
  hueShift: 8, saturation: 1.2, vibrance: 0.3, blueCyanBalance: 0.8, greenReduction: 0.2,
  brightness: 0.02, contrast: 1.08, amberPreservation: 0.9, strength: 0.75,
}

describe('Iris Lab configuration', () => {
  it('makes Fire Eye a standalone iris view, keeps its model toggle manual, and clears new effects from Original', () => {
    const fire = applyViewMode({ ...structuredClone(defaults), layers: { ...defaults.layers, primaryFibers: true, memorySignal: true, proceduralFibers: false } }, 'Fire Eye Fibers')
    expect(fire.display.showModel).toBe(false)
    expect(fire.layers.proceduralFibers).toBe(true)
    expect(fire.layers.memorySignal).toBe(false)
    expect(fire.layers.primaryFibers).toBe(false)
    expect({ ...fire, display: { ...fire.display, showModel: true } }.display.showModel).toBe(true)
    expect(builtInPresets['Blue Fibers']!.display.showModel).toBe(false)

    const original = applyViewMode(fire, 'Original')
    expect(original.display.showModel).toBe(true)
    expect(original.layers.memorySignal).toBe(false)
    expect(original.layers.proceduralFibers).toBe(false)
  })

  it('adds a standalone source-faithful Memory Signal Baseline mode without changing the original or legacy mode', () => {
    const baseline = applyViewMode(structuredClone(defaults), 'Memory Signal Baseline')
    expect(baseline.display.mode).toBe('Memory Signal Baseline')
    expect(baseline.display.showModel).toBe(false)
    expect(baseline.layers.memorySignal).toBe(false)
    expect(parseConfig(baseline).display.mode).toBe('Memory Signal Baseline')
    expect(applyViewMode(baseline, 'Original').display.showModel).toBe(true)
  })

  it('adds focused photo iris modes with independent editable masks and leaves shared appearance tuning untouched', () => {
    const input = structuredClone(defaults)
    input.camera.distance = 4.9
    input.particles = { ...input.particles, density: 0.73, size: 2.3, glow: 0.61, opacity: 0.44, brightness: 1.4 }
    input.fibers = { ...input.fibers, density: 0.33, curvature: 0.18, length: 0.91, thickness: 0.64, brightness: 0.42, opacity: 0.55, noiseScale: 8.1 }
    input.effects.glow = 0.63
    input.layers.bloom = true
    const blue = applyViewMode(input, 'Blue Particle Eye')
    blue.blueEye.irisCenterX = 0.42
    const fibers = applyViewMode(blue, 'Cinematic Fiber Iris')
    const original = applyViewMode(fibers, 'Original')

    expect(blue.display.showModel).toBe(false)
    expect(blue.layers.bloom).toBe(true)
    expect(blue.effects.glow).toBe(0.63)
    expect(blue.blueEye.irisFocus).toBe(1)
    expect(blue.blueEye.pupilDarkness).toBeGreaterThan(0.95)
    expect(blue.blueEye.particleDensity).toBe(0.3)
    expect(blue.camera).toEqual(input.camera)
    expect(blue.particles).toEqual(input.particles)
    expect(fibers.fibers).toEqual(input.fibers)
    expect(original.particles).toEqual(input.particles)
    expect(original.fibers).toEqual(input.fibers)
    expect(original.effects).toEqual(input.effects)
    expect(original.layers.bloom).toBe(true)
    expect(fibers.display.mode).toBe('Cinematic Fiber Iris')
    expect(parseConfig(fibers).blueEye.irisCenterX).toBe(0.42)
    expect(builtInPresets['Cinematic Fiber Iris']?.display.mode).toBe('Cinematic Fiber Iris')
  })

  it('uses schema v6 for photo masks and view modes while preserving persisted OKLCH grading fields', () => {
    expect(defaults.version).toBe(6)
    expect(Object.keys(defaults.blueEye)).toEqual([
      'irisCenterX', 'irisCenterY', 'irisRadiusX', 'irisRadiusY', 'irisRotation',
      'pupilCenterX', 'pupilCenterY', 'pupilRadiusX', 'pupilRadiusY', 'pupilRotation',
      'irisFocus', 'outerEyeFade', 'irisColorStrength', 'pupilDarkness', 'particleDepth',
      'particleDensity', 'particleSize', 'particleOpacity', 'particleBrightness', 'particleScatter',
      'fiberDensity', 'fiberLength', 'fiberCurvature', 'fiberThickness', 'fiberBrightness', 'fiberOpacity', 'fiberNoiseScale', 'fiberDepth', 'fiberAnimationSpeed', 'bloomStrength',
      'showSourceParticles', 'showFiberRibbons', 'showFiberSparks',
    ])
    expect(Object.keys(defaults.colorGrading).sort()).toEqual([
      'enabled', 'strength', 'targetBlueHue', 'blueChroma', 'grayRecolorStrength', 'lightnessPreservation', 'brightness', 'contrast',
      'innerZoneRadius', 'amberHue', 'amberChroma', 'amberPreservation', 'amberTransitionWidth',
      'middleBlueHue', 'middleBlueChroma', 'middleColorStrength', 'outerZoneStart', 'outerBlueHue', 'outerBlueChroma', 'outerColorStrength',
      'limbalRingHue', 'limbalRingChroma', 'limbalRingDarkness', 'mainBlueColor', 'outerBlueColor', 'darkRimColor', 'amberColor',
      'fiberArtisticColor', 'fiberArtisticMix',
    ].sort())
  })

  it('round trips v5 photo mask values without mutating the shared defaults', () => {
    const input = structuredClone(defaults)
    input.camera.azimuth = 0.4
    input.particles.size = 2
    input.fibers.secondaryDensity = 0.1
    input.colorGrading = updateGradingColor({ ...irisGradingPresets['Vasilisa Natural Blue'] }, 'mainBlueColor', '#729aca')
    expect(parseConfig(JSON.parse(JSON.stringify(input)))).toEqual(input)
    expect(defaults.camera.azimuth).toBe(0)
  })

  it('migrates v1, v2 and v3 settings while adding default look-development controls', () => {
    const legacyV1 = structuredClone(defaults) as Record<string, unknown>
    delete legacyV1.colorGrading
    legacyV1.version = 1
    const migratedV1 = parseConfig(legacyV1)
    expect(migratedV1.version).toBe(6)
    expect(migratedV1.colorGrading).toEqual(defaults.colorGrading)

    const legacyV2 = structuredClone(defaults) as Record<string, unknown>
    legacyV2.version = 2
    legacyV2.camera = { ...defaults.camera, azimuth: 0.41 }
    legacyV2.colorGrading = legacyGrading
    const migratedV2 = parseConfig(legacyV2)
    expect(migratedV2.version).toBe(6)
    expect(migratedV2.camera.azimuth).toBe(0.41)
    expect(migratedV2.colorGrading.grayRecolorStrength).toBe(legacyGrading.blueCyanBalance)
    expect(migratedV2.colorGrading.brightness).toBe(legacyGrading.brightness)
    expect(migratedV2.colorGrading.contrast).toBe(legacyGrading.contrast)
    expect(migratedV2.colorGrading.strength).toBe(legacyGrading.strength)

    const legacyV3 = structuredClone(defaults) as Record<string, unknown>
    legacyV3.version = 3
    delete legacyV3.display
    delete legacyV3.memorySignal
    const oldFibers = legacyV3.fibers as Record<string, unknown>
    for (const key of ['opacity', 'noiseScale', 'fineFrequency', 'coarseFrequency', 'radialAlignment', 'depth', 'animationSpeed']) delete oldFibers[key]
    const oldLayers = legacyV3.layers as Record<string, unknown>
    delete oldLayers.memorySignal
    delete oldLayers.proceduralFibers
    const migratedV3 = parseConfig(legacyV3)
    expect(migratedV3.display.mode).toBe('Original')
    expect(migratedV3.memorySignal).toEqual(defaults.memorySignal)
    expect(migratedV3.version).toBe(6)
  })

  it('migrates v4 configs by adding the default photo mask', () => {
    const previous = structuredClone(defaults) as Record<string, unknown>
    previous.version = 4
    delete previous.blueEye
    const migrated = parseConfig(previous)
    expect(migrated.version).toBe(6)
    expect(migrated.blueEye).toEqual(defaults.blueEye)
  })

  it('migrates schema v5 photo masks while preserving user mask values and adding local particle settings', () => {
    const previous = structuredClone(defaults) as unknown as Record<string, unknown>
    previous.version = 5
    const oldBlueEye = previous.blueEye as Record<string, unknown>
    oldBlueEye.irisCenterX = 0.41
    for (const key of ['particleDensity', 'particleSize', 'particleOpacity', 'particleBrightness', 'particleScatter', 'fiberDensity', 'fiberLength', 'fiberCurvature', 'fiberThickness', 'fiberBrightness', 'fiberOpacity', 'fiberNoiseScale', 'fiberDepth', 'fiberAnimationSpeed', 'bloomStrength']) delete oldBlueEye[key]
    const migrated = parseConfig(previous)
    expect(migrated.version).toBe(6)
    expect(migrated.blueEye.irisCenterX).toBe(0.41)
    expect(migrated.blueEye.particleDensity).toBe(defaults.blueEye.particleDensity)
    expect(migrated.blueEye.fiberCurvature).toBe(defaults.blueEye.fiberCurvature)
    expect(migrated.blueEye.bloomStrength).toBe(0)
  })

  it('rejects unsupported versions, missing fields, invalid ranges and malformed colors', () => {
    expect(() => parseConfig({ ...defaults, version: 7 })).toThrow()
    expect(() => parseConfig({ ...defaults, camera: {} })).toThrow()
    expect(() => parseConfig({ ...defaults, effects: { ...defaults.effects, dpr: Number.NaN } })).toThrow()
    expect(() => parseConfig({ ...defaults, effects: { ...defaults.effects, dpr: -1 } })).toThrow()
    expect(() => parseConfig({ ...defaults, colorGrading: { ...defaults.colorGrading, strength: 1.2 } })).toThrow()
    expect(() => parseConfig({ ...defaults, colorGrading: { ...defaults.colorGrading, targetBlueHue: 380 } })).toThrow()
    expect(() => parseConfig({ ...defaults, colorGrading: { ...defaults.colorGrading, blueChroma: 0.41 } })).toThrow()
    expect(() => parseConfig({ ...defaults, colorGrading: { ...defaults.colorGrading, outerZoneStart: 0.3 } })).toThrow()
    expect(() => parseConfig({ ...defaults, colorGrading: { ...defaults.colorGrading, mainBlueColor: 'blue' } })).toThrow()
    expect(() => parseConfig({ ...defaults, eye: { ...defaults.eye, irisRadius: 10 } })).toThrow()
    expect(() => parseConfig({ ...defaults, fibers: { ...defaults.fibers, secondaryLength: 3 } })).toThrow()
    expect(() => parseConfig({ ...defaults, blueEye: { ...defaults.blueEye, irisRadiusX: 0.01 } })).toThrow()
    expect(() => parseConfig({ ...defaults, effects: { ...defaults.effects, toneMapping: 1.5 } })).toThrow()
  })

  it('keeps each picker and its linked OKLCH hue/chroma sliders synchronized', () => {
    const picked = updateGradingColor(defaults.colorGrading, 'mainBlueColor', '#527bb2')
    const pickedLch = hexToOklch('#527bb2')
    expect(picked.targetBlueHue).toBeCloseTo(pickedLch.h, 4)
    expect(picked.blueChroma).toBeCloseTo(pickedLch.c, 4)
    expect(picked.mainBlueColor).toBe('#527bb2')

    const slider = updateGradingSetting(picked, 'targetBlueHue', 220)
    const sliderColor = hexToOklch(slider.mainBlueColor)
    expect(sliderColor.h).toBeCloseTo(220, 0)
    expect(sliderColor.c).toBeCloseTo(slider.blueChroma, 2)
  })

  it('updates the unlinked artistic fiber color without changing grading hues', () => {
    const updated = updateGradingColor(defaults.colorGrading, 'fiberArtisticColor', '#c2ddf5')
    expect(updated.fiberArtisticColor).toBe('#c2ddf5')
    expect(updated.targetBlueHue).toBe(defaults.colorGrading.targetBlueHue)
    expect(updated.blueChroma).toBe(defaults.colorGrading.blueChroma)
  })

  it('defines five distinct grade presets and recognizes edits as manual', () => {
    expect(Object.keys(irisGradingPresets)).toEqual(['Original', 'Vasilisa Natural Blue', 'Cool Blue', 'Full Blue Recolor', 'Cinematic Blue'])
    expect(identifyIrisGradingPreset(irisGradingPresets['Vasilisa Natural Blue'])).toBe('Vasilisa Natural Blue')
    expect(identifyIrisGradingPreset({ ...irisGradingPresets.Original, brightness: 0.01 })).toBe('Manual')
    const signatures = Object.values(irisGradingPresets).map(({ targetBlueHue, blueChroma, grayRecolorStrength, strength, contrast }) => [targetBlueHue, blueChroma, grayRecolorStrength, strength, contrast].join(':'))
    expect(new Set(signatures).size).toBe(5)
    expect(irisGradingPresets.Original.strength).toBe(0)
    expect(irisGradingPresets.Original.fiberArtisticMix).toBe(0)
    expect(irisGradingPresets['Full Blue Recolor'].grayRecolorStrength).toBe(1)
  })

  it('preserves existing app presets and camera views', () => {
    expect(Object.keys(builtInPresets)).toHaveLength(11)
    expect(builtInPresets['Memory Signal']?.display.mode).toBe('Memory Signal')
    expect(builtInPresets['Blue Fibers']?.display.mode).toBe('Fire Eye Fibers')
    expect(builtInPresets['Blue Particle Eye']?.display.mode).toBe('Blue Particle Eye')
    expect(builtInPresets['Cinematic Fiber Iris']?.display.mode).toBe('Cinematic Fiber Iris')
    expect(builtInPresets['Hybrid Cinematic']?.layers.memorySignal).toBe(true)
    expect(builtInPresets['Natural Eye']?.effects.mix).not.toBe(builtInPresets['Cosmic Blue']?.effects.mix)
    expect(cameraViews['Macro Iris']?.distance).toBeLessThan(cameraViews['Full Eye']!.distance)
    for (const config of Object.values(builtInPresets)) expect(parseConfig(config)).toEqual(config)
  })

  it('keeps before/after and inspection toggles transient and independent of saved config', () => {
    const beforeConfig = JSON.stringify(defaults)
    const initial = { previewGrading: true, albedoOnly: false }
    const beforeView = toggleIrisPreview(initial, 'previewGrading')
    const inspectionView = toggleIrisPreview(beforeView, 'albedoOnly')
    expect(beforeView).toEqual({ previewGrading: false, albedoOnly: false })
    expect(inspectionView).toEqual({ previewGrading: false, albedoOnly: true })
    expect(initial).toEqual({ previewGrading: true, albedoOnly: false })
    expect(JSON.stringify(defaults)).toBe(beforeConfig)
  })
})
