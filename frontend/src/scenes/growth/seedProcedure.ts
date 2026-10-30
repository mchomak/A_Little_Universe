import { getGrowthSceneFrames } from '../../engine/filmConfig'
import type { CameraPose } from '../shared/galleryMotion'
import { DEFAULT_SCENE_COMPOSER_CONFIG, type SceneComposerConfig } from '../../systems/scene-config/config'

export type SeedStage = 'forming' | 'falling' | 'landed' | 'handoff' | 'growth'
export const SEED_ROOT = [0, -1.45, 0] as const
export type GrowthSettings = SceneComposerConfig['scenes']['growth']

export interface GrowthFrames {
  duration: number
  formation: readonly [number, number]
  fall: readonly [number, number]
  landing: readonly [number, number]
  moonlight: readonly [number, number]
  handoff: readonly [number, number]
  sprout: readonly [number, number]
  stem: readonly [number, number]
  settle: readonly [number, number]
}

/** Formation edits remain inside scene 02 and the fall always waits for completion. */
export function getGrowthFrames(settings: GrowthSettings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth): GrowthFrames {
  return getGrowthSceneFrames(settings)
}

export function getSeedParticleCount(deviceQuality: 'standard' | 'low', quality: GrowthSettings['particleQuality']): number {
  if (deviceQuality === 'low' || quality === 'low') return 2304
  return quality === 'high' ? 9216 : 4096
}

/** Front camera framing while the seed is on screen; mirrors CameraDirector's fit/fov. */
export function getGrowthViewportHeight(width: number, height: number): number {
  const aspect = width / Math.max(1, height)
  const fit = aspect < 1 ? Math.min(2.5, 1 / Math.max(0.3, aspect)) : 1
  const distance = 5.6 * fit
  const fov = aspect < 1 ? 42 : 38
  return 2 * distance * Math.tan(fov * Math.PI / 360)
}

export interface SeedPose {
  anchor: typeof SEED_ROOT
  stage: SeedStage
  formation: number
  fall: number
  handoff: number
  lightTransfer: number
  growthWeight: number
  seedY: number
  trailOpacity: number
  impact: number
  growthTime: number
  seedSize: number
  seedOpacity: number
  ringOpacity: number
  sparkOpacity: number
  mound: number
  moonlight: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => {
  const x = clamp01(value)
  return x * x * (3 - 2 * x)
}
const progress = (time: number, range: readonly [number, number]) => {
  const [start, end] = range
  return smooth((time - start) / Math.max(0.001, end - start))
}

/** A pure sampled pose: replay, backward seek and viewport updates never depend on history. */
export function getSeedPose(time: number, viewportHeight: number, reducedMotion: boolean, settings: GrowthSettings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth): SeedPose {
  const { formation, fall, landing, handoff, moonlight, sprout } = getGrowthFrames(settings)
  const forming = progress(time, formation)
  // Ballistic descent: velocity keeps increasing right up to contact, never eases to a stop.
  const fallTime = clamp01((time - fall[0]) / (fall[1] - fall[0]))
  const falling = fallTime * fallTime
  const transfer = progress(time, handoff)
  const lightTransfer = progress(time, [0, 1.15])
  const sproutStart = transfer * 0.065
  const growthWeight = sproutStart + 0.935 * progress(time, [handoff[1], sprout[1]])
  const stage: SeedStage = time < formation[1] ? 'forming'
    : time < fall[1] ? 'falling'
      : time < handoff[0] ? 'landed'
        : time < handoff[1] ? 'handoff' : 'growth'

  // The root stays fixed. Seed-local +Y starts at screen centre and settles at the plant base.
  return {
    stage,
    formation: forming,
    fall: falling,
    handoff: transfer,
    lightTransfer,
    growthWeight,
    seedY: 1.45 * (1 - falling),
    trailOpacity: reducedMotion ? 0 : progress(time, [fall[0], fall[0] + 0.25]) * (1 - progress(time, [landing[0], landing[0] + 0.35])) * 0.75,
    impact: reducedMotion ? 1 : clamp01((time - landing[0]) / (landing[1] - landing[0])),
    growthTime: Math.max(0, time - handoff[0]),
    anchor: SEED_ROOT,
    seedSize: Math.max(0.001, viewportHeight * (0.004 + 0.061 * forming) * settings.seedScale),
    seedOpacity: 1 - progress(time, [landing[0], landing[0] + 0.12]),
    ringOpacity: progress(time, [0.5, 1.8]) * (0.36 + 0.24 * progress(time, fall)),
    sparkOpacity: reducedMotion || time < landing[0] ? 0 : 1 - progress(time, [landing[0] + 0.08, landing[0] + 0.85]),
    mound: progress(time, [landing[0], landing[0] + 0.28]),
    moonlight: progress(time, moonlight),
  }
}

/** Delayed pursuit preserves downward screen motion; returns to the existing bloom framing. */
export function getGrowthCameraPose(time: number, reducedMotion: boolean, settings: GrowthSettings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth): CameraPose {
  const frames = getGrowthFrames(settings)
  const follow = reducedMotion ? 0 : progress(time, [frames.fall[0] + 0.32, frames.landing[1]])
  const settle = reducedMotion ? 0 : progress(time, [frames.handoff[1], frames.duration])
  return {
    x: 0, y: -0.42 * follow * (1 - settle) + 0.2 * settle, z: 5.6 + 0.6 * settle,
    tx: 0, ty: -0.42 * follow * (1 - settle) + 0.1 * settle, tz: 0,
  }
}

export interface GrowthHandoff {
  anchor: typeof SEED_ROOT
  stage: SeedStage
  localTime: number
  weight: number
}

/** Stable scene-local contract for a future model adapter; no GLB assumptions are encoded here. */
export function getGrowthHandoff(time: number, viewportHeight = 1, reducedMotion = false, settings: GrowthSettings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth): GrowthHandoff {
  const pose = getSeedPose(time, viewportHeight, reducedMotion, settings)
  return { anchor: pose.anchor, stage: pose.stage, localTime: pose.growthTime, weight: pose.growthWeight }
}

/** Fixed GPU seeds [index, radial variation, birth/color variation]; low quality uses a prefix. */
export function sampleSeedParticleSeeds(count: number): Float32Array {
  return Float32Array.from(Array.from({ length: count }, (_, i) => [i, ((i * 73 + 19) % 127) / 127, ((i * 41 + 7) % 113) / 113]).flat())
}
