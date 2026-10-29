import { describe, expect, it } from 'vitest'
import { computeIrisZoneWeights, gamutMapOklab, gradeIrisColor, hexToOklch, linearSrgbToOklch, linearToSrgb, oklchToHex, srgbToLinear } from './gradingMath'
import { irisGradingFunctionsGlsl, irisGradingUniformsGlsl } from './gradingShader'

const neutralGrade = {
  enabled: true, strength: 1, targetBlueHue: 245, blueChroma: 0.09,
  grayRecolorStrength: 1, lightnessPreservation: 1, brightness: 0, contrast: 1,
  innerZoneRadius: 0.2, amberHue: 75, amberChroma: 0.09, amberPreservation: 1, amberTransitionWidth: 0.08,
  middleBlueHue: 238, middleBlueChroma: 0.1, middleColorStrength: 1,
  outerZoneStart: 0.82, outerBlueHue: 238, outerBlueChroma: 0.08, outerColorStrength: 1,
  limbalRingHue: 238, limbalRingChroma: 0.04, limbalRingDarkness: 0.2,
  mainBlueColor: '#7896c0', outerBlueColor: '#667f9e', darkRimColor: '#394b66', amberColor: '#bc9057',
  fiberArtisticColor: '#9abde3', fiberArtisticMix: 0,
}

describe('OKLab iris grading reference', () => {
  it('assigns blue chroma to a neutral gray sample while preserving its lightness', () => {
    const source = [0.45, 0.45, 0.45] as const
    const graded = gradeIrisColor(source, 0.58, neutralGrade)
    const before = linearSrgbToOklch(source)
    const after = linearSrgbToOklch(graded)

    expect(after.c).toBeGreaterThan(0.07)
    expect(after.h).toBeGreaterThan(220)
    expect(after.h).toBeLessThan(255)
    expect(after.l).toBeCloseTo(before.l, 3)
  })

  it('recolors neutral gray in the outer zone as well as the middle zone', () => {
    const graded = gradeIrisColor([0.42, 0.42, 0.42], 0.85, { ...neutralGrade, middleColorStrength: 0 })
    const after = linearSrgbToOklch(graded)
    expect(after.c).toBeGreaterThan(0.025)
    expect(after.h).toBeGreaterThan(220)
    expect(after.h).toBeLessThan(255)
  })

  it('leaves a neutral limbal pixel unchanged when gray recoloring is disabled', () => {
    const source = [0.42, 0.42, 0.42] as const
    const graded = gradeIrisColor(source, 0.98, { ...neutralGrade, grayRecolorStrength: 0 })

    graded.forEach((channel, index) => expect(channel).toBeCloseTo(source[index]!, 6))
  })

  it('still grades chromatic limbal details when gray recoloring is disabled', () => {
    const source = [0.25, 0.3, 0.42] as const
    const graded = gradeIrisColor(source, 0.98, { ...neutralGrade, grayRecolorStrength: 0 })

    expect(graded).not.toEqual(source)
  })

  it('leaves the source tuple unchanged at zero grading strength', () => {
    const source = [0.11, 0.23, 0.47] as const
    const graded = gradeIrisColor(source, 0.94, { ...neutralGrade, strength: 0 })
    expect(graded).toEqual(source)
  })

  it('protects an amber inclusion from the middle-blue zone at full amber preservation', () => {
    const source = [0.6, 0.4, 0.1] as const
    const graded = gradeIrisColor(source, 0.24, neutralGrade)
    graded.forEach((channel, index) => expect(channel).toBeCloseTo(source[index]!, 5))
  })

  it('reduces out-of-gamut chroma while retaining hue and lightness', () => {
    const source = [0.68, 0.42, -0.38] as const
    const mapped = gamutMapOklab(source)
    const before = { l: source[0], c: Math.hypot(source[1], source[2]), h: (Math.atan2(source[2], source[1]) * 180 / Math.PI + 360) % 360 }
    const after = linearSrgbToOklch(mapped)

    expect(mapped.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1)).toBe(true)
    expect(after.c).toBeLessThan(before.c)
    expect(after.l).toBeCloseTo(before.l, 3)
    expect(Math.abs(((after.h - before.h + 540) % 360) - 180)).toBeLessThan(1)
  })

  it('round trips a linked blue color picker through OKLCH', () => {
    const selected = '#7896c0'
    expect(oklchToHex(hexToOklch(selected))).toBe(selected)
  })

  it('converts between encoded sRGB and linear-sRGB', () => {
    expect(linearToSrgb(srgbToLinear(0.5))).toBeCloseTo(0.5, 8)
    expect(srgbToLinear(0.5)).toBeCloseTo(0.21404114, 7)
  })

  it('keeps inner, middle and outer radial weights independently addressable', () => {
    const settings = { innerZoneRadius: 0.2, amberTransitionWidth: 0.08, outerZoneStart: 0.82 }
    const inner = computeIrisZoneWeights(0.05, settings)
    const middle = computeIrisZoneWeights(0.55, settings)
    const outer = computeIrisZoneWeights(0.98, settings)

    expect(inner.inner).toBeGreaterThan(0.99)
    expect(inner.middle).toBeLessThan(0.01)
    expect(middle.middle).toBeGreaterThan(0.99)
    expect(middle.outer).toBeLessThan(0.01)
    expect(outer.outer).toBeGreaterThan(0.99)
    expect(outer.limbal).toBeGreaterThan(0.99)
  })

  it('exports the shared GLSL grading contract with normalized radial input', () => {
    expect(irisGradingUniformsGlsl).toContain('uniform float gradeEnabled;')
    expect(irisGradingFunctionsGlsl).toContain('vec3 gradeIris(vec3 sourceLinear, float normalizedRadius)')
    expect(irisGradingFunctionsGlsl).toContain('gradeGrayRecolorStrength')
    expect(irisGradingFunctionsGlsl).toContain('gradeAmberPreservation')
    expect(irisGradingFunctionsGlsl).toContain('gradeLimbalRingDarkness')
  })
})
