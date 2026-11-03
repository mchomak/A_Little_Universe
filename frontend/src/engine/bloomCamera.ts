import type { CameraPose } from '../scenes/shared/galleryMotion'
import type { SceneComposerConfig } from '../systems/scene-config/config'
import { getBloomCameraApproachDuration } from '../scenes/lily/animationTiming'

type BloomCameraSettings = SceneComposerConfig['scenes']['bloom']

/** World-space close-up centered on the GLB flower cup. CameraDirector owns its motion. */
export function getBloomCloseupPose(settings: Pick<BloomCameraSettings, 'cameraTargetX' | 'cameraTargetY' | 'cameraFinalDistance' | 'cameraFinalHeight'>): CameraPose {
  return {
    x: settings.cameraTargetX,
    y: settings.cameraFinalHeight,
    z: settings.cameraFinalDistance,
    tx: settings.cameraTargetX,
    ty: settings.cameraTargetY,
    tz: 0,
  }
}

export function getBloomCameraMoveDuration(settings: BloomCameraSettings, openingRange: readonly [number, number]): number {
  return getBloomCameraApproachDuration(settings.cameraApproachDuration, openingRange)
}
