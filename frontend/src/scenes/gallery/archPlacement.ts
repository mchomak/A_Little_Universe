import { GALLERY, GALLERY_COLUMN_SHAFT_CENTER_Z, GALLERY_COLUMN_SHAFT_FRONT_Z, galleryColumnPositions, galleryPhotoYaw, gallerySupportColumnOffsetX, memoryPosition } from './content'
import type { GalleryLayoutVariant, GalleryMemory } from './content'
import { getGalleryColumnPlacement } from './columnModel'
import type { GalleryPhotoLayout } from '../../systems/scene-config/config'

/** Preserves the existing 12-photo composition: 13.69m beyond the actual default shaft centers. */
export const GALLERY_ARCH_COLUMN_GAP = 13.69

type Point = readonly [number, number, number]
export interface GalleryArchColumnSettings {
  readonly columnScale: number
  readonly columnDepth: number
  readonly columnOffsetX: number
  readonly columnOffsetY?: number
}

const DEFAULT_COLUMN_SETTINGS: GalleryArchColumnSettings = {
  columnScale: 1,
  columnDepth: 0.15,
  columnOffsetX: 0,
  columnOffsetY: 0,
}

function actualColumnCenters(
  memories: readonly GalleryMemory[],
  galleryWidth: number,
  variant: GalleryLayoutVariant,
  layout: Readonly<GalleryPhotoLayout>,
  settings: Readonly<GalleryArchColumnSettings>,
  floorY: number,
): Point[] {
  const columns = { columnScale: settings.columnScale, columnDepth: settings.columnDepth }
  return memories.flatMap((memory) => {
    const anchors = galleryColumnPositions(memory, galleryWidth, variant, layout)
    if (anchors.length === 0) return []
    const origin = variant === 'between-columns'
      ? memoryPosition(memory, galleryWidth, variant, layout, columns)
      : anchors[0]!
    const yaw = variant === 'between-columns' ? 0 : galleryPhotoYaw(memory, variant)
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)

    return anchors.map((anchor): Point => {
      const supportX = anchor[0] - origin[0]
      const supportZ = anchor[2] - origin[2]
      const placement = getGalleryColumnPlacement({
        scale: settings.columnScale,
        depth: settings.columnDepth,
        offsetX: gallerySupportColumnOffsetX(anchor[0], variant, settings.columnOffsetX),
        offsetY: settings.columnOffsetY ?? 0,
      }, { x: 1, y: 1, z: 1 }, floorY, GALLERY_COLUMN_SHAFT_FRONT_Z, 0)
      const localX = supportX + placement.position[0]
      const localZ = supportZ + placement.position[2] + GALLERY_COLUMN_SHAFT_CENTER_Z * placement.scale[2]
      return [
        origin[0] + cos * localX + sin * localZ,
        anchor[1] + placement.position[1],
        origin[2] - sin * localX + cos * localZ,
      ]
    })
  })
}

function finalSupportPair(
  memories: readonly GalleryMemory[],
  galleryWidth: number,
  variant: GalleryLayoutVariant,
  layout: Readonly<GalleryPhotoLayout>,
  columnSettings: Readonly<GalleryArchColumnSettings>,
  floorY: number,
): readonly [Point, Point] {
  const supports = actualColumnCenters(memories, galleryWidth, variant, layout, columnSettings, floorY)
  if (supports.length === 0) return [[0, 0, GALLERY.firstZ], [0, 0, GALLERY.firstZ]]

  const deepest = [...supports].sort((left, right) => left[2] - right[2])[0]!
  const candidates = supports.filter(point => point[0] * deepest[0] < 0 && point !== deepest)
  const opposite = candidates.find(point => Math.abs(point[2] - deepest[2]) < 1e-6)
    ?? candidates.sort((left, right) => Math.abs(left[2] - deepest[2]) - Math.abs(right[2] - deepest[2]))[0]
  if (!opposite) {
    const radius = Math.abs(deepest[0])
    return [[-radius, deepest[1], deepest[2]], [radius, deepest[1], deepest[2]]]
  }
  return [deepest, opposite]
}

/** Places the arch at a fixed distance beyond the final pair, following gallery length and layout offsets. */
export function getGalleryArchPosition(
  memories: readonly GalleryMemory[],
  galleryWidth: number,
  variant: GalleryLayoutVariant,
  layout: Readonly<GalleryPhotoLayout>,
  xOffset = 0,
  yOffset = 0,
  floorY = 0,
  columnSettings: Readonly<GalleryArchColumnSettings> = DEFAULT_COLUMN_SETTINGS,
): [number, number, number] {
  const [first, second] = finalSupportPair(memories, galleryWidth, variant, layout, columnSettings, floorY)
  return [
    (first[0] + second[0]) / 2 + xOffset,
    floorY + yOffset,
    (first[2] + second[2]) / 2 - GALLERY_ARCH_COLUMN_GAP,
  ]
}
