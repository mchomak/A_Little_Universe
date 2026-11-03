import { describe, expect, it } from 'vitest'
import { DEFAULT_PARTICLE_PORTRAIT_SETTINGS } from './config'
import { createScene04PortraitPointExport } from './pointExport'
import type { StarPortraitPoint } from '../scenes/lily/starPortraitTargets'

describe('scene 04 point export', () => {
  it('preserves runtime targets and exports exact shader formulas with only known inputs', () => {
    const points: StarPortraitPoint[] = [
      { u: 0.2, v: 0.3, tone: 0.12, contrast: 0.4, featureWeight: 0.7, seed: 0.25, photoColorLinear: [0.01, 0.01, 0.01] },
      { u: 0.8, v: 0.7, tone: 0.8, contrast: 0.2, featureWeight: 0.3, seed: 0.75, photoColorLinear: [0.6, 0.6, 0.6] },
    ]
    const result = createScene04PortraitPointExport(points, 640, 480, DEFAULT_PARTICLE_PORTRAIT_SETTINGS)

    expect(result.coordinateSpace).toBe('normalized-image-uv')
    expect(result.points[0]?.target).toEqual({ uv: [0.2, 0.3], stage: 0, tone: 0.12, contrast: 0.4, seed: 0.25 })
    expect(result.points[1]?.target.stage).toBe(2)
    expect(result.points[0]).toMatchObject({
      u: 0.2,
      v: 0.3,
      tone: 0.12,
      contrast: 0.4,
      featureWeight: 0.7,
      seed: 0.25,
      photoColorLinear: [0.01, 0.01, 0.01],
      shaderInputs: {
        targetTone: 0.12,
        targetContrast: 0.4,
        targetSeed: 0.25,
        targetFeatureWeight: 0.7,
        sourceColorLinear: [0.01, 0.01, 0.01],
      },
    })
    expect(result.points[0]).not.toHaveProperty('size')
    expect(result.points[0]).not.toHaveProperty('brightness')
    expect(result.points.every((point) => Number.isFinite(point.referenceBase.size.glPointSize)
      && Number.isFinite(point.referenceBase.brightness.glow))).toBe(true)
    expect(result.renderContract.evaluation).toBe('runtime-dependent')
    expect(result.renderContract.uniforms).toMatchObject({
      uLilyPortraitPointMinSize: 1.2,
      uLilyPortraitPointMaxSize: 2.8,
      uLilyPortraitBrightness: 2,
      uLilyPortraitOpacity: 1,
      uLilyPortraitMinimumBrightness: 0.3,
      uLilyPortraitContrast: 1,
    })
    expect(result.renderContract.size.formula).toContain('gl_PointSize = clamp(pointSize, pointMinSize, pointMaxSize)')
    expect(result.renderContract.size.runtimeInputs).toContain('uLilyDpr')
    expect(result.renderContract.brightness.formula).toContain('glow = (core + halo * haloScale) * vAlpha * uLilyParticleBrightness * brightnessAccent * portraitBrightness * sourceContrast * settledBrightness * targetSeedAccent')
    expect(result.renderContract.brightness.runtimeInputs).toContain('vSeed')
    expect(result.rendererFormulaVersion).toBe('scene04-lily-portrait-v1')
  })

  it('exports numerical reference bases per point without labeling them as final display pixels', () => {
    const settings = {
      ...DEFAULT_PARTICLE_PORTRAIT_SETTINGS,
      minSize: 0.4,
      maxSize: 3,
      brightness: 0.2,
      glow: 0,
      opacity: 0.2,
      minimumBrightness: 0,
    }
    const point: StarPortraitPoint = {
      u: 0.5,
      v: 0.5,
      tone: 0.16,
      contrast: 0.1,
      featureWeight: 0,
      seed: 0,
      photoColorLinear: [0, 0, 0],
    }
    const result = createScene04PortraitPointExport([point], 640, 640, settings)

    expect(result.points[0]?.referenceBase).toEqual({
      size: { glPointSize: 2.900484, unclampedGlPointSize: 2.900484 },
      brightness: { glow: 0.106559, outputAlpha: 0.012361 },
    })
    expect(result.renderContract.referenceSystem).toMatchObject({
      sizeBase: 'gl_PointSize scalar after shader clamp; reference point-size units, not final screen pixels',
      brightnessBase: 'center-fragment shader glow before alpha blending and tone mapping',
      assumptions: { uLilyDpr: 1, viewZ: -1, particleSeed: 0.5, portraitMix: 1 },
    })
    expect(result.renderContract.referenceSystem.runtimeDependencies).toContain('camera-space view.z and display DPR')
  })

  it('retains each generated particle class in the scene-compatible export', () => {
    const point: TypedPoint = {
      u: 0.5, v: 0.5, tone: 0.5, contrast: 0.5, featureWeight: 1, seed: 0.5,
      photoColorLinear: [0.2, 0.2, 0.2], type: 'flow', artSize: 1.3, artBrightness: 1.1,
    }
    const result = createScene04PortraitPointExport([point], 640, 480, DEFAULT_PARTICLE_PORTRAIT_SETTINGS)
    expect(result.points[0]).toMatchObject({ type: 'flow', artSize: 1.3, artBrightness: 1.1 })
  })

  it('exports support particles as a typed extension of the existing target format', () => {
    const point: TypedPoint = {
      u: 0.5, v: 0.5, tone: 0.5, contrast: 0.35, featureWeight: 0.45, seed: 0.25,
      photoColorLinear: [0.2, 0.2, 0.2], type: 'support', artSize: 0.8, artBrightness: 0.45,
    }
    const result = createScene04PortraitPointExport([point], 640, 480, DEFAULT_PARTICLE_PORTRAIT_SETTINGS)
    expect(result.points[0]).toMatchObject({ type: 'support', artSize: 0.8, artBrightness: 0.45, target: { uv: [0.5, 0.5] } })
  })
})

type TypedPoint = StarPortraitPoint & { type: 'contour' | 'support' | 'flow' | 'fill'; artSize: number; artBrightness: number }
