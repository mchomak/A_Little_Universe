import { PerspectiveCamera } from 'three'
import type { Camera } from 'three'
import type { CameraPose } from '../scenes/shared/galleryMotion'
import type { SceneId } from './film'

/** Galaxy seeks scrub the existing runtime timeline; other scene revisions still rebuild theirs. */
export function getCameraTimelineRevision(scene: SceneId, revision: number) {
  return scene === 'cosmos' || scene === 'greeting' || scene === 'ending' ? 0 : revision
}

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
