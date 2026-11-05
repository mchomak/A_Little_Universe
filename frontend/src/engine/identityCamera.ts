import type { CameraPose } from '../scenes/shared/galleryMotion'
import type { SceneComposerConfig } from '../systems/scene-config/config'

type IdentityCameraSettings = SceneComposerConfig['scenes']['identity']

/** Extends the bloom camera's exact end pose into the slow Scene 04 pullback. */
export function getIdentityCameraMoveTarget(start: CameraPose, settings: IdentityCameraSettings): CameraPose {
  return {
    ...start,
    y: start.y + settings.cameraRise,
    z: start.z + settings.cameraPullback,
  }
}

/** Continue a dolly along the current view direction while keeping its framing target fixed. */
export function getIdentityCameraPullbackPose(pose: CameraPose, distance: number): CameraPose {
  const deltaX = pose.x - pose.tx
  const deltaY = pose.y - pose.ty
  const deltaZ = pose.z - pose.tz
  const length = Math.max(0.001, Math.hypot(deltaX, deltaY, deltaZ))
  const pullback = Number.isFinite(distance) ? Math.max(0, distance) : 0
  return {
    ...pose,
    x: pose.x + deltaX / length * pullback,
    y: pose.y + deltaY / length * pullback,
    z: pose.z + deltaZ / length * pullback,
  }
}
