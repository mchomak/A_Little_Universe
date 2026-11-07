import photo from '../../assets/start_img.jpg'
import galleryCaptions from '../../data/galleryCaptions.json'
import type { GalleryPhotoLayout } from '../../systems/scene-config/config'
import { createGalleryEventMemories, GALLERY_EVENT_ORDER, GALLERY_EVENT_PHOTO_FILES } from './catalog'
export interface GalleryMemory { id: string; image: string | undefined; images: Array<string | undefined>; title: string; caption: string; aspect: number; side: -1 | 1; order: number }
const captionsById: Readonly<Record<string, { title: string; caption: string }>> = galleryCaptions
const eventPhotos = import.meta.glob<string>('../../../../images/*/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const eventGalleryMemories = createGalleryEventMemories(
  GALLERY_EVENT_ORDER,
  eventPhotos,
  captionsById,
  GALLERY_EVENT_PHOTO_FILES,
)
const startMemory: GalleryMemory = {
  id: 'start_img.jpg',
  image: photo,
  images: [photo, undefined, undefined, undefined],
  title: captionsById['start_img.jpg']?.title ?? '',
  caption: captionsById['start_img.jpg']?.caption ?? '',
  aspect: 1,
  side: -1,
  order: 0,
}
export const GALLERY_MEMORIES: GalleryMemory[] = [
  startMemory,
  ...eventGalleryMemories.map((memory, index) => {
    const order = index + 1
    const side: -1 | 1 = order % 2 === 0 ? -1 : 1
    return { ...memory, order, side }
  }),
]
export const GALLERY = { spacing: 5.4, width: 7, firstZ: -4.5, startZ: 6.15, travel: 6.15 + 4.5 + (GALLERY_MEMORIES.length - 1) * 5.4 + 4, intro: 4.4, exit: 5, sensitivity: .045 } as const
export const GALLERY_B_MIN_PHOTO_X = 0.5
export const GALLERY_PHOTO_FACING_NEAR_DISTANCE = 0
export const GALLERY_PHOTO_FACING_FAR_DISTANCE = GALLERY.spacing * 4
// Calibrated from the real gallery-ionic-column/column.glb shaft bounds.
// columnModel.test.ts checks these against the loaded, extended GLB geometry.
export const GALLERY_COLUMN_SHAFT_FRONT_Z = 0.96
export const GALLERY_COLUMN_SHAFT_CENTER_Z = 0
export interface GalleryColumnCenteringSettings {
  columnScale?: number
  columnDepth?: number
}

export const PLANETARIUM_GALLERY_EVENT_ID = '2026_10_Planetarium'

/** Offset a B photo from the support anchors to the midpoint of their visible shafts. */
export function galleryColumnPhotoCenterOffsetZ(settings: Readonly<GalleryColumnCenteringSettings> = {}): number {
  const columnScale = Number.isFinite(settings.columnScale) && (settings.columnScale ?? 0) > 0
    ? settings.columnScale!
    : 1
  const columnDepth = Number.isFinite(settings.columnDepth)
    ? Math.max(0, settings.columnDepth!)
    : 0.15
  return -columnDepth + (GALLERY_COLUMN_SHAFT_CENTER_Z - GALLERY_COLUMN_SHAFT_FRONT_Z) * columnScale
}
export type GalleryLayoutVariant = 'on-columns' | 'between-columns'

/** Photos stay on their columns in A; B pairs opposite sides halfway between each side's supports. */
export function memoryPosition(
  memory: GalleryMemory,
  galleryWidth: number,
  variant: GalleryLayoutVariant = 'on-columns',
  layout?: Readonly<GalleryPhotoLayout>,
  columns?: Readonly<GalleryColumnCenteringSettings>,
): [number, number, number] {
  const configuredWidth = layout?.laneWidth ?? galleryWidth
  const halfWidth = Number.isFinite(configuredWidth) ? Math.max(0, configuredWidth) / 2 : GALLERY.width / 2
  const pairDepth = GALLERY.firstZ - GALLERY.spacing - Math.floor(memory.order / 2) * GALLERY.spacing * 2
  const z = variant === 'between-columns' ? pairDepth : GALLERY.firstZ - memory.order * GALLERY.spacing
  const offsetX = layout?.offsetX ?? 0
  // B's X offset is radial so its opposite walls remain mirrored; A keeps
  // the historical global X translation for compatibility.
  const x = variant === 'between-columns'
    ? memory.side * Math.max(GALLERY_B_MIN_PHOTO_X, halfWidth + offsetX)
    : memory.side * halfWidth + offsetX
  const columnCenterOffsetZ = variant === 'between-columns' ? galleryColumnPhotoCenterOffsetZ(columns) : 0
  return [x, layout?.offsetY ?? 0, z + (layout?.offsetZ ?? 0) + columnCenterOffsetZ]
}

/** Support columns keep their original alternating positions in both compositions. */
export function galleryColumnPosition(memory: GalleryMemory, galleryWidth: number): [number, number, number] {
  const halfWidth = Number.isFinite(galleryWidth) ? Math.max(0, galleryWidth) / 2 : GALLERY.width / 2
  return [memory.side * halfWidth, 0, GALLERY.firstZ - memory.order * GALLERY.spacing]
}

/** B keeps each photo between two straight supports on its side of the aisle. */
export function galleryColumnPositions(
  memory: GalleryMemory,
  galleryWidth: number,
  variant: GalleryLayoutVariant = 'on-columns',
  layout?: Readonly<GalleryPhotoLayout>,
): [number, number, number][] {
  if (variant !== 'between-columns') return [galleryColumnPosition(memory, galleryWidth)]
  if (memory.order % 2 === 1) return []
  const configuredWidth = layout?.laneWidth ?? galleryWidth
  const halfWidth = Number.isFinite(configuredWidth) ? Math.max(0, configuredWidth) / 2 : GALLERY.width / 2
  const configuredOffsetX = layout?.offsetX ?? 0
  const laneOffsetX = Number.isFinite(configuredOffsetX) ? configuredOffsetX : 0
  const laneRadius = Math.max(GALLERY_B_MIN_PHOTO_X, halfWidth + laneOffsetX)
  const row = memory.order / 2
  // The previous row already renders this row's near boundary as its far boundary.
  const firstBoundary = row === 0 ? row : row + 1
  const lastBoundary = row + 1
  const columns: [number, number, number][] = []
  for (let boundary = firstBoundary; boundary <= lastBoundary; boundary++) {
    const z = GALLERY.firstZ - boundary * GALLERY.spacing * 2 + (layout?.offsetZ ?? 0)
    columns.push([-laneRadius, 0, z], [laneRadius, 0, z])
  }
  return columns
}

/** Keep B's support rails independent of the offset, animated photo group. */
export function gallerySupportGroupScale(variant: GalleryLayoutVariant, introScale: number): number {
  const safeIntroScale = Number.isFinite(introScale) ? Math.max(0.001, introScale) : 1
  return variant === 'between-columns' ? 1 : safeIntroScale
}

/** Positions B supports relative to the stable photo anchor, outside the per-frame transform. */
export function gallerySupportLocalPositions(
  variant: GalleryLayoutVariant,
  photoPosition: readonly [number, number, number],
  supportPositions: readonly (readonly [number, number, number])[],
): [number, number, number][] {
  return supportPositions.map(([x, y, z]) => variant === 'between-columns'
      ? [x - photoPosition[0], y - photoPosition[1], z - photoPosition[2]]
      : [0, 0, 0])
}

/** B's shared column offset is radial so opposite supports stay mirrored. */
export function gallerySupportColumnOffsetX(supportX: number, variant: GalleryLayoutVariant, offsetX: number): number {
  const safeOffset = Number.isFinite(offsetX) ? offsetX : 0
  return variant === 'between-columns' ? Math.sign(supportX || 1) * safeOffset : safeOffset
}

/** Side-facing cardinal yaw makes B exhibits face each other across the walkway. */
export function galleryPhotoYaw(memory: GalleryMemory, variant: GalleryLayoutVariant = 'on-columns', planetariumYaw = 0): number {
  if (memory.id === PLANETARIUM_GALLERY_EVENT_ID) return Number.isFinite(planetariumYaw) ? planetariumYaw : 0
  const sideYaw = variant === 'between-columns' ? Math.PI / 2 : 1.15
  return -memory.side * sideYaw
}

/** Turns opposing B photos toward the viewer along the aisle, then settles them nearby. */
export function galleryPhotoApproachYaw(
  memory: GalleryMemory,
  variant: GalleryLayoutVariant,
  cameraOffsetZ: number,
  maxFacingDegrees = 45,
  focusMix = 0,
  planetariumYaw = 0,
): number {
  const baseYaw = galleryPhotoYaw(memory, variant, planetariumYaw)
  if (memory.id === PLANETARIUM_GALLERY_EVENT_ID) return baseYaw
  if (variant !== 'between-columns') return baseYaw
  const safeOffsetZ = Number.isFinite(cameraOffsetZ) ? cameraOffsetZ : 0
  const distance = Math.abs(safeOffsetZ)
  const amount = Math.max(0, Math.min(1,
    (distance - GALLERY_PHOTO_FACING_NEAR_DISTANCE)
      / (GALLERY_PHOTO_FACING_FAR_DISTANCE - GALLERY_PHOTO_FACING_NEAR_DISTANCE),
  ))
  const eased = amount * amount * (3 - 2 * amount)
  const safeFocus = Math.max(0, Math.min(1, Number.isFinite(focusMix) ? focusMix : 0))
  const angle = Math.max(0, Math.min(45, Number.isFinite(maxFacingDegrees) ? maxFacingDegrees : 45))
    * Math.PI / 180
    * eased
    * (1 - safeFocus)
  return baseYaw + memory.side * Math.sign(safeOffsetZ) * angle
}
