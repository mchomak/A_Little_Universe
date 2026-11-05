import { advanceGallery, galleryMotion } from '../scenes/gallery/controller'
import { GALLERY, GALLERY_MEMORIES, galleryPhotoYaw, memoryPosition } from '../scenes/gallery/content'
import { focusCamera } from '../scenes/gallery/camera'
import { firstMemoryCamera } from '../scenes/shared/firstMemoryFrame'
import type { SceneComposerConfig } from '../systems/scene-config/config'
import type { CameraPose } from '../scenes/shared/galleryMotion'
import { getGalleryCollageCameraFrame, getGalleryCollageFocusDistance, getGalleryNormalFov, getGalleryPhotoAspectProfile } from '../scenes/gallery/galleryCameraFit'

export interface GalleryCameraFrameOptions {
  delta: number
  speed: number
  paused: boolean
  reducedMotion: boolean
  aspect: number
  focusDistance?: number
  focusCenter?: readonly [number, number]
}

export function updateGalleryCameraPose(
  pose: CameraPose,
  settings: SceneComposerConfig['scenes']['gallery'],
  { delta, speed, paused, reducedMotion, aspect, focusDistance = 4.8, focusCenter = [0, 0] }: GalleryCameraFrameOptions,
) {
  if (!paused) advanceGallery(Math.min(delta, 0.05) * speed)

  const motion = galleryMotion
  const opening = Math.min(1, motion.intro / (reducedMotion ? 0.35 : GALLERY.intro))
  const eased = opening * opening * (3 - 2 * opening)
  const exit = Math.min(1, motion.exit / GALLERY.exit)
  const aisleZ = GALLERY.startZ - motion.progress - exit * 2
  const memory = GALLERY_MEMORIES[motion.focusIndex]!
  const layout = settings.galleryLayoutVariant === 'between-columns' ? settings.galleryLayoutB : settings.galleryLayoutA
  const [x, y, z] = memoryPosition(memory, settings.galleryWidth, settings.galleryLayoutVariant, layout, settings)
  const focal = motion.focusMix
  const collageFrame = getGalleryCollageCameraFrame(memory, settings, getGalleryPhotoAspectProfile(memory.id))
  const targetFocusDistance = focal > 0.001
    ? getGalleryCollageFocusDistance(collageFrame, aspect, getGalleryNormalFov(aspect, eased))
    : 4.8
  const distanceBlend = 1 - Math.exp(-Math.max(0, Math.min(delta, 0.05)) * 7)
  const easedFocusDistance = focusDistance + (targetFocusDistance - focusDistance) * distanceBlend
  const targetCenterX = focal > 0.001 ? collageFrame.centerX : 0
  const targetCenterY = focal > 0.001 ? collageFrame.centerY : 0
  const easedFocusCenter = [
    focusCenter[0] + (targetCenterX - focusCenter[0]) * distanceBlend,
    focusCenter[1] + (targetCenterY - focusCenter[1]) * distanceBlend,
  ] as const
  const focusYaw = galleryPhotoYaw(memory, settings.galleryLayoutVariant)
  const focusCenterWorldX = Math.cos(focusYaw) * easedFocusCenter[0]
  const focusCenterWorldZ = -Math.sin(focusYaw) * easedFocusCenter[0]
  const initial = firstMemoryCamera(34, reducedMotion)
  const initialFit = aspect < 1 ? Math.min(2.5, 1 / Math.max(0.3, aspect)) : 1
  pose.x = initial.x * initialFit * (1 - eased)
  pose.y = initial.y * initialFit * (1 - eased)
  pose.z = aisleZ + (initial.z * initialFit - GALLERY.startZ) * (1 - eased)
  pose.tx = (x + focusCenterWorldX) * focal
  pose.ty = (y + easedFocusCenter[1] - 0.2) * focal
  pose.tz = (aisleZ - 8) * (1 - focal) + (z + focusCenterWorldZ) * focal
  if (opening < 1) {
    pose.tx *= eased
    pose.ty *= eased
    pose.tz = -8 * eased
  }

  const camera = focusCamera(
    [pose.x, pose.y, pose.z],
    [x + focusCenterWorldX, y + easedFocusCenter[1], z + focusCenterWorldZ],
    focal,
    focusYaw,
    easedFocusDistance,
  )
  return {
    camera,
    target: [pose.tx, pose.ty, pose.tz] as const,
    memory,
    eased,
    focal,
    collageFrame,
    focusDistance: easedFocusDistance,
    focusCenter: easedFocusCenter,
  }
}
