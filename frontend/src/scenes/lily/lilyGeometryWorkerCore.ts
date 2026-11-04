import { createLilyParticleGeometry, type LilyVisiblePortraitGeometryOptions } from './dissolve'
import { createLilyPortraitCameraBasisAtTime, placeLilyPortraitTargets } from './portraitIntegration'
import type { LilyGeometryWorkerPayload } from './lilyGeometryWorkerClient'
import type { LilySurfaceSource } from './particleSource'
import type { StarPortraitPoint } from './starPortraitTargets'

const PORTRAIT_TARGET_FLOATS = 11
const PORTRAIT_TARGET_TYPES = ['fill', 'contour', 'flow', 'support'] as const

/** Rebuild the worker's compact transferred inputs before running the shared geometry builder. */
export function buildLilyGeometryFromWorkerPayload(payload: LilyGeometryWorkerPayload) {
  const { source: sampled, count, portrait: portraitData, cameraSettings } = payload
  const source: LilySurfaceSource = {
    center: sampled.center,
    radius: sampled.radius,
    minY: sampled.minY,
    maxY: sampled.maxY,
    sampleSurface(index) {
      const offset = index * 3
      return {
        position: [sampled.positions[offset]!, sampled.positions[offset + 1]!, sampled.positions[offset + 2]!] as [number, number, number],
        part: sampled.parts[index]!,
      }
    },
    sample(index) {
      const offset = index * 3
      return [sampled.positions[offset]!, sampled.positions[offset + 1]!, sampled.positions[offset + 2]!] as [number, number, number]
    },
  }

  const targetCount = portraitData.targetTypes.length
  if (portraitData.targetValues.length !== targetCount * PORTRAIT_TARGET_FLOATS) {
    throw new Error('Scene 04 portrait target data is invalid')
  }
  const targets: StarPortraitPoint[] = Array.from({ length: targetCount }, (_, index) => {
    const offset = index * PORTRAIT_TARGET_FLOATS
    return {
      u: portraitData.targetValues[offset]!,
      v: portraitData.targetValues[offset + 1]!,
      tone: portraitData.targetValues[offset + 2]!,
      contrast: portraitData.targetValues[offset + 3]!,
      featureWeight: portraitData.targetValues[offset + 4]!,
      seed: portraitData.targetValues[offset + 5]!,
      photoColorLinear: [portraitData.targetValues[offset + 6]!, portraitData.targetValues[offset + 7]!, portraitData.targetValues[offset + 8]!],
      artSize: portraitData.targetValues[offset + 9]!,
      artBrightness: portraitData.targetValues[offset + 10]!,
      type: PORTRAIT_TARGET_TYPES[portraitData.targetTypes[index]!] ?? 'fill',
    }
  })

  const cameraBasisAtTime = createLilyPortraitCameraBasisAtTime(cameraSettings)
  const portraitBasis = cameraBasisAtTime(cameraSettings.identitySettings.cameraMoveDuration)
  const targetPositions = placeLilyPortraitTargets(targets, portraitData.width / portraitData.height, portraitBasis, portraitData.appearanceSettings)
  const geometryOptions: LilyVisiblePortraitGeometryOptions = {
    targets,
    targetPositions,
    start: portraitData.start,
    duration: portraitData.duration,
    dissolveDuration: portraitData.dissolveDuration,
    edgeWidth: portraitData.edgeWidth,
    settings: portraitData.settings,
    capture: portraitData.capture,
    cameraBasisAtTime,
  }
  return createLilyParticleGeometry(source, count, geometryOptions)
}
