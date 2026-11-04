import type { GrowthSceneFrames } from '../../engine/filmConfig'

export function getMappedClipTime(time: number, sceneRange: readonly [number, number], clipDuration: number): number {
  const duration = Math.max(0.001, sceneRange[1] - sceneRange[0])
  const progress = Math.min(1, Math.max(0, (time - sceneRange[0]) / duration))
  return progress * Math.max(0, clipDuration)
}

/** Keeps the fixed seed-to-sprout handoff at the same clip time as the remaining stem-growth duration is retimed. */
export function getGrowthClipTime(time: number, frames: Pick<GrowthSceneFrames, 'handoff' | 'model'>, clipDuration: number): number {
  const duration = Number.isFinite(clipDuration) ? Math.max(0, clipDuration) : 0
  const handoffSceneDuration = Math.max(0.001, frames.handoff[1] - frames.handoff[0])
  const handoffClipDuration = Math.min(duration, handoffSceneDuration)
  if (time <= frames.handoff[0]) return 0
  if (time <= frames.handoff[1]) {
    return ((time - frames.handoff[0]) / handoffSceneDuration) * handoffClipDuration
  }
  const growthDuration = Math.max(0.001, frames.model[1] - frames.handoff[1])
  const progress = Math.min(1, Math.max(0, (time - frames.handoff[1]) / growthDuration))
  return handoffClipDuration + progress * (duration - handoffClipDuration)
}

export function getBloomClipTime(time: number, sceneRange: readonly [number, number], clipDuration: number, reducedMotion: boolean): number {
  return reducedMotion ? Math.max(0, Number.isFinite(clipDuration) ? clipDuration : 0) : getMappedClipTime(time, sceneRange, clipDuration)
}

/** Bounds the camera move so it always reaches its close-up before the bloom clip finishes. */
export function getBloomCameraApproachDuration(approachDuration: number, openingRange: readonly [number, number]): number {
  const openingDuration = Math.max(0.001, openingRange[1] - openingRange[0])
  const requested = Number.isFinite(approachDuration) ? approachDuration : openingDuration * 0.67
  return Math.min(openingDuration * 0.95, Math.max(0.1, requested))
}

/** Maps the flower so it is `syncFraction` open when the CameraDirector reaches its close-up. */
export function getSyncedBloomClipTime(
  time: number,
  sceneRange: readonly [number, number],
  clipDuration: number,
  reducedMotion: boolean,
  approachDuration: number,
  syncFraction: number,
): number {
  const duration = Math.max(0.001, sceneRange[1] - sceneRange[0])
  const clipEnd = Math.max(0, Number.isFinite(clipDuration) ? clipDuration : 0)
  if (reducedMotion) return clipEnd
  const approach = getBloomCameraApproachDuration(approachDuration, sceneRange)
  const sync = Math.min(0.85, Math.max(0.5, Number.isFinite(syncFraction) ? syncFraction : 0.67))
  const elapsed = Math.min(duration, Math.max(0, time - sceneRange[0]))
  const clipTime = elapsed <= approach
    ? (elapsed / approach) * sync * clipEnd
    : sync * clipEnd + ((elapsed - approach) / Math.max(0.001, duration - approach)) * (1 - sync) * clipEnd
  return Math.min(clipEnd, Math.max(0, clipTime))
}
