import { advanceGallery, galleryMotion } from '../scenes/gallery/controller'
import { GALLERY, GALLERY_MEMORIES, memoryPosition } from '../scenes/gallery/content'
import { focusCamera } from '../scenes/gallery/camera'
import { GALLERY_ART } from '../scenes/gallery/artDirection'
import { firstMemoryCamera } from '../scenes/shared/firstMemoryFrame'
import type { SceneComposerConfig } from '../systems/scene-config/config'
import type { CameraPose } from '../scenes/shared/galleryMotion'

export interface GalleryCameraFrameOptions {
  delta: number
  speed: number
  paused: boolean
  reducedMotion: boolean
  aspect: number
}

export function updateGalleryCameraPose(
  pose: CameraPose,
  settings: SceneComposerConfig['scenes']['gallery'],
  { delta, speed, paused, reducedMotion, aspect }: GalleryCameraFrameOptions,
) {
  if (!paused) advanceGallery(Math.min(delta, 0.05) * speed)

  const motion = galleryMotion
  const opening = Math.min(1, motion.intro / (reducedMotion ? 0.35 : GALLERY.intro))
  const eased = opening * opening * (3 - 2 * opening)
  const exit = Math.min(1, motion.exit / GALLERY.exit)
  const aisleZ = GALLERY.startZ - motion.progress - exit * 2
  const memory = GALLERY_MEMORIES[motion.focusIndex]!
  const layout = settings.galleryLayoutVariant === 'between-columns' ? settings.galleryLayoutB : settings.galleryLayoutA
  const [x, y, z] = memoryPosition(memory, settings.galleryWidth, settings.galleryLayoutVariant, layout)
  const focal = motion.focusMix
  const initial = firstMemoryCamera(34, reducedMotion)
  const initialFit = aspect < 1 ? Math.min(2.5, 1 / Math.max(0.3, aspect)) : 1
  pose.x = initial.x * initialFit * (1 - eased)
  pose.y = initial.y * initialFit * (1 - eased)
  pose.z = aisleZ + (initial.z * initialFit - GALLERY.startZ) * (1 - eased)
  pose.tx = x * focal
  pose.ty = (y - 0.2) * focal
  pose.tz = (aisleZ - 8) * (1 - focal) + z * focal
  if (opening < 1) {
    pose.tx *= eased
    pose.ty *= eased
    pose.tz = -8 * eased
  }

  const camera = focusCamera([pose.x, pose.y, pose.z], [x, y, z], focal, -memory.side * GALLERY_ART.wallYaw)
  return { camera, target: [pose.tx, pose.ty, pose.tz] as const, memory, eased, focal }
}
