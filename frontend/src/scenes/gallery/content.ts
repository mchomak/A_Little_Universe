import image1 from '../../assets/gallery-placeholders/02-cafe-portrait.webp'
import image2 from '../../assets/gallery-placeholders/03-shore-friends.webp'
import image3 from '../../assets/gallery-placeholders/04-coastal-village.webp'
import image4 from '../../assets/gallery-placeholders/05-city-portrait.webp'
import image5 from '../../assets/gallery-placeholders/06-mountain-lake.webp'
import image6 from '../../assets/gallery-placeholders/07-coffee.webp'
import image7 from '../../assets/gallery-placeholders/08-rainy-city.webp'
import image8 from '../../assets/gallery-placeholders/09-picnic.webp'
import image9 from '../../assets/gallery-placeholders/10-meadow.webp'
import image10 from '../../assets/gallery-placeholders/11-window.webp'
import image11 from '../../assets/gallery-placeholders/12-stars.webp'
import photo from '../../assets/start_img.jpg'
import galleryCaptions from '../../data/galleryCaptions.json'
import type { GalleryPhotoLayout } from '../../systems/scene-config/config'
import { createGalleryEventMemories, GALLERY_EVENT_ORDER } from './catalog'
export interface GalleryMemory { id: string; image: string | undefined; images: Array<string | undefined>; caption: string; aspect: number; side: -1 | 1; order: number; palette: [string, string] }
const demoImages = [image1, image2, image3, image4, image5, image6, image7, image8, image9, image10, image11]
const palettes: [string, string][] = [['#765c68','#c59e8c'],['#7b5267','#e1ad91'],['#84655c','#d6a685'],['#3d6975','#d5ae87'],['#555a75','#e1a78d'],['#476d71','#a3b3a1'],['#805d67','#e1b394'],['#5b7486','#c4a28d'],['#7c5260','#d99e82'],['#4e657b','#d7a58e'],['#6c656d','#d5b59d'],['#223750','#967fa2']]
const captionsById: Readonly<Record<string, { caption: string }>> = galleryCaptions
const demoCaptionIds = ['demo-start-photo', 'demo-memory-2', 'demo-memory-3', 'demo-memory-4', 'demo-memory-5', 'demo-memory-6', 'demo-memory-7', 'demo-memory-8', 'demo-memory-9', 'demo-memory-10', 'demo-memory-11', 'demo-memory-12']
const demoAspects = [1, .72, 1.36, 1.4, .75, 1.3, 1, 1.4, .76, 1.25, 1, 1.4]
const demoGalleryMemories: GalleryMemory[] = demoCaptionIds.map((id, order) => {
  const image = order === 0 ? photo : demoImages[order - 1]
  return {
    id,
    image,
    images: [image, undefined, undefined, undefined],
    caption: captionsById[id]?.caption ?? '',
    order,
    side: order % 2 === 0 ? -1 : 1,
    aspect: demoAspects[order] ?? 1,
    palette: palettes[order % palettes.length]!,
  }
})
const eventPhotos = import.meta.glob<string>('../../../../images/*/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const placeholderMarkers = import.meta.glob<string>('../../../../images/*/.gallery-placeholder', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const placeholderEventIds = Object.keys(placeholderMarkers)
  .map((path) => path.replaceAll('\\', '/').split('/').at(-2))
  .filter((eventId): eventId is string => Boolean(eventId))
const eventGalleryMemories = createGalleryEventMemories(
  GALLERY_EVENT_ORDER,
  eventPhotos,
  captionsById,
  palettes,
  placeholderEventIds,
)
export const GALLERY_MEMORIES: GalleryMemory[] = eventGalleryMemories.length > 0 ? eventGalleryMemories : demoGalleryMemories
export const GALLERY = { spacing: 5.4, width: 7, firstZ: -4.5, startZ: 6.15, travel: 6.15 + 4.5 + (GALLERY_MEMORIES.length - 1) * 5.4 + 4, intro: 4.4, exit: 3.2, sensitivity: .045 } as const
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
export function galleryPhotoYaw(memory: GalleryMemory, variant: GalleryLayoutVariant = 'on-columns'): number {
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
): number {
  const baseYaw = galleryPhotoYaw(memory, variant)
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
