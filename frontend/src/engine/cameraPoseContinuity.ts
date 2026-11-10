import { PerspectiveCamera } from 'three'
import type { Camera } from 'three'
import type { CameraPose } from '../scenes/shared/galleryMotion'

/** Restore the last visible camera pose after GSAP reverts its timeline targets. */
export function createCameraPoseRestorer(
  pose: CameraPose,
  camera: Camera,
  render: (fovOverride?: number) => void,
) {
  const savedPose = { ...pose }
  const savedFov = camera instanceof PerspectiveCamera ? camera.fov : undefined
  return () => {
    Object.assign(pose, savedPose)
    render(savedFov)
  }
}
