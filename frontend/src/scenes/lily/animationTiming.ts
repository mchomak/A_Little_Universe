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

export function getIdleClosedClipTime(presentationTime: number, clipDuration: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : getLoopingClipTime(presentationTime, clipDuration)
}

export function getLoopingClipTime(presentationTime: number, clipDuration: number): number {
  if (!Number.isFinite(presentationTime) || !Number.isFinite(clipDuration) || clipDuration <= 0) return 0
  return ((presentationTime % clipDuration) + clipDuration) % clipDuration
}
