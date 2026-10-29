import { describe, expect, it } from 'vitest'
import { builtInPresets, cameraViews, defaults, identifyIrisGradingPreset, irisGradingPresets, parseConfig, toggleIrisPreview, updateGradingColor, updateGradingSetting } from './config'
import { hexToOklch } from './gradingMath'

const legacyGrading = {
  hueShift: 8, saturation: 1.2, vibrance: 0.3, blueCyanBalance: 0.8, greenReduction: 0.2,
  brightness: 0.02, contrast: 1.08, amberPreservation: 0.9, strength: 0.75,
}

describe('Iris Lab configuration', () => {
  it('uses schema v3 and exposes every persisted OKLCH grading field', () => {
    expect(defaults.version).toBe(3)
    expect(Object.keys(defaults.colorGrading).sort()).toEqual([
      'enabled', 'strength', 'targetBlueHue', 'blueChroma', 'grayRecolorStrength', 'lightnessPreservation', 'brightness', 'contrast',
      'innerZoneRadius', 'amberHue', 'amberChroma', 'amberPreservation', 'amberTransitionWidth',
      'middleBlueHue', 'middleBlueChroma', 'middleColorStrength', 'outerZoneStart', 'outerBlueHue', 'outerBlueChroma', 'outerColorStrength',
      'limbalRingHue', 'limbalRingChroma', 'limbalRingDarkness', 'mainBlueColor', 'outerBlueColor', 'darkRimColor', 'amberColor',
      'fiberArtisticColor', 'fiberArtisticMix',
    ].sort())
  })

  it('round trips v3 values without mutating the shared defaults', () => {
    const input = structuredClone(defaults)
    input.camera.azimuth = 0.4
    input.particles.size = 2
    input.fibers.secondaryDensity = 0.1
    input.colorGrading = updateGradingColor({ ...irisGradingPresets['Vasilisa Natural Blue'] }, 'mainBlueColor', '#729aca')
    expect(parseConfig(JSON.parse(JSON.stringify(input)))).toEqual(input)
    expect(defaults.camera.azimuth).toBe(0)
  })

  it('migrates v1 and legacy HSV v2 settings to v3 without losing other groups', () => {
    const legacyV1 = structuredClone(defaults) as Record<string, unknown>
    delete legacyV1.colorGrading
    legacyV1.version = 1
    const migratedV1 = parseConfig(legacyV1)
    expect(migratedV1.version).toBe(3)
    expect(migratedV1.colorGrading).toEqual(defaults.colorGrading)

    const legacyV2 = structuredClone(defaults) as Record<string, unknown>
    legacyV2.version = 2
    legacyV2.camera = { ...defaults.camera, azimuth: 0.41 }
    legacyV2.colorGrading = legacyGrading
    const migratedV2 = parseConfig(legacyV2)
    expect(migratedV2.version).toBe(3)
    expect(migratedV2.camera.azimuth).toBe(0.41)
    expect(migratedV2.colorGrading.grayRecolorStrength).toBe(legacyGrading.blueCyanBalance)
    expect(migratedV2.colorGrading.brightness).toBe(legacyGrading.brightness)
    expect(migratedV2.colorGrading.contrast).toBe(legacyGrading.contrast)
    expect(migratedV2.colorGrading.strength).toBe(legacyGrading.strength)
  })

  it('rejects unsupported versions, missing fields, invalid ranges and malformed colors', () => {
    expect(() => parseConfig({ ...defaults, version: 4 })).toThrow()
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
    expect(Object.keys(builtInPresets)).toHaveLength(5)
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
