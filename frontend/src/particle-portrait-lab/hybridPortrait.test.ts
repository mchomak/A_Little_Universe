import { describe, expect, it } from 'vitest'
import { DEFAULT_PARTICLE_PROFILES, DEFAULT_PORTRAIT_STRUCTURE_SETTINGS } from './particleProfiles'
import { buildContourDistanceField, sampleHybrid, type Stroke } from './hybridPortrait'
import { sampleStarPortraitTargets, type StarPortraitSource } from '../scenes/lily/starPortraitTargets'

const width = 80, height = 64
const source: StarPortraitSource = { width, height, photoRgba: new Uint8ClampedArray(width * height * 4).fill(180), matteRgba: new Uint8ClampedArray(width * height * 4).fill(255) }
const settings = { count: 900, detailBoost: 1, fillDensity: 1, contrast: 1, backgroundThreshold: .1, irregularity: .5, seed: 42 }
const density = new Uint8Array(width * height).fill(128)
const blankSuppression = new Uint8Array(width * height)
const line: Stroke = { id: 'line', kind: 'contour', points: [{ x: 6, y: 32 }, { x: 74, y: 32 }], spacing: 5, jitter: 0, brightness: 1, width: 0, smooth: 0, size: 1 }
const distanceToLine = (point: { u: number; v: number }) => Math.abs(point.v * height - 32)

describe('hybrid portrait sampling', () => {
  it('is deterministic and keeps fill and support around feature strokes', () => {
    const points = sampleHybrid(source, settings, density, blankSuppression, [line])
    expect(points).toEqual(sampleHybrid(source, settings, density, blankSuppression, [line]))
    expect(points.filter((point) => point.type === 'contour')).toHaveLength(10)
    expect(points.filter((point) => point.type === 'support').length).toBeGreaterThan(0)
    expect(points.filter((point) => point.type === 'fill' && distanceToLine(point) <= 5).length).toBeGreaterThan(0)
    expect(points.filter((point) => point.type === 'support').every((point) => distanceToLine(point) <= DEFAULT_PORTRAIT_STRUCTURE_SETTINGS.supportWidth * 2.4)).toBe(true)
  })

  it('does not treat flow strokes as contour falloff sources', () => {
    const flow: Stroke = { ...line, id: 'hair', kind: 'flow', width: 0 }
    const points = sampleHybrid(source, settings, density, blankSuppression, [flow])
    expect(points.some((point) => point.type === 'support')).toBe(false)
    expect(points.some((point) => point.type === 'fill' && distanceToLine(point) <= 5)).toBe(true)
  })

  it('limits contour falloff while preserving both user-authored mask exclusions', () => {
    const noFloor = { ...DEFAULT_PORTRAIT_STRUCTURE_SETTINGS, fillSuppression: 1, minFaceFill: 0, supportMix: 0 }
    const withFloor = { ...noFloor, minFaceFill: 0.5 }
    const withoutFloor = sampleHybrid(source, settings, density, blankSuppression, [line], DEFAULT_PARTICLE_PROFILES, noFloor)
    const withMinimum = sampleHybrid(source, settings, density, blankSuppression, [line], DEFAULT_PARTICLE_PROFILES, withFloor)
    const centralFillCount = (points: typeof withMinimum) => points.filter((point) => point.type === 'fill' && distanceToLine(point) < 8).length
    expect(centralFillCount(withoutFloor)).toBeLessThan(centralFillCount(withMinimum))
    expect(centralFillCount(withMinimum)).toBeGreaterThan(0)

    const blackDensity = new Uint8Array(width * height)
    const hardSuppression = new Uint8Array(width * height).fill(255)
    const excluded = sampleHybrid(source, settings, blackDensity, hardSuppression, [line], DEFAULT_PARTICLE_PROFILES, withFloor)
    expect(excluded.every((point) => point.type === 'contour')).toBe(true)
  })

  it('enforces a minimum contour point interval', () => {
    const closeStroke = { ...line, spacing: 3 }
    const profiles = { ...DEFAULT_PARTICLE_PROFILES, contour: { ...DEFAULT_PARTICLE_PROFILES.contour, density: 2, jitter: 0 } }
    const structure = { ...DEFAULT_PORTRAIT_STRUCTURE_SETTINGS, contourMinSpacing: 12, supportMix: 0 }
    const points = sampleHybrid(source, settings, density, blankSuppression, [closeStroke], profiles, structure).filter((point) => point.type === 'contour')
    const xs = points.map((point) => point.u * width).sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(11.9)
  })

  it('enforces contour spacing after jitter and across overlapping strokes', () => {
    const profiles = { ...DEFAULT_PARTICLE_PROFILES, contour: { ...DEFAULT_PARTICLE_PROFILES.contour, density: 2, jitter: 2 } }
    const structure = { ...DEFAULT_PORTRAIT_STRUCTURE_SETTINGS, contourMinSpacing: 12, supportMix: 0 }
    const strokes = [{ ...line, jitter: 20, spacing: 3 }, { ...line, id: 'overlap', jitter: 20, spacing: 3 }]
    const points = sampleHybrid(source, settings, density, blankSuppression, strokes, profiles, structure).filter((point) => point.type === 'contour')
    expect(points.length).toBeGreaterThan(2)
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      expect(Math.hypot((points[i]!.u - points[j]!.u) * width, (points[i]!.v - points[j]!.v) * height)).toBeGreaterThanOrEqual(11.999)
    }
  })

  it('limits support budget by the area around feature strokes', () => {
    const shortLine = { ...line, points: [{ x: 38, y: 32 }, { x: 42, y: 32 }] }
    const structure = { ...DEFAULT_PORTRAIT_STRUCTURE_SETTINGS, supportWidth: 5, supportMix: 0.7 }
    const short = sampleHybrid(source, settings, density, blankSuppression, [shortLine], DEFAULT_PARTICLE_PROFILES, structure)
    const long = sampleHybrid(source, settings, density, blankSuppression, [line], DEFAULT_PARTICLE_PROFILES, structure)
    const supportCount = (points: typeof short) => points.filter((point) => point.type === 'support').length
    expect(supportCount(short)).toBeGreaterThan(0)
    expect(supportCount(short)).toBeLessThan(supportCount(long) * 0.6)
    expect(supportCount(short)).toBeLessThan(settings.count * 0.15)
  })

  it('leaves support density and brightness independently adjustable', () => {
    const noSupport = { ...DEFAULT_PARTICLE_PROFILES, support: { ...DEFAULT_PARTICLE_PROFILES.support, density: 0 } }
    const noSupportPoints = sampleHybrid(source, settings, density, blankSuppression, [line], noSupport)
    expect(noSupportPoints.some((point) => point.type === 'support')).toBe(false)
    const dimSupport = { ...DEFAULT_PARTICLE_PROFILES, support: { ...DEFAULT_PARTICLE_PROFILES.support, brightness: .2 } }
    const dimSupportPoints = sampleHybrid(source, settings, density, blankSuppression, [line], dimSupport)
    expect(dimSupportPoints.filter((point) => point.type === 'support').every((point) => point.artBrightness === .2)).toBe(true)
  })

  it('applies the support jitter control to support placement', () => {
    const regular = { ...DEFAULT_PARTICLE_PROFILES, support: { ...DEFAULT_PARTICLE_PROFILES.support, jitter: 0 } }
    const scattered = { ...DEFAULT_PARTICLE_PROFILES, support: { ...DEFAULT_PARTICLE_PROFILES.support, jitter: 1.5 } }
    const first = sampleHybrid(source, settings, density, blankSuppression, [line], regular).filter((point) => point.type === 'support')
    const second = sampleHybrid(source, settings, density, blankSuppression, [line], scattered).filter((point) => point.type === 'support')
    expect(first.length).toBeGreaterThan(0)
    expect(first.map(({ u, v }) => [u, v])).not.toEqual(second.map(({ u, v }) => [u, v]))
  })

  it('keeps contour colors in the same linear color space as fill points', () => {
    const photo = source.photoRgba.slice()
    const offset = (32 * width + 6) * 4
    photo.set([128, 64, 32, 255], offset)
    const points = sampleHybrid({ ...source, photoRgba: photo }, settings, density, blankSuppression, [line])
    const contour = points.find((point) => point.type === 'contour')!
    expect(contour.photoColorLinear[0]).toBeCloseTo(0.21586, 4)
    expect(contour.photoColorLinear[1]).toBeCloseTo(0.05127, 4)
    expect(contour.photoColorLinear[2]).toBeCloseTo(0.01444, 4)
  })

  it('honors the configured total point budget with manual marks first', () => {
    const manyPoints: Stroke = { ...line, points: [{ x: 0, y: 32 }, { x: 79, y: 32 }], spacing: 3 }
    const limited = sampleHybrid(source, { ...settings, count: 5 }, density, blankSuppression, [manyPoints])
    expect(limited).toHaveLength(5)
    expect(limited.every((point) => point.type === 'contour')).toBe(true)
  })

  it('builds a deterministic distance field only from contours', () => {
    const contour = buildContourDistanceField(width, height, [line])
    const hair = buildContourDistanceField(width, height, [{ ...line, kind: 'flow' }])
    expect(contour.values).toEqual(buildContourDistanceField(width, height, [line]).values)
    expect(contour.values.some((value) => value === 0)).toBe(true)
    expect(hair.values.every((value) => value === Infinity)).toBe(true)
  })

  it('keeps fill coordinates unchanged without feature strokes', () => {
    const expected = sampleStarPortraitTargets({ ...source, importanceMask: density }, settings)
    const actual = sampleHybrid(source, settings, density, blankSuppression, []).filter((point) => point.type === 'fill')
    expect(actual.map(({ u, v }) => [u, v])).toEqual(expected.map(({ u, v }) => [u, v]))
  })
})
