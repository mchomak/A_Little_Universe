import type { SceneComposerConfig } from '../../systems/scene-config/config'
import { Quaternion, Vector3 } from 'three'
import { getPlanetariumHandoffProgress } from './camera'

type Settings = SceneComposerConfig['scenes']['galaxy']
export type GalaxyAnimationScene = 'cosmos' | 'greeting' | 'ending'

export interface GalaxyBoundaryFrame {
  valid: boolean
  motionTime: number
  phaseTime: number
  light: number
  fogOpacity: number
  reveal: number
  firstStars: number
  position: Vector3
  rotation: Quaternion
}

export interface GalaxyFrameValues {
  motionTime: number
  phaseTime: number
  light: number
  fogOpacity: number
  reveal: number
  firstStars: number
  boundaryProgress: number
  diskBrightness: number
  brightBrightness: number
  gasReveal: number
  coreBrightness: number
}

export interface GalaxyFrameOptions {
  boundary?: GalaxyBoundaryFrame
  reducedMotion?: boolean
  revealTimeOffset?: number
  boundaryTransitionDuration?: number
  motionTime?: number
  phaseTime?: number
  transitionOpacity?: number
}

/** Resolve the material inputs once so the persistent galaxy can hand off between scene clocks. */
export function getGalaxyFrameValues(
  scene: GalaxyAnimationScene,
  time: number,
  settings: Settings,
  cosmosDuration: number,
  greetingDuration: number,
  options: GalaxyFrameOptions = {},
): GalaxyFrameValues {
  const revealTime = time + (options.revealTimeOffset ?? 0)
  const revealState = getGalaxyRevealState(revealTime, settings)
  const reveal = scene === 'cosmos' ? revealState.galaxy : 1
  const firstStars = scene === 'cosmos' ? revealState.stars : 1
  const calculatedPhaseTime = scene === 'cosmos' ? time
    : scene === 'greeting' ? cosmosDuration + time
      : cosmosDuration + greetingDuration + time
  const calculatedPhase = options.phaseTime ?? calculatedPhaseTime
  const calculatedMotion = options.motionTime ?? getGalaxyMotionPhase(
    scene, time, settings, cosmosDuration, greetingDuration, options.reducedMotion,
  )
  const boundary = options.boundary
  const boundaryProgress = scene === 'greeting' && boundary?.valid
    ? getPlanetariumHandoffProgress(time / (options.boundaryTransitionDuration ?? 0.7)) : 1
  const blend = (from: number, to: number) => from + (to - from) * boundaryProgress
  const transitionOpacity = options.transitionOpacity ?? 1
  const motionTime = scene === 'greeting' && boundary?.valid ? blend(boundary.motionTime, calculatedMotion) : calculatedMotion
  const phaseTime = scene === 'greeting' && boundary?.valid ? blend(boundary.phaseTime, calculatedPhase) : calculatedPhase
  const light = (scene === 'greeting' && boundary?.valid
    ? blend(boundary.light, getGalaxyLight(scene, time, settings, cosmosDuration))
    : getGalaxyLight(scene, time, settings, cosmosDuration)) * transitionOpacity
  const fogOpacity = (scene === 'greeting' && boundary?.valid
    ? blend(boundary.fogOpacity, getGalaxyFogOpacity(scene, time, settings, cosmosDuration))
    : getGalaxyFogOpacity(scene, time, settings, cosmosDuration)) * transitionOpacity
  const visibleReveal = scene === 'greeting' && boundary?.valid ? blend(boundary.reveal, reveal) : reveal
  const visibleStars = scene === 'greeting' && boundary?.valid ? blend(boundary.firstStars, firstStars) : firstStars

  return {
    motionTime,
    phaseTime,
    light,
    fogOpacity,
    reveal: visibleReveal,
    firstStars: visibleStars,
    boundaryProgress,
    diskBrightness: settings.brightness * settings.exposure * light,
    brightBrightness: settings.brightStarIntensity * settings.exposure * light,
    gasReveal: settings.nebulaEnabled ? Math.max(visibleReveal, visibleStars * 0.14) : 0,
    coreBrightness: settings.exposure * light,
  }
}

export function captureGalaxyBoundaryFrame(
  boundary: GalaxyBoundaryFrame,
  frame: GalaxyFrameValues,
  position: Vector3,
  rotation: Quaternion,
) {
  boundary.motionTime = frame.motionTime
  boundary.phaseTime = frame.phaseTime
  boundary.light = frame.light
  boundary.fogOpacity = frame.fogOpacity
  boundary.reveal = frame.reveal
  boundary.firstStars = frame.firstStars
  boundary.position.copy(position)
  boundary.rotation.copy(rotation)
  boundary.valid = true
}

export function applyGalaxyBoundaryTransform(
  boundary: GalaxyBoundaryFrame,
  origin: Vector3,
  identityRotation: Quaternion,
  progress: number,
  position: Vector3,
  rotation: Quaternion,
) {
  const p = Math.max(0, Math.min(1, progress))
  position.copy(boundary.position).lerp(origin, p)
  rotation.copy(boundary.rotation).slerp(identityRotation, p)
}

function smooth(start: number, end: number, time: number) {
  const x = Math.max(0, Math.min(1, (time - start) / Math.max(0.001, end - start)))
  return x * x * (3 - 2 * x)
}

export function getGalaxyRevealState(time: number, settings: Settings) {
  const galaxy = smooth(settings.galaxyRevealAt, settings.galaxyRevealAt + settings.revealDuration, time)
  const stars = smooth(settings.firstStarsAt, settings.firstStarsAt + 1.25, time)
  const fogDissipation = smooth(settings.fogStart, settings.fogEnd, time)
  const settleStart = settings.galaxyRevealAt + settings.revealDuration + settings.pauseDuration
  const background = smooth(settleStart, settleStart + settings.backgroundTransition, time)
  return { galaxy, stars, fogDissipation, background, settleStart }
}

/** Preserve the configured residual haze through the reveal, then fade it out at the Scene 07 handoff. */
export function getGalaxyFogOpacity(scene: GalaxyAnimationScene, time: number, settings: Settings, cosmosDuration: number) {
  if (scene !== 'cosmos') return 0
  const dissipationProgress = smooth(settings.fogStart, settings.fogEnd, time)
  const residualOpacity = settings.fogDensity * (1 - dissipationProgress * settings.fogDissipation) + settings.fogAfterOpacity
  const handoffFade = smooth(cosmosDuration - settings.backgroundTransition, cosmosDuration, time)
  return residualOpacity * (1 - handoffFade)
}

export function getGalaxyLight(scene: GalaxyAnimationScene, time: number, settings: Settings, cosmosDuration: number) {
  if (scene === 'ending') return 0.52
  if (scene === 'greeting') return 0.76 - 0.24 * smooth(0, settings.backgroundTransition, time)
  const settle = smooth(cosmosDuration - settings.backgroundTransition, cosmosDuration, time)
  return 1 - 0.24 * settle
}

function revealMotionPhase(time: number, settings: Settings, motionSpeed: number) {
  const revealRate = settings.revealMotion * motionSpeed
  const idleRate = settings.idleMotion * motionSpeed
  const { settleStart } = getGalaxyRevealState(time, settings)
  const duration = settings.backgroundTransition
  const afterSettle = time - settleStart
  if (afterSettle <= 0) return Math.max(0, time) * revealRate
  const progress = Math.min(1, afterSettle / duration)
  // Integral of smoothstep(0..1) keeps angular velocity continuous as the scene settles.
  const smoothIntegral = progress ** 3 - 0.5 * progress ** 4
  const transition = duration * (revealRate * (progress - smoothIntegral) + idleRate * smoothIntegral)
  const remainder = Math.max(0, afterSettle - duration) * idleRate
  return settleStart * revealRate + transition + remainder
}

/** A phase accumulator shared at scene boundaries prevents a visible rotation reset. */
export function getGalaxyMotionPhase(
  scene: GalaxyAnimationScene,
  time: number,
  settings: Settings,
  cosmosDuration: number,
  greetingDuration: number,
  reducedMotion = false,
) {
  if (reducedMotion) return 0
  const rate = settings.motionSpeed
  const cosmosEnd = revealMotionPhase(cosmosDuration, settings, rate)
  if (scene === 'cosmos') return revealMotionPhase(time, settings, rate)
  const greetingEnd = cosmosEnd + greetingDuration * settings.idleMotion * rate
  return scene === 'greeting' ? cosmosEnd + time * settings.idleMotion * rate : greetingEnd + time * settings.idleMotion * rate
}

/** Advances the post-reveal motion independently of any finite scene timeline. */
export function advanceGalaxyAmbientPhase(phase: number, shaderTime: number, deltaSeconds: number, settings: Settings, reducedMotion = false) {
  const delta = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(0.05, deltaSeconds)) : 0
  const motionDelta = reducedMotion ? 0 : delta * settings.idleMotion * settings.motionSpeed
  return { motionTime: (Number.isFinite(phase) ? phase : 0) + motionDelta, phaseTime: (Number.isFinite(shaderTime) ? shaderTime : 0) + delta }
}
