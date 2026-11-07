import { Euler, Matrix4, Vector3 } from 'three'
import { APPROVED_PORTRAIT_SETTINGS } from '../lily/approvedPortrait'
import { createLilyPortraitCameraBasisAtTime } from '../lily/portraitIntegration'
import { LILY_PORTRAIT_PHOTO_DEPTH_OFFSET } from '../lily/portraitPhotoReveal'
import type { SceneComposerConfig } from '../../systems/scene-config/config'

const FIRST_MEMORY_CARD_SIZE = 2.15

/** The gallery starts the same photo where Scene 04's camera-facing plane ended. */
export function getFirstMemoryHandoffPose(
  bloomSettings: Pick<SceneComposerConfig['scenes']['bloom'], 'cameraTargetX' | 'cameraTargetY' | 'cameraFinalDistance' | 'cameraFinalHeight'>,
  identitySettings: Pick<SceneComposerConfig['scenes']['identity'], 'cameraPullback' | 'cameraRise' | 'cameraMoveDuration'>,
  aspect: number,
  reducedMotion: boolean,
) {
  const basisAtTime = createLilyPortraitCameraBasisAtTime({ bloomSettings, identitySettings, aspect, reducedMotion })
  const basis = basisAtTime(identitySettings.cameraMoveDuration)
  const pose = APPROVED_PORTRAIT_SETTINGS
  const position = [0, 1, 2].map((axis) => basis.center[axis]!
    + basis.right[axis]! * pose.offsetX * basis.visibleWidth
    - basis.up[axis]! * pose.offsetY * basis.visibleHeight
    + basis.forward[axis]! * LILY_PORTRAIT_PHOTO_DEPTH_OFFSET) as [number, number, number]
  const size = Math.min(basis.visibleWidth, basis.visibleHeight) * pose.scale
  const orientation = new Matrix4().makeBasis(
    new Vector3(...basis.right),
    new Vector3(...basis.up),
    new Vector3(...basis.forward).negate(),
  )
  const rotation = new Euler().setFromRotationMatrix(orientation)

  return {
    position,
    scale: size / FIRST_MEMORY_CARD_SIZE,
    rotation: [rotation.x, rotation.y, rotation.z] as [number, number, number],
  }
}
