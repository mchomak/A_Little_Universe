import { describe, expect, it } from 'vitest'
import { createLilyParticleGeometry } from './dissolve'
import { buildLilyGeometryFromWorkerPayload } from './lilyGeometryWorkerCore'
import { createLilyPortraitCameraBasisAtTime, placeLilyPortraitTargets, type LilyPortraitCameraWorkerSettings } from './portraitIntegration'
import { sampleLilySurfaceForWorker, serializeLilyPortraitTargets, type LilyGeometryWorkerPayload } from './lilyGeometryWorkerClient'
import type { LilySurfaceSource } from './particleSource'
import type { StarPortraitPoint } from './starPortraitTargets'

const cameraSettings: LilyPortraitCameraWorkerSettings = {
  bloomSettings: { cameraTargetX: 0, cameraTargetY: 0, cameraFinalDistance: 6, cameraFinalHeight: 2 },
  identitySettings: { cameraPullback: 1, cameraRise: 0.5, cameraMoveDuration: 8 },
  aspect: 1.5,
  reducedMotion: true,
}

const particleSettings = {
  particleBrightness: 1.2,
  vortexRadius: 1,
  vortexExpansion: 0.45,
  swirlSpeed: 1.4,
  swirlAcceleration: 0.1,
  centerDissolveAt: 0.5,
  vortexSpeedMultiplier: 0.9,
  portraitSteering: 1,
  portraitBraking: 1,
  portraitSettledBrightness: 1.15,
}

const captureSettings = {
  portraitStartProgress: 0.3,
  portraitFraction: 0.2,
  portraitMinTurns: 0,
  portraitMaxTurns: 2,
  portraitSteering: 1,
  portraitBraking: 1,
  portraitSettledBrightness: 1.15,
  vortexSpeedMultiplier: 0.9,
}

const placementSettings = { scale: 1, offsetX: 0, offsetY: 0 }

function point(index: number): StarPortraitPoint {
  const f32 = Math.fround
  const types = ['fill', 'contour', 'flow', 'support'] as const
  return {
    u: f32(0.18 + (index % 6) * 0.12),
    v: f32(0.14 + Math.floor(index / 6) * 0.16),
    tone: f32(0.2 + (index % 5) * 0.12),
    contrast: f32(0.25 + (index % 4) * 0.17),
    featureWeight: f32(0.15 + (index % 7) * 0.1),
    seed: f32((index + 0.5) / 24),
    photoColorLinear: [f32(0.1 + index / 100), f32(0.2 + index / 120), f32(0.3 + index / 140)],
    artSize: f32(0.8 + (index % 5) * 0.1),
    artBrightness: f32(0.9 + (index % 4) * 0.2),
    type: types[index % types.length]!,
  }
}

function sourceSample(index: number) {
  return {
    position: [Math.sin(index * 0.1) * 0.2, (index % 17) * 0.03 - 0.2, Math.cos(index * 0.08) * 0.15] as [number, number, number],
    part: index % 3,
  }
}

describe('Lily geometry worker core', () => {
  it('produces the same particle attributes as the synchronous builder from equivalent sampled inputs', async () => {
    const count = 1000
    const source: LilySurfaceSource = {
      center: [0, 0, 0], radius: 1, minY: -0.5, maxY: 1,
      sampleSurface: (index) => sourceSample(index),
      sample: (index) => sourceSample(index).position,
    }
    const targets = Array.from({ length: 24 }, (_, index) => point(index))
    const cameraBasisAtTime = createLilyPortraitCameraBasisAtTime(cameraSettings)
    const targetPositions = placeLilyPortraitTargets(targets, 4 / 3,
      cameraBasisAtTime(cameraSettings.identitySettings.cameraMoveDuration), placementSettings)
    const sampledSource = await sampleLilySurfaceForWorker(source, count, async () => undefined)
    const packedTargets = await serializeLilyPortraitTargets(targets, async () => undefined)
    const payload: LilyGeometryWorkerPayload = {
      count,
      source: sampledSource,
      portrait: {
        targetValues: packedTargets.values,
        targetTypes: packedTargets.types,
        width: 4,
        height: 3,
        appearanceSettings: placementSettings,
        start: 2,
        duration: 8,
        dissolveDuration: 12,
        edgeWidth: 0.035,
        settings: particleSettings,
        capture: captureSettings,
      },
      cameraSettings,
    }
    const expected = createLilyParticleGeometry(source, count, {
      targets,
      targetPositions,
      cameraBasisAtTime,
      start: 2,
      duration: 8,
      dissolveDuration: 12,
      edgeWidth: 0.035,
      settings: particleSettings,
      capture: captureSettings,
    })
    const actual = buildLilyGeometryFromWorkerPayload(payload)

    expect(actual.getAttribute('aPortraitRoute').array.some((value) => value > 0.5)).toBe(true)
    expect(Object.keys(actual.attributes).sort()).toEqual(Object.keys(expected.attributes).sort())
    for (const [name, attribute] of Object.entries(expected.attributes)) {
      expect(Array.from(actual.getAttribute(name).array)).toEqual(Array.from(attribute.array))
    }
    actual.dispose()
    expected.dispose()
  })
})
