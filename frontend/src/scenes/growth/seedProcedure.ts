import { TIMING } from '../../engine/filmConfig'

export type SeedStage = 'forming' | 'falling' | 'landed' | 'handoff' | 'growth'
export type SeedQuality = 'low' | 'standard'
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
  pulseOpacity: number
  pulseScale: number
  growthTime: number
  seedSize: number
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
  const falling = progress(time, fall)
  const transfer = progress(time, handoff)
  const lightTransfer = progress(time, [0, 1.15])
  const sproutStart = transfer * 0.065
  const growthWeight = sproutStart + 0.935 * progress(time, [handoff[1], TIMING.growth.sprout[1]])
  const inLanding = time >= landing[0] && time < landing[1]
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
    trailOpacity: reducedMotion || time < fall[0] || time >= landing[0] ? 0 : (1 - progress(time, [fall[1] - 0.2, landing[0]])) * 0.16,
    pulseOpacity: reducedMotion || !inLanding ? 0 : Math.sin(Math.PI * progress(time, landing)) * 0.13,
    pulseScale: 0.65 + progress(time, landing) * 0.45,
    growthTime: Math.max(0, time - handoff[0]),
    anchor: SEED_ROOT,
    seedSize: Math.max(0.001, viewportHeight * 0.01),
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

export interface SeedParticle { x: number; y: number; z: number; pink: boolean }

/** Fixed, symmetric samples; a shorter prefix is used at low quality. */
export function sampleSeedParticles(count = 22, quality: SeedQuality = 'standard'): SeedParticle[] {
  const amount = quality === 'low' ? Math.max(4, Math.ceil(count / 3)) : count
  return Array.from({ length: amount }, (_, index) => {
    const along = (index + 0.5) / amount
    const angle = index * 2.399963229728653
    const fullness = Math.sin(Math.PI * along) ** 0.55
    return {
      x: Math.sin(angle) * 0.36 * fullness,
      y: (along * 2 - 1) * 0.84 + Math.sin(angle * 0.5) * 0.04,
      z: Math.cos(angle) * 0.25 * fullness,
      pink: index % 4 === 1,
    }
  })
}
