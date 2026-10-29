import { TIMING } from '../../engine/filmConfig'
import type { CameraPose } from '../shared/galleryMotion'

export type SeedStage = 'forming' | 'falling' | 'landed' | 'handoff' | 'growth'
export const SEED_ROOT = [0, -1.45, 0] as const

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
export function getSeedPose(time: number, viewportHeight: number, reducedMotion: boolean): SeedPose {
  const { formation, fall, landing, handoff } = TIMING.growth
  const forming = progress(time, formation)
  // Ballistic descent: velocity keeps increasing right up to contact, never eases to a stop.
  const fallTime = clamp01((time - fall[0]) / (fall[1] - fall[0]))
  const falling = fallTime * fallTime
  const transfer = progress(time, handoff)
  const lightTransfer = progress(time, [0, 1.15])
  const sproutStart = transfer * 0.065
  const growthWeight = sproutStart + 0.935 * progress(time, [handoff[1], TIMING.growth.sprout[1]])
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
    seedSize: Math.max(0.001, viewportHeight * (0.004 + 0.061 * forming)),
    seedOpacity: 1 - progress(time, [landing[0], landing[0] + 0.12]),
    ringOpacity: progress(time, [0.5, 1.8]) * (0.36 + 0.24 * progress(time, fall)),
    sparkOpacity: reducedMotion || time < landing[0] ? 0 : 1 - progress(time, [landing[0] + 0.08, landing[0] + 0.85]),
    mound: progress(time, [landing[0], landing[0] + 0.28]),
    moonlight: progress(time, TIMING.growth.moonlight),
  }
}

/** Delayed pursuit preserves downward screen motion; returns to the existing bloom framing. */
export function getGrowthCameraPose(time: number, reducedMotion: boolean): CameraPose {
  const follow = reducedMotion ? 0 : progress(time, [TIMING.growth.fall[0] + 0.32, TIMING.growth.landing[1]])
  const settle = reducedMotion ? 0 : progress(time, [TIMING.growth.handoff[1], TIMING.growth.duration])
  return {
    x: 0, y: -0.42 * follow * (1 - settle) + 0.2 * settle, z: 5.6,
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
export function getGrowthHandoff(time: number, viewportHeight = 1, reducedMotion = false): GrowthHandoff {
  const pose = getSeedPose(time, viewportHeight, reducedMotion)
  return { anchor: pose.anchor, stage: pose.stage, localTime: pose.growthTime, weight: pose.growthWeight }
}

/** Fixed GPU seeds [index, radial variation, birth/color variation]; low quality uses a prefix. */
export function sampleSeedParticleSeeds(count: number): Float32Array {
  return Float32Array.from(Array.from({ length: count }, (_, i) => [i, ((i * 73 + 19) % 127) / 127, ((i * 41 + 7) % 113) / 113]).flat())
}
