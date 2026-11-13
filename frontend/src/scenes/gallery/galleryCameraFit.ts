import { getGalleryCollagePhotoLayout, type GalleryCollageSlot } from './collage'
import { getGalleryCaptionLayout, GALLERY_CAPTION_GAP } from './captionLayout'
import type { GalleryLayoutVariant, GalleryMemory } from './content'

export interface GalleryPhotoAspectProfile {
  readonly main?: number
  readonly extras?: readonly (number | undefined)[]
}

export interface GalleryCollageCameraFrame {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
  readonly centerX: number
  readonly centerY: number
  readonly width: number
  readonly height: number
}

interface GalleryCollageCameraSettings {
  readonly collagePhotoScale: number
  readonly collagePhotoGap: number
  readonly captionFontSize?: number
  readonly captionLineCharacters?: number
  readonly galleryLayoutVariant?: GalleryLayoutVariant
}

type GalleryPhotoSlot = 'main' | GalleryCollageSlot

const loadedAspects = new Map<string, Map<GalleryPhotoSlot, number>>()
const MIN_COLLAGE_CAMERA_DISTANCE = 4.8
const COLLAGE_FRAME_MARGIN = 1.2
const VIEWPORT_FILL_FRACTION = 0.78

function safeAspect(value: number | undefined, fallback = 1): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value! : fallback
}

/** TextureLoader updates this small CPU-only cache; the camera reads it every frame. */
export function setGalleryPhotoAspect(memoryId: string, slot: GalleryPhotoSlot, aspect: number): void {
  if (!memoryId || !Number.isFinite(aspect) || aspect <= 0) return
  const aspects = loadedAspects.get(memoryId) ?? new Map<GalleryPhotoSlot, number>()
  aspects.set(slot, aspect)
  loadedAspects.set(memoryId, aspects)
}

export function getGalleryPhotoAspectProfile(memoryId: string): GalleryPhotoAspectProfile {
  const aspects = loadedAspects.get(memoryId)
  if (!aspects) return {}
  const main = aspects.get('main')
  return {
    ...(main === undefined ? {} : { main }),
    extras: [aspects.get(2), aspects.get(3), aspects.get(4)],
  }
}

/** Small test/teardown seam for the per-memory texture metadata cache. */
export function clearGalleryPhotoAspects(memoryId?: string): void {
  if (memoryId) loadedAspects.delete(memoryId)
  else loadedAspects.clear()
}

/** Bounds the visible photo group, its extra frames, and its optional caption around the main image target. */
export function getGalleryCollageCameraFrame(
  memory: GalleryMemory,
  settings: Readonly<GalleryCollageCameraSettings>,
  aspects: Readonly<GalleryPhotoAspectProfile> = {},
): GalleryCollageCameraFrame {
  const photoSize = memory.order === 0 ? 2.15 : 3.3
  const mainAspect = safeAspect(aspects.main, safeAspect(memory.aspect))
  const mainWidth = mainAspect >= 1 ? photoSize : photoSize * mainAspect
  const mainHeight = mainAspect >= 1 ? photoSize / mainAspect : photoSize
  let minX = -(mainWidth + 0.36) / 2
  let maxX = (mainWidth + 0.36) / 2
  let minY = -(mainHeight + 0.36) / 2
  let maxY = (mainHeight + 0.36) / 2

  const extras = memory.images.slice(1, 4)
  extras.forEach((url, index) => {
    if (!url) return
    const slot = (index + 2) as GalleryCollageSlot
    const aspect = safeAspect(aspects.extras?.[index], 1)
    const extra = getGalleryCollagePhotoLayout(slot, memory.side, mainWidth, mainHeight, aspect, {
      photoScale: settings.collagePhotoScale,
      photoGap: settings.collagePhotoGap,
    }, settings.galleryLayoutVariant)
    minX = Math.min(minX, extra.position[0] - extra.width / 2 - 0.04)
    maxX = Math.max(maxX, extra.position[0] + extra.width / 2 + 0.04)
    minY = Math.min(minY, extra.position[1] - extra.height / 2 - 0.04)
    maxY = Math.max(maxY, extra.position[1] + extra.height / 2 + 0.04)
  })

  if (memory.title.trim() || memory.caption.trim()) {
    const caption = getGalleryCaptionLayout(memory.title, memory.caption, settings.captionFontSize, settings.captionLineCharacters)
    minX = Math.min(minX, -caption.worldWidth / 2)
    maxX = Math.max(maxX, caption.worldWidth / 2)
    minY = Math.min(minY, -mainHeight / 2 - GALLERY_CAPTION_GAP - caption.worldHeight)
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const width = (maxX - minX) * COLLAGE_FRAME_MARGIN
  const height = (maxY - minY) * COLLAGE_FRAME_MARGIN
  const halfWidth = width / 2
  const halfHeight = height / 2
  return {
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minY: centerY - halfHeight,
    maxY: centerY + halfHeight,
    centerX,
    centerY,
    width,
    height,
  }
}

export function getGalleryCollageFocusDistance(
  frame: Readonly<GalleryCollageCameraFrame>,
  viewportAspect: number,
  verticalFovDegrees: number,
): number {
  const aspect = Number.isFinite(viewportAspect) ? Math.max(0.3, viewportAspect) : 1
  const fov = Number.isFinite(verticalFovDegrees) ? Math.max(12, Math.min(70, verticalFovDegrees)) : 48
  const neededHeight = Math.max(frame.height, frame.width / aspect)
  const halfFov = fov * Math.PI / 360
  return Math.max(MIN_COLLAGE_CAMERA_DISTANCE, neededHeight / (2 * Math.tan(halfFov) * VIEWPORT_FILL_FRACTION))
}

/** Matches CameraDirector's existing gallery-only FOV ramp. */
export function getGalleryNormalFov(viewportAspect: number, easedOpening: number): number {
  const aspect = Number.isFinite(viewportAspect) ? Math.max(0.3, viewportAspect) : 1
  const eased = Number.isFinite(easedOpening) ? Math.max(0, Math.min(1, easedOpening)) : 1
  const portraitFov = Math.min(82, Math.max(70, 2 * Math.atan(5.1 / (10.65 * aspect)) * 180 / Math.PI))
  const initialFov = aspect < 1 ? 42 : 38
  return initialFov + ((aspect < 1 ? portraitFov : 48) - initialFov) * eased
}

/** Widen the focus view when the opposite photo prevents the camera from backing away. */
export function getGalleryFocusFov(frame: Readonly<GalleryCollageCameraFrame>, viewportAspect: number, distance: number): number {
  const aspect = Number.isFinite(viewportAspect) ? Math.max(0.3, viewportAspect) : 1
  const safeDistance = Number.isFinite(distance) ? Math.max(0.01, distance) : MIN_COLLAGE_CAMERA_DISTANCE
  const fitHeight = Math.max(frame.height, frame.width / aspect)
  return Math.max(4, Math.min(140, 2 * Math.atan(fitHeight / (2 * safeDistance * 0.75)) * 180 / Math.PI))
}
