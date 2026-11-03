import type { CameraPose } from '../scenes/shared/galleryMotion'
import type { SceneComposerConfig } from '../systems/scene-config/config'

type IdentityCameraSettings = SceneComposerConfig['scenes']['identity']

/** Extends the bloom camera's exact end pose into the slow Scene 04 pullback. */
export function getIdentityCameraMoveTarget(start: CameraPose, settings: Pick<IdentityCameraSettings, 'cameraPullback' | 'cameraRise'>): CameraPose {
  return {
    ...start,
    y: start.y + settings.cameraRise,
    ty: start.ty + settings.cameraRise * 0.6,
    z: start.z + settings.cameraPullback,
  }
}
