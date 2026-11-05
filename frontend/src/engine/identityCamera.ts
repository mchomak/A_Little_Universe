import type { CameraPose } from '../scenes/shared/galleryMotion'
import type { SceneComposerConfig } from '../systems/scene-config/config'

type IdentityCameraSettings = SceneComposerConfig['scenes']['identity']
export const IDENTITY_CAMERA_PULLBACK_DISTANCE = 1.7
export const IDENTITY_CAMERA_PULLBACK_SECONDS = 4

/** Extends the bloom camera's exact end pose into the slow Scene 04 pullback. */
export function getIdentityCameraMoveTarget(start: CameraPose, settings: Pick<IdentityCameraSettings, 'cameraPullback' | 'cameraRise'>): CameraPose {
  return {
    ...start,
    y: start.y + settings.cameraRise,
    ty: start.ty + settings.cameraRise * 0.6,
    z: start.z + settings.cameraPullback,
  }
}

/** Continue the existing dolly along its view direction without changing the portrait's aim. */
export function getIdentityCameraPullbackPose(pose: CameraPose, distance: number): CameraPose {
  const dx = pose.x - pose.tx
  const dy = pose.y - pose.ty
  const dz = pose.z - pose.tz
  const length = Math.max(0.001, Math.hypot(dx, dy, dz))
  const amount = Number.isFinite(distance) ? Math.max(0, distance) : 0
  return {
    ...pose,
    x: pose.x + dx / length * amount,
    y: pose.y + dy / length * amount,
    z: pose.z + dz / length * amount,
  }
}

/** Absolute camera samples shared by CameraDirector and portrait target capture. */
export function getIdentityCameraPoseAt(start: CameraPose, end: CameraPose, time: number, moveDuration: number): CameraPose {
  const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0
  const duration = Math.max(0.001, Number.isFinite(moveDuration) ? moveDuration : 0.001)
  const moveProgress = Math.min(1, safeTime / duration)
  const moveEase = 0.5 - 0.5 * Math.cos(Math.PI * moveProgress)
  const moved = {
    x: start.x + (end.x - start.x) * moveEase,
    y: start.y + (end.y - start.y) * moveEase,
    z: start.z + (end.z - start.z) * moveEase,
    tx: start.tx + (end.tx - start.tx) * moveEase,
    ty: start.ty + (end.ty - start.ty) * moveEase,
    tz: start.tz + (end.tz - start.tz) * moveEase,
  }
  const pullbackProgress = Math.min(1, Math.max(0, (safeTime - duration) / IDENTITY_CAMERA_PULLBACK_SECONDS))
  const pullbackEase = 0.5 - 0.5 * Math.cos(Math.PI * pullbackProgress)
  return getIdentityCameraPullbackPose(moved, IDENTITY_CAMERA_PULLBACK_DISTANCE * pullbackEase)
}
