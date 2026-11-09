import { advanceGallery, galleryMotion } from '../scenes/gallery/controller'
import { GALLERY, GALLERY_MEMORIES, PLANETARIUM_GALLERY_EVENT_ID, galleryPhotoYaw } from '../scenes/gallery/content'
import { getGalleryPhotoPosition } from '../scenes/gallery/archPlacement'
import { createGalleryEntrySequence, type GalleryEntrySequence } from '../scenes/gallery/entryReveal'
import { GALLERY_WORLD } from '../scenes/gallery/world'
import { focusCamera } from '../scenes/gallery/camera'
import { firstMemoryCamera } from '../scenes/shared/firstMemoryFrame'
import type { SceneComposerConfig } from '../systems/scene-config/config'
import type { CameraPose } from '../scenes/shared/galleryMotion'
import { getGalleryCollageCameraFrame, getGalleryCollageFocusDistance, getGalleryNormalFov, getGalleryPhotoAspectProfile } from '../scenes/gallery/galleryCameraFit'

const MIN_FOCUS_DISTANCE = 4.8
const OPPOSITE_PHOTO_CLEARANCE = 0.9
let cachedEntrySettings: SceneComposerConfig['scenes']['gallery'] | null = null
let cachedEntrySequence: GalleryEntrySequence | null = null

function getEntrySequence(settings: SceneComposerConfig['scenes']['gallery']): GalleryEntrySequence {
  if (cachedEntrySettings !== settings || cachedEntrySequence === null) {
    cachedEntrySettings = settings
    cachedEntrySequence = createGalleryEntrySequence(GALLERY_MEMORIES, settings)
  }
  return cachedEntrySequence
}

export interface GalleryCameraFrameOptions {
  delta: number
  speed: number
  paused: boolean
  reducedMotion: boolean
  aspect: number
  focusDistance?: number
  focusCenter?: readonly [number, number]
  entryPose?: CameraPose | null
}

export function updateGalleryCameraPose(
  pose: CameraPose,
  settings: SceneComposerConfig['scenes']['gallery'],
  { delta, speed, paused, reducedMotion, aspect, focusDistance = 4.8, focusCenter = [0, 0], entryPose = null }: GalleryCameraFrameOptions,
) {
  if (!paused) {
    const entrySequence = getEntrySequence(settings)
    advanceGallery(Math.min(delta, 0.05) * speed, reducedMotion, entrySequence.steps.length)
  }

  const motion = galleryMotion
  const opening = Math.min(1, motion.intro / (reducedMotion ? 0.35 : GALLERY.intro))
  const eased = opening * opening * (3 - 2 * opening)
  const cameraEased = entryPose ? 1 : eased
  const cameraOpening = entryPose ? 1 : opening
  const exit = Math.min(1, motion.exit / GALLERY.exit)
  const aisleZ = GALLERY.startZ - motion.progress - exit * 2
  const memory = GALLERY_MEMORIES[motion.focusIndex]!
  const [x, y, z] = getGalleryPhotoPosition(GALLERY_MEMORIES, memory, settings, GALLERY_WORLD.floor.y)
  const focal = motion.focusMix
  const planetariumFocus = memory.id === PLANETARIUM_GALLERY_EVENT_ID
  const collageFrame = getGalleryCollageCameraFrame(memory, settings, getGalleryPhotoAspectProfile(memory.id))
  const fittedFocusDistance = getGalleryCollageFocusDistance(
    collageFrame,
    aspect,
    planetariumFocus ? 70 : getGalleryNormalFov(aspect, eased),
  )
  const oppositePhotoDistance = !planetariumFocus && memory.images[3] && settings.galleryLayoutVariant === 'between-columns'
    ? Math.max(MIN_FOCUS_DISTANCE, Math.abs(x) * 2 - OPPOSITE_PHOTO_CLEARANCE)
    : Number.POSITIVE_INFINITY
  const targetFocusDistance = focal > 0.001
    ? Math.min(fittedFocusDistance, oppositePhotoDistance)
    : MIN_FOCUS_DISTANCE
  const distanceBlend = 1 - Math.exp(-Math.max(0, Math.min(delta, 0.05)) * 7)
  const easedFocusDistance = focusDistance + (targetFocusDistance - focusDistance) * distanceBlend
  const targetCenterX = focal > 0.001 ? collageFrame.centerX : 0
  const targetCenterY = focal > 0.001 ? collageFrame.centerY : 0
  const easedFocusCenter = [
    focusCenter[0] + (targetCenterX - focusCenter[0]) * distanceBlend,
    focusCenter[1] + (targetCenterY - focusCenter[1]) * distanceBlend,
  ] as const
  const focusYaw = galleryPhotoYaw(memory, settings.galleryLayoutVariant, settings.archRotationY)
  const focusCenterWorldX = Math.cos(focusYaw) * easedFocusCenter[0]
  const focusCenterWorldZ = -Math.sin(focusYaw) * easedFocusCenter[0]
  const initial = firstMemoryCamera(34, reducedMotion)
  const initialFit = aspect < 1 ? Math.min(2.5, 1 / Math.max(0.3, aspect)) : 1
  pose.x = initial.x * initialFit * (1 - cameraEased)
  pose.y = initial.y * initialFit * (1 - cameraEased)
  pose.z = aisleZ + (initial.z * initialFit - GALLERY.startZ) * (1 - cameraEased)
  pose.tx = (x + focusCenterWorldX) * focal
  pose.ty = (y + easedFocusCenter[1] - 0.2) * focal
  pose.tz = (aisleZ - 8) * (1 - focal) + (z + focusCenterWorldZ) * focal
  if (cameraOpening < 1) {
    pose.tx *= cameraOpening
    pose.ty *= cameraOpening
    pose.tz = -8 * cameraOpening
  }

  const galleryCamera = focusCamera(
    [pose.x, pose.y, pose.z],
    [x + focusCenterWorldX, y + easedFocusCenter[1], z + focusCenterWorldZ],
    focal,
    focusYaw,
    easedFocusDistance,
  )
  const entryCameraDistance = entryPose
    ? Math.hypot(entryPose.x - entryPose.tx, entryPose.y - entryPose.ty, entryPose.z - entryPose.tz)
    : 0
  const camera = entryPose ? {
    x: entryPose.x + (galleryCamera.x - entryPose.x) * eased,
    y: entryPose.y + (galleryCamera.y - entryPose.y) * eased,
    z: entryPose.z + (galleryCamera.z - entryPose.z) * eased,
    distance: entryCameraDistance + (galleryCamera.distance - entryCameraDistance) * eased,
  } : galleryCamera
  const target = entryPose ? [
    entryPose.tx + (pose.tx - entryPose.tx) * eased,
    entryPose.ty + (pose.ty - entryPose.ty) * eased,
    entryPose.tz + (pose.tz - entryPose.tz) * eased,
  ] as const : [pose.tx, pose.ty, pose.tz] as const
  return {
    camera,
    target,
    memory,
    eased,
    focal,
    collageFrame,
    focusDistance: easedFocusDistance,
    focusCenter: easedFocusCenter,
  }
}
