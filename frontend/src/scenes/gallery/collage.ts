import { BufferAttribute, BufferGeometry } from 'three'

export type GalleryCollageSlot = 2 | 3 | 4

export interface GalleryCollagePhotoLayout {
  position: readonly [number, number, number]
  width: number
  height: number
}

export interface GalleryCollagePhoto {
  slot: GalleryCollageSlot
  url: string
}

/** Retains numbered positions while omitting missing images and their frames. */
export function getGalleryCollagePhotos(images: readonly (string | undefined)[]): GalleryCollagePhoto[] {
  return images.slice(1, 4).flatMap((url, index) => url
    ? [{ slot: (index + 2) as GalleryCollageSlot, url }]
    : [])
}

/** Keeps extra-photo components unmounted until their memory enters focus. */
export function getFocusedGalleryCollagePhotos(
  images: readonly (string | undefined)[],
  memoryOrder: number,
  focusedOrder: number | null,
): GalleryCollagePhoto[] {
  return focusedOrder === memoryOrder ? getGalleryCollagePhotos(images) : []
}

/** Places numbered photos in-plane, with a small side-aware outward depth bias. */
export function getGalleryCollagePhotoLayout(
  slot: GalleryCollageSlot,
  side: -1 | 1,
  mainWidth: number,
  mainHeight: number,
  aspect: number,
): GalleryCollagePhotoLayout {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const width = 1.02
  const height = width / safeAspect
  const gap = 0.16
  const wallYaw = -side * 1.15
  const yawSin = Math.sin(wallYaw)
  const outwardDepth = Math.abs(yawSin) > 0.001 ? side * 0.18 / yawSin : 0.035
  if (slot === 4) return { position: [0, mainHeight / 2 + height / 2 + gap, outwardDepth], width, height }

  const horizontal = slot === 2 ? -1 : 1
  const horizontalOffset = horizontal * (mainWidth / 2 + width / 2 + gap)
  const facesPassage = slot === 2 ? side > 0 : side < 0
  const depthLayer = slot === 2 ? -0.025 : 0.025
  const localZ = outwardDepth + depthLayer - (facesPassage ? 0.08 : 0)
  return {
    position: [horizontalOffset, -mainHeight / 2 + height / 2 + gap, localZ],
    width,
    height,
  }
}

function random(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x100000000
  }
}

/** Creates deterministic particles that converge onto the selected photo's surface. */
export function createCollageRevealGeometry(width: number, height: number, seed: number, count = 72) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1
  const safeCount = Math.max(8, Math.floor(Number.isFinite(count) ? count : 72))
  const positions = new Float32Array(safeCount * 3)
  const targets = new Float32Array(safeCount * 3)
  const sizes = new Float32Array(safeCount)
  const phases = new Float32Array(safeCount)
  const next = random(seed)

  for (let i = 0; i < safeCount; i++) {
    const targetX = (next() - 0.5) * safeWidth
    const targetY = (next() - 0.5) * safeHeight
    const angle = next() * Math.PI * 2
    const scatter = 0.35 + next() * 0.9
    positions.set([targetX + Math.cos(angle) * scatter, targetY + Math.sin(angle) * scatter, 0.18 + next() * 0.35], i * 3)
    targets.set([targetX, targetY, 0.05], i * 3)
    sizes[i] = 0.018 + next() * 0.028
    phases[i] = next() * Math.PI * 2
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3).setUsage(35048))
  geometry.setAttribute('targetPosition', new BufferAttribute(targets, 3))
  geometry.setAttribute('size', new BufferAttribute(sizes, 1))
  geometry.setAttribute('phase', new BufferAttribute(phases, 1))
  return geometry
}

export function collageRevealProgress(focusMix: number) {
  return Math.max(0, Math.min(1, Number.isFinite(focusMix) ? focusMix : 0))
}

export function collagePhotoOpacity(focusMix: number) {
  const t = collageRevealProgress(focusMix)
  const x = Math.max(0, Math.min(1, (t - 0.45) / 0.5))
  return x * x * (3 - 2 * x)
}

export function collageParticleOpacity(focusMix: number) {
  const t = collageRevealProgress(focusMix)
  const appear = Math.max(0, Math.min(1, t / 0.12))
  const x = Math.max(0, Math.min(1, (t - 0.12) / 0.66))
  return appear * 0.8 * (1 - x * x * (3 - 2 * x))
}
