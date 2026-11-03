import { getGrowthSceneFrames } from '../../engine/filmConfig'
import type { CameraPose } from '../shared/galleryMotion'
import { DEFAULT_SCENE_COMPOSER_CONFIG, type SceneComposerConfig } from '../../systems/scene-config/config'

export type SeedStage = 'forming' | 'falling' | 'landed' | 'handoff' | 'growth'
export const SEED_ROOT = [0, -1.45, 0] as const
export const SEED_SHELL_HALF_HEIGHT = 0.72
export const SEED_SCREEN_CAMERA_START_FRACTION = 0.62
export const SEED_FOLLOW_START_SCREEN_FRACTION = 0.62
export type GrowthSettings = SceneComposerConfig['scenes']['growth']

export interface GrowthFrames {
  duration: number
  formation: readonly [number, number]
  fall: readonly [number, number]
  islandReveal: readonly [number, number]
  landing: readonly [number, number]
  moonlight: readonly [number, number]
  handoff: readonly [number, number]
  sprout: readonly [number, number]
  stem: readonly [number, number]
  settle: readonly [number, number]
  model: readonly [number, number]
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

/** The seed begins 62% of the viewport above the fixed soil anchor. */
export function getSeedFallDistance(viewportHeight: number): number {
  const height = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0
  return Math.max(Math.abs(SEED_ROOT[1]), height * SEED_SCREEN_CAMERA_START_FRACTION)
}

/** Shortens only the fall distance under reduced motion so the fixed camera still frames seed and soil. */
export function getSeedFallHeightMultiplier(configuredHeight: number, reducedMotion: boolean): number {
  const height = Number.isFinite(configuredHeight) ? Math.min(6.4, Math.max(2, configuredHeight)) : 3.2
  return reducedMotion ? Math.min(1, height) : height
}

/** Monotonic acceleration keeps the seed moving until impact instead of easing to a hover. */
export function getSeedFallProgress(progress: number, acceleration: number): number {
  const u = clamp01(progress)
  const a = Number.isFinite(acceleration) ? Math.min(5, Math.max(1, acceleration)) : 3.2
  return clamp01(u ** a)
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
  spinAngle: number
  tumbleAngle: number
  wobbleAngle: number
  trailOpacity: number
  impact: number
  growthTime: number
  seedSize: number
  seedOpacity: number
  coreOpacity: number
  coreAfterimage: number
  sparkOpacity: number
  mound: number
  orbitOpacity: number
  impactProgress: number
  impactPulse: number
  impactOpacity: number
  orbitAbsorption: number
  moonlight: number
}

/** Group-local center keeps the shell's exact lower pole touching the soil at landing. */
export function getSeedShellCenterY(pose: Pick<SeedPose, 'seedY' | 'seedSize' | 'fall'>): number {
  return pose.seedY + pose.seedSize * SEED_SHELL_HALF_HEIGHT * pose.fall
}

export function getSeedCorePose(pose: Pick<SeedPose, 'seedY' | 'seedSize' | 'fall' | 'coreAfterimage'>, grassHeight: number) {
  const afterimage = clamp01(pose.coreAfterimage)
  const shellCenter = getSeedShellCenterY(pose)
  const grassClearance = Number.isFinite(grassHeight) ? Math.max(0, grassHeight) + 0.06 : 0.2
  const raisedCenter = Math.max(shellCenter, grassClearance)
  return {
    afterimage,
    positionY: shellCenter + (raisedCenter - shellCenter) * afterimage + afterimage * 0.07,
    scale: pose.seedSize + afterimage * 0.055,
  }
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => {
  const x = clamp01(value)
  return x * x * (3 - 2 * x)
}
const inverseFall = (value: number, acceleration: number) => {
  const target = clamp01(value)
  let low = 0
  let high = 1
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const middle = (low + high) * 0.5
    if (getSeedFallProgress(middle, acceleration) < target) low = middle
    else high = middle
  }
  return (low + high) * 0.5
}
const getSeedSpinProgress = (value: number, acceleration: number) => {
  const u = clamp01(value)
  const a = Number.isFinite(acceleration) ? Math.min(5, Math.max(1, acceleration)) : 3.2
  return 1 - (1 - u ** a) ** 6
}
const progress = (time: number, range: readonly [number, number]) => {
  const [start, end] = range
  return smooth((time - start) / Math.max(0.001, end - start))
}

/** Shared timeline easing for environment overlays that follow the seed's scene-local frames. */
export function getGrowthProgress(time: number, range: readonly [number, number]): number {
  return Number.isFinite(time) ? progress(time, range) : 0
}

/** Keeps the seed fully visible through contact, then fades it as deterministic impact fragments take over. */
export function getSeedShatterOpacity(time: number, impactTime: number, impactLifetime: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1
  const fadeDuration = Math.min(0.18, Math.max(0.08, impactLifetime * 0.2))
  return 1 - getGrowthProgress(time, [impactTime, impactTime + fadeDuration])
}

/** A pure sampled pose: replay, backward seek and viewport updates never depend on history. */
export function getSeedPose(time: number, viewportHeight: number, reducedMotion: boolean, settings: GrowthSettings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth): SeedPose {
  const { formation, fall, landing, handoff, moonlight, sprout } = getGrowthFrames(settings)
  const forming = progress(time, formation)
  // The seed accelerates along the full path and reaches the soil with nonzero velocity.
  const fallTime = clamp01((time - fall[0]) / (fall[1] - fall[0]))
  const falling = getSeedFallProgress(fallTime, settings.seedFallAcceleration)
  const fallDuration = fall[1] - fall[0]
  const fallDistance = getSeedFallDistance(viewportHeight) * getSeedFallHeightMultiplier(settings.seedFallHeight, reducedMotion)
  const spinCarry = 0.24 * fallDuration * (1 - (1 - fallTime) ** 2.2) / 2.2
  const fallSpin = getSeedSpinProgress(fallTime, settings.seedFallAcceleration)
  const spinAngle = reducedMotion ? 0 : time <= fall[0] ? time * 0.24
    : fall[0] * 0.24 + spinCarry + settings.seedSpinSpeed * fallDuration * fallSpin
  const tumbleAngle = reducedMotion ? 0 : settings.seedTumbleSpeed * fallDuration * fallSpin
  const wobbleAmplitude = 0.035 + (settings.seedWobbleAmplitude - 0.035) * smooth(fallTime / 0.12)
  const wobbleAngle = reducedMotion ? 0 : Math.sin(time * 1.8) * wobbleAmplitude * (1 - falling)
  const transfer = progress(time, handoff)
  const lightTransfer = progress(time, [0, 1.15])
  const impactAge = time - fall[1]
  const impactProgress = clamp01(impactAge / Math.max(0.1, settings.seedImpactLifetime))
  const impactPulse = reducedMotion || impactAge < 0 ? 0
    : progress(impactAge, [0, 0.06]) * (1 - progress(impactAge, [0.12, settings.seedImpactLifetime]))
  const impactOpacity = impactPulse * settings.seedImpactStrength
  const seedSettle = progress(time, [fall[1], handoff[0] + 0.15])
  const seedSize = Math.max(0.001, viewportHeight * (0.004 + 0.061 * forming) * settings.seedScale * (1 - 0.64 * seedSettle))
  const seedOpacity = 1 - progress(time, [handoff[0] - 0.12, handoff[1]])
  const coreAfterimage = progress(time, [handoff[0] + 0.15, handoff[1]])
    * (1 - progress(time, [handoff[1], handoff[1] + 1.1]))
  const coreOpacity = lightTransfer * Math.max(seedOpacity, 0.36 * coreAfterimage)
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
    seedY: fallDistance * (1 - falling),
    spinAngle,
    tumbleAngle,
    wobbleAngle,
    trailOpacity: reducedMotion ? 0 : progress(time, [fall[0], fall[0] + 0.25]) * (1 - progress(time, [landing[0], landing[0] + 0.35])) * 0.75 * settings.seedTrailIntensity,
    impact: reducedMotion ? 1 : clamp01((time - landing[0]) / (landing[1] - landing[0])),
    growthTime: Math.max(0, time - handoff[0]),
    anchor: SEED_ROOT,
    seedSize,
    seedOpacity,
    coreOpacity,
    coreAfterimage,
    sparkOpacity: reducedMotion || time < landing[0] ? 0 : 1 - progress(time, [landing[0] + settings.seedImpactLifetime * 0.08, landing[0] + settings.seedImpactLifetime]),
    mound: impactOpacity,
    orbitOpacity: forming * (1 - progress(time, [fall[0] + 0.08, fall[0] + 0.48])) * (1 - progress(time, [landing[0], landing[0] + 0.16])),
    impactProgress,
    impactPulse,
    impactOpacity,
    orbitAbsorption: progress(time, [formation[0] + (formation[1] - formation[0]) * 0.38, formation[0] + (formation[1] - formation[0]) * 0.96]),
    moonlight: progress(time, moonlight),
  }
}

/** Delayed pursuit holds the seed at its opening screen position before tracking toward the fixed soil. */
export function getGrowthCameraPose(time: number, reducedMotion: boolean, settings: GrowthSettings = DEFAULT_SCENE_COMPOSER_CONFIG.scenes.growth, viewportHeight = getGrowthViewportHeight(1024, 768)): CameraPose {
  if (reducedMotion) return { x: 0, y: -0.2, z: 7.8, tx: 0, ty: -0.2, tz: 0 }
  const frames = getGrowthFrames(settings)
  const fallDistance = getSeedFallDistance(viewportHeight) * settings.seedFallHeight
  const startY = SEED_ROOT[1] + fallDistance
  const fallDuration = frames.fall[1] - frames.fall[0]
  const desiredScreenY = SEED_FOLLOW_START_SCREEN_FRACTION
  const initialDrop = Math.max(0, desiredScreenY - 0.5) * viewportHeight
  const thresholdProgress = inverseFall(initialDrop / fallDistance, settings.seedFallAcceleration)
  const thresholdTime = frames.fall[0] + thresholdProgress * fallDuration
  const trackingTime = time - settings.seedCameraLag
  const baselineProgress = clamp01((thresholdTime - settings.seedCameraLag - frames.fall[0]) / fallDuration)
  const baselineDrop = fallDistance * getSeedFallProgress(baselineProgress, settings.seedFallAcceleration)
  const trackingProgress = clamp01((trackingTime - frames.fall[0]) / fallDuration)
  const trackingDrop = fallDistance * getSeedFallProgress(trackingProgress, settings.seedFallAcceleration)
  const remainingDrop = Math.max(0.001, fallDistance - baselineDrop)
  const pathFollow = time < thresholdTime ? 0 : smooth((trackingDrop - baselineDrop) / remainingDrop)
  const response = 1 - Math.exp(-settings.seedCameraFollowSpeed * Math.max(0, time - thresholdTime))
  const follow = pathFollow * response
  const settle = progress(time, [frames.handoff[1], frames.duration])
  const parallax = Math.sin(Math.max(0, trackingTime) * 0.72) * 0.025 * follow * (1 - settle)
  const followY = startY + (SEED_ROOT[1] + 0.25 - startY) * follow
  const followTargetY = startY + (SEED_ROOT[1] - 0.1 - startY) * follow
  const y = followY + (-0.02 - followY) * settle
  const ty = followTargetY + (-0.12 - followTargetY) * settle
  const followZ = 5.6 + 1.4 * follow
  return {
    x: parallax, y,
    z: followZ + (7.8 - followZ) * settle,
    tx: parallax * 0.35, ty, tz: 0,
  }
}

/** The same endpoint is used to enter Bloom, so both scenes share an identical camera pose. */
export function getGrowthBloomEntryCameraPose(settings: GrowthSettings, reducedMotion: boolean, viewportHeight = getGrowthViewportHeight(1024, 768)): CameraPose {
  return getGrowthCameraPose(getGrowthFrames(settings).duration, reducedMotion, settings, viewportHeight)
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
