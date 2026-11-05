import { TIMING } from '../../engine/filmConfig'
import type { SceneComposerConfig } from '../../systems/scene-config/config'

type IdentitySettings = SceneComposerConfig['scenes']['identity']

export const SCENE04_PHOTO_PAUSE_SECONDS = 0.65
export const SCENE04_PHOTO_REVEAL_SECONDS = 5.8
export const SCENE04_FRAME_ASSEMBLY_SECONDS = 3
export const SCENE04_FINAL_HOLD_SECONDS = 2
export const SCENE04_CAMERA_PULLBACK_DISTANCE = 1.7
export const SCENE04_CAMERA_PULLBACK_SECONDS = 4

export interface Scene04Timeline {
  portraitStart: number
  portraitDuration: number
  portraitComplete: number
  photoStart: number
  photoRevealDuration: number
  photoComplete: number
  frameStart: number
  frameComplete: number
  cameraPullbackStart: number
  cameraPullbackDuration: number
  cameraPullbackComplete: number
  cameraPullbackDistance: number
}

/**
 * Lines up the new photo and frame beats with the actual configured portrait
 * landing time. All frames are sampled from absolute scene time for replay and
 * scrubbing.
 */
export function getScene04Timeline(settings: IdentitySettings): Scene04Timeline {
  const latestCameraStart = TIMING.identity.duration - SCENE04_CAMERA_PULLBACK_SECONDS
    - SCENE04_PHOTO_PAUSE_SECONDS - SCENE04_PHOTO_REVEAL_SECONDS - SCENE04_FRAME_ASSEMBLY_SECONDS - SCENE04_FINAL_HOLD_SECONDS
  const maxPortraitStart = latestCameraStart - 2
  const requestedPortraitStart = settings.portraitStartProgress * settings.dissolveDuration
  // Keep the configured two-second minimum even for extreme DEV settings.
  const portraitStart = Math.min(requestedPortraitStart, maxPortraitStart)
  const portraitDuration = Math.min(settings.portraitDuration, Math.max(2, latestCameraStart - portraitStart))
  const portraitComplete = portraitStart + portraitDuration
  const cameraPullbackStart = Math.max(settings.cameraMoveDuration, portraitComplete)
  const cameraPullbackComplete = cameraPullbackStart + SCENE04_CAMERA_PULLBACK_SECONDS
  const photoStart = cameraPullbackComplete + SCENE04_PHOTO_PAUSE_SECONDS
  const photoComplete = photoStart + SCENE04_PHOTO_REVEAL_SECONDS
  const frameStart = photoComplete

  return {
    portraitStart,
    portraitDuration,
    portraitComplete,
    photoStart,
    photoRevealDuration: SCENE04_PHOTO_REVEAL_SECONDS,
    photoComplete,
    frameStart,
    frameComplete: frameStart + SCENE04_FRAME_ASSEMBLY_SECONDS,
    cameraPullbackStart,
    cameraPullbackDuration: SCENE04_CAMERA_PULLBACK_SECONDS,
    cameraPullbackComplete,
    cameraPullbackDistance: SCENE04_CAMERA_PULLBACK_DISTANCE,
  }
}

/** Maps the stretched reveal interval onto the existing face-to-edges shader clock (23–28.6s). */
export function getScene04PhotoRevealClock(time: number, timeline: Scene04Timeline) {
  const elapsed = Number.isFinite(time) ? time - timeline.photoStart : 0
  return 23 + elapsed * 5 / Math.max(0.001, timeline.photoRevealDuration)
}

/** Fades the settled portrait particles as the unchanged photo mask resolves. */
export function getScene04PortraitParticleOpacity(time: number, timeline: Scene04Timeline) {
  if (!Number.isFinite(time) || time <= timeline.photoStart) return 1
  if (time >= timeline.photoComplete) return 0
  const progress = (time - timeline.photoStart) / (timeline.photoComplete - timeline.photoStart)
  const eased = progress * progress * (3 - 2 * progress)
  return 1 - eased
}

/** Deterministic frame assembly progress, including stable states outside its interval. */
export function getScene04FrameAssemblyProgress(time: number, timeline: Scene04Timeline) {
  if (!Number.isFinite(time) || time <= timeline.frameStart) return 0
  if (time >= timeline.frameComplete) return 1
  const progress = (time - timeline.frameStart) / (timeline.frameComplete - timeline.frameStart)
  return progress * progress * (3 - 2 * progress)
}

