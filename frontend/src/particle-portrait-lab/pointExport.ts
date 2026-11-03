import { orderLilyPortraitTargets } from '../scenes/lily/portraitIntegration'
import {
  glslFloat,
  LILY_PARTICLE_MAX_POINT_SIZE,
  LILY_PARTICLE_MAX_SIZE_ACCENT,
  LILY_PARTICLE_TAIL_SECONDS,
  LILY_PORTRAIT_MAX_FEATURE_ACCENT,
  LILY_PORTRAIT_MAX_TONE_CONTRAST,
  LILY_PORTRAIT_MIN_FEATURE_ACCENT,
  LILY_PORTRAIT_MIN_TONE_CONTRAST,
} from '../scenes/lily/dissolve'
import type { StarPortraitPoint } from '../scenes/lily/starPortraitTargets'
import type { ParticlePortraitSettings } from './config'

export const SCENE04_PORTRAIT_SHADER_FORMULA = 'scene04-lily-portrait-v1'

type TypedPortraitPoint = StarPortraitPoint & { type?: 'contour' | 'support' | 'flow' | 'fill'; artSize?: number; artBrightness?: number }

/**
 * Export the sampler's native point shape and the current Scene 04 target
 * shape. Each target has deterministic reference size and center-glow values;
 * the render contract documents the fixed assumptions and runtime variables
 * that make the eventual scene render differ from those reference values.
 */
export function createScene04PortraitPointExport(
  sampledPoints: readonly TypedPortraitPoint[],
  width: number,
  height: number,
  settings: ParticlePortraitSettings,
) {
  const points = orderLilyPortraitTargets(sampledPoints) as TypedPortraitPoint[]
  return {
    format: 'a-little-universe/scene04-star-portrait-points',
    version: 1,
    coordinateSpace: 'normalized-image-uv',
    rendererFormulaVersion: SCENE04_PORTRAIT_SHADER_FORMULA,
    source: { width, height },
    count: points.length,
    seed: settings.seed,
    settings,
    renderContract: createRenderContract(settings),
    points: points.map((point, index) => ({
      // Preserve the StarPortraitPoint fields consumed by the current runtime.
      ...point,
      // Keep the point class explicit for future staged reveal controls.
      type: point.type ?? 'fill',
      artSize: point.artSize ?? 1,
      artBrightness: point.artBrightness ?? 1,
      // This object can be passed to the existing PortraitTarget integration.
      target: {
        uv: [point.u, point.v],
        stage: Math.min(3, Math.floor(index / Math.max(1, points.length) * 4)),
        tone: point.tone,
        contrast: point.contrast,
        seed: point.seed,
      },
      shaderInputs: {
        targetTone: point.tone,
        targetContrast: point.contrast,
        targetSeed: point.seed,
        targetFeatureWeight: point.featureWeight,
        sourceColorLinear: point.photoColorLinear,
      },
      referenceBase: createReferenceBase(point, settings),
    })),
  }
}

function createRenderContract(settings: ParticlePortraitSettings) {
  return {
    evaluation: 'runtime-dependent',
    referenceSystem: {
      name: 'settled-portrait-center-at-dpr-1',
      sizeBase: 'gl_PointSize scalar after shader clamp; reference point-size units, not final screen pixels',
      brightnessBase: 'center-fragment shader glow before alpha blending and tone mapping',
      alphaBase: 'center-fragment output alpha before tone mapping',
      assumptions: {
        portraitMix: 1,
        portraitAlpha: 1,
        portraitSettled: 1,
        pointCoordRadius: 0,
        age: 0,
        viewZ: -1,
        uLilySize: 1,
        uLilyDpr: 1,
        uLilyPortraitSize: 1,
        uLilyParticleBrightness: 1,
        uLilyPortraitSettledBrightness: 1.15,
        particleSeed: 0.5,
      },
      runtimeDependencies: [
        'actual particle aSeed and target assignment',
        'camera-space view.z and display DPR',
        'particle age, portrait travel mix, and reveal alpha',
        'settled brightness uniform and viewport compositing',
      ],
    },
    uniforms: {
      uLilyPortraitPointMinSize: settings.minSize,
      uLilyPortraitPointMaxSize: settings.maxSize,
      uLilyPortraitBrightness: settings.brightness,
      uLilyPortraitOpacity: settings.opacity,
      uLilyPortraitGlow: settings.glow,
      uLilyPortraitPhotoColorMix: settings.photoColorMix,
      uLilyPortraitMinimumBrightness: settings.minimumBrightness,
      uLilyPortraitContrast: settings.portraitContrast,
    },
    size: {
      output: 'gl_PointSize',
      formula: [
        `sizeAccent = mix(0.82, ${glslFloat(LILY_PARTICLE_MAX_SIZE_ACCENT)}, pow(aSeed, 8.0))`,
        'featureSize = mix(0.92, 1.7, smoothstep(0.1, 0.48, vPortraitContrast))',
        'targetSeedSize = mix(0.96, 1.04, vPortraitTargetSeed)',
        'portraitSize = mix(1.0, uLilyPortraitSize * featureSize * targetSeedSize, portraitMix)',
        `pointSize = uLilySize * sizeAccent * portraitSize * uLilyDpr * (1.0 - 0.5 * clamp(age / ${glslFloat(LILY_PARTICLE_TAIL_SECONDS)}, 0.0, 1.0)) * 4.0 / max(0.5, -view.z)`,
        'pointMinSize = mix(1.0, uLilyPortraitPointMinSize, portraitMix)',
        `pointMaxSize = mix(${glslFloat(LILY_PARTICLE_MAX_POINT_SIZE)}, uLilyPortraitPointMaxSize, portraitMix)`,
        'gl_PointSize = clamp(pointSize, pointMinSize, pointMaxSize)',
      ],
      runtimeInputs: ['aSeed', 'uLilySize', 'uLilyDpr', 'uLilyPortraitSize', 'age', 'view.z', 'portraitMix'],
    },
    brightness: {
      output: 'glow',
      formula: [
        'brightnessAccent = mix(0.52, 1.5, pow(vSeed, 8.0))',
        `featureAccent = mix(${glslFloat(LILY_PORTRAIT_MIN_FEATURE_ACCENT)}, ${glslFloat(LILY_PORTRAIT_MAX_FEATURE_ACCENT)}, smoothstep(0.1, 0.48, vPortraitContrast))`,
        'targetFeatureAccent = mix(0.95, 1.05, vPortraitFeatureWeight)',
        'portraitBrightness = mix(1.0, uLilyPortraitBrightness * featureAccent * targetFeatureAccent, vPortraitMix)',
        'portraitTone = clamp(0.5 + (vPortraitTone - 0.5) * uLilyPortraitContrast, uLilyPortraitMinimumBrightness, 1.0)',
        `toneContrast = mix(${glslFloat(LILY_PORTRAIT_MIN_TONE_CONTRAST)}, ${glslFloat(LILY_PORTRAIT_MAX_TONE_CONTRAST)}, smoothstep(0.16, 0.82, portraitTone))`,
        'sourceContrast = mix(1.0, toneContrast, vPortraitMix)',
        'settledBrightness = mix(1.0, uLilyPortraitSettledBrightness, vPortraitSettled)',
        'targetSeedAccent = mix(0.98, 1.02, vPortraitTargetSeed)',
        'glow = (core + halo * haloScale) * vAlpha * uLilyParticleBrightness * brightnessAccent * portraitBrightness * sourceContrast * settledBrightness * targetSeedAccent',
        'discard if glow < 0.004',
        'alpha = min(0.9, glow * 0.58) * uLilyPortraitOpacity',
      ],
      runtimeInputs: [
        'core', 'halo', 'haloScale', 'vAlpha', 'vSeed', 'vPortraitMix', 'vPortraitTone', 'vPortraitContrast',
        'vPortraitFeatureWeight', 'vPortraitSettled', 'vPortraitTargetSeed', 'uLilyParticleBrightness',
        'uLilyPortraitSettledBrightness',
      ],
    },
    color: {
      formula: [
        'sourceTone = mix(mix(uGold, uPink, 0.58), uPearl, smoothstep(0.16, 0.9, portraitTone))',
        'color = mix(vortexColor, sourceTone, vPortraitMix)',
        'color = mix(color, vPortraitSourceColor, clamp(uLilyPortraitPhotoColorMix, 0.0, 1.0) * vPortraitMix)',
      ],
    },
  }
}

function createReferenceBase(point: StarPortraitPoint, settings: ParticlePortraitSettings) {
  const particleSeed = 0.5
  const targetSeed = clamp(point.seed, 0, 1)
  const targetFeatureWeight = clamp(point.featureWeight, 0, 1)
  const targetContrast = clamp(point.contrast, 0, 1)
  const portraitTone = clamp(
    0.5 + (clamp(point.tone, 0, 1) - 0.5) * settings.portraitContrast,
    settings.minimumBrightness,
    1,
  )
  const smoothContrast = smoothstep(0.1, 0.48, targetContrast)
  const sizeAccent = mix(0.82, LILY_PARTICLE_MAX_SIZE_ACCENT, particleSeed ** 8)
  const featureSize = mix(0.92, 1.7, smoothContrast)
  const targetSeedSize = mix(0.96, 1.04, targetSeed)
  const unclampedSize = 4 * sizeAccent * featureSize * targetSeedSize
  const minSize = mix(1, settings.minSize, 1)
  const maxSize = mix(LILY_PARTICLE_MAX_POINT_SIZE, settings.maxSize, 1)
  const glPointSize = clamp(unclampedSize, minSize, maxSize)

  const brightnessAccent = mix(0.52, 1.5, particleSeed ** 8)
  const featureAccent = mix(LILY_PORTRAIT_MIN_FEATURE_ACCENT, LILY_PORTRAIT_MAX_FEATURE_ACCENT, smoothContrast)
  const targetFeatureAccent = mix(0.95, 1.05, targetFeatureWeight)
  const portraitBrightness = settings.brightness * featureAccent * targetFeatureAccent
  const toneContrast = mix(
    LILY_PORTRAIT_MIN_TONE_CONTRAST,
    LILY_PORTRAIT_MAX_TONE_CONTRAST,
    smoothstep(0.16, 0.82, portraitTone),
  )
  const targetSeedAccent = mix(0.98, 1.02, targetSeed)
  const core = 1
  const halo = 0.18 * settings.glow
  const haloScale = 0.55
  const glow = (core + halo * haloScale) * brightnessAccent * portraitBrightness * toneContrast * 1.15 * targetSeedAccent
  const outputAlpha = Math.min(0.9, glow * 0.58) * settings.opacity

  return {
    size: {
      glPointSize: roundForExport(glPointSize),
      unclampedGlPointSize: roundForExport(unclampedSize),
    },
    brightness: {
      glow: roundForExport(glow),
      outputAlpha: roundForExport(outputAlpha),
    },
  }
}

function mix(minimum: number, maximum: number, amount: number) {
  return minimum + (maximum - minimum) * amount
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const amount = clamp((value - edge0) / Math.max(0.000001, edge1 - edge0), 0, 1)
  return amount * amount * (3 - 2 * amount)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function roundForExport(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}
