import type { SceneComposerConfig } from '../../systems/scene-config/config'

type Settings = SceneComposerConfig['scenes']['galaxy']
export type GalaxyAnimationScene = 'cosmos' | 'greeting' | 'ending'

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
