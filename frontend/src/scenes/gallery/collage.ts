import { BufferAttribute, BufferGeometry, DynamicDrawUsage } from 'three'
import type { GalleryLayoutVariant } from './content'

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

export interface CollagePhotoLayoutSettings {
  readonly photoScale?: number
  readonly photoGap?: number
}

const DEFAULT_COLLAGE_PHOTO_SCALE = 0.9
const DEFAULT_COLLAGE_PHOTO_GAP = 0.3

export interface CollageRevealSettings {
  readonly particleCount: number
  readonly particleSize: number
  readonly noiseStrength: number
  readonly depth: number
  readonly glow: number
  readonly assembleDuration: number
  readonly revealDuration: number
  readonly staggerDelay: number
  readonly particleEnabled: boolean
}

export const DEFAULT_COLLAGE_REVEAL_SETTINGS: Readonly<CollageRevealSettings> = Object.freeze({
  particleCount: 640,
  particleSize: 2.6,
  noiseStrength: 0.035,
  depth: 0.42,
  glow: 1,
  assembleDuration: 5,
  revealDuration: 2.5,
  staggerDelay: 0.14,
  particleEnabled: true,
})

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
  settings: Readonly<CollagePhotoLayoutSettings> = {},
  variant: GalleryLayoutVariant = 'on-columns',
): GalleryCollagePhotoLayout {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const photoScale = Math.max(0.5, Math.min(1, Number.isFinite(settings.photoScale) ? settings.photoScale! : DEFAULT_COLLAGE_PHOTO_SCALE))
  const gap = Math.max(0.1, Math.min(1.5, Number.isFinite(settings.photoGap) ? settings.photoGap! : DEFAULT_COLLAGE_PHOTO_GAP))
  const longestEdge = Math.max(mainWidth, mainHeight) * photoScale
  const width = safeAspect >= 1 ? longestEdge : longestEdge * safeAspect
  const height = width / safeAspect
  const wallYaw = -side * 1.15
  const yawSin = Math.sin(wallYaw)
  const outwardDepth = Math.abs(yawSin) > 0.001 ? side * 0.18 / yawSin : 0.035
  if (variant === 'between-columns') {
    // Side-facing cards run along the column rows, so stacking upward keeps posts clear of the photo plane and water.
    const stackBase = mainHeight / 2 + gap
    const precedingSlots = slot - 2
    const verticalOffset = stackBase + precedingSlots * (longestEdge + gap) + longestEdge / 2
    return { position: [0, verticalOffset, outwardDepth], width, height }
  }
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

/** Creates deterministic, texture-sampled particles inside one photo slot. */
export function createCollageRevealGeometry(
  width: number,
  height: number,
  seed: number,
  count = DEFAULT_COLLAGE_REVEAL_SETTINGS.particleCount,
  settings: Pick<CollageRevealSettings, 'depth'> = DEFAULT_COLLAGE_REVEAL_SETTINGS,
) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1
  const safeCount = Math.max(8, Math.min(2400, Math.floor(Number.isFinite(count) ? count : DEFAULT_COLLAGE_REVEAL_SETTINGS.particleCount)))
  const depth = Math.max(0, Math.min(0.8, Number.isFinite(settings.depth) ? settings.depth : DEFAULT_COLLAGE_REVEAL_SETTINGS.depth))
  const positions = new Float32Array(safeCount * 3)
  const targets = new Float32Array(safeCount * 3)
  const sizes = new Float32Array(safeCount)
  const phases = new Float32Array(safeCount)
  const photoUvs = new Float32Array(safeCount * 2)
  const next = random(seed)
  const columns = Math.max(1, Math.ceil(Math.sqrt(safeCount * safeWidth / safeHeight)))
  const rows = Math.ceil(safeCount / columns)

  for (let i = 0; i < safeCount; i++) {
    const u = (i % columns + 0.2 + next() * 0.6) / columns
    const v = (Math.floor(i / columns) + 0.2 + next() * 0.6) / rows
    const targetX = (u - 0.5) * safeWidth
    const targetY = (v - 0.5) * safeHeight
    const startX = (next() - 0.5) * safeWidth * 0.92
    const startY = (next() - 0.5) * safeHeight * 0.92
    const startZ = 0.025 + next() * depth
    photoUvs.set([u, v], i * 2)
    positions.set([startX, startY, startZ], i * 3)
    targets.set([targetX, targetY, 0.025], i * 3)
    sizes[i] = 0.55 + next() * 0.9
    phases[i] = next() * Math.PI * 2
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage))
  geometry.setAttribute('targetPosition', new BufferAttribute(targets, 3))
  geometry.setAttribute('size', new BufferAttribute(sizes, 1))
  geometry.setAttribute('phase', new BufferAttribute(phases, 1))
  geometry.setAttribute('photoUv', new BufferAttribute(photoUvs, 2))
  return geometry
}

export function collageRevealProgress(focusMix: number) {
  return Math.max(0, Math.min(1, Number.isFinite(focusMix) ? focusMix : 0))
}

export interface CollageRevealFrame {
  readonly assemblyProgress: number
  readonly photoProgress: number
  readonly photoOpacity: number
  readonly particleOpacity: number
}

export interface CollageRevealPlayback {
  readonly session: object
  readonly textureReady: boolean
  readonly usingFallback: boolean
  readonly startPending: boolean
  readonly focusedSeconds: number
  readonly elapsedSeconds: number
}

function smoothstep01(value: number) {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function safeTimelineDuration(value: number, fallback: number) {
  return Math.max(0.25, Number.isFinite(value) ? value : fallback)
}

function getCollageRevealStagger(slot: GalleryCollageSlot, settings: Readonly<CollageRevealSettings>, reducedMotion: boolean) {
  const enabled = settings.particleEnabled && !reducedMotion
  return enabled ? (slot - 2) * Math.max(0, Number.isFinite(settings.staggerDelay) ? settings.staggerDelay : DEFAULT_COLLAGE_REVEAL_SETTINGS.staggerDelay) : 0
}

export function createCollageRevealPlayback(session: object): CollageRevealPlayback {
  return { session, textureReady: false, usingFallback: false, startPending: false, focusedSeconds: 0, elapsedSeconds: 0 }
}

/** Resolves only the active URL generation; errors are ready with the caller's fallback image. */
export function markCollageRevealTextureReady(
  playback: CollageRevealPlayback,
  session: object,
  result: 'loaded' | 'error',
): CollageRevealPlayback {
  if (playback.session !== session) return playback
  return { ...playback, textureReady: true, usingFallback: result === 'error', startPending: true }
}

/** Holds reveal time while its matching image is pending and while a slot waits for its stagger. */
export function advanceCollageRevealPlayback(
  playback: CollageRevealPlayback,
  deltaSeconds: number,
  direction: -1 | 0 | 1,
  focusMix: number,
  slot: GalleryCollageSlot,
  settings: Readonly<CollageRevealSettings> = DEFAULT_COLLAGE_REVEAL_SETTINGS,
  reducedMotion = false,
  paused = false,
): CollageRevealPlayback {
  const delta = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0)
  if (paused || delta === 0) return playback

  const stagger = getCollageRevealStagger(slot, settings, reducedMotion)
  const focusedSeconds = direction > 0
    ? playback.focusedSeconds + delta
    : direction < 0 ? Math.max(0, playback.focusedSeconds - delta) : playback.focusedSeconds

  if (!playback.textureReady) return { ...playback, focusedSeconds, elapsedSeconds: 0 }
  if (playback.startPending) return { ...playback, startPending: false }

  let elapsedSeconds = playback.elapsedSeconds
  if (direction > 0) {
    const activeDelta = Math.max(0, focusedSeconds - Math.max(playback.focusedSeconds, stagger))
    if (activeDelta > 0) elapsedSeconds = advanceCollageRevealTimeline(elapsedSeconds, activeDelta, 1, focusMix, 2, settings, reducedMotion)
  } else if (direction < 0 && elapsedSeconds > 0) {
    elapsedSeconds = advanceCollageRevealTimeline(elapsedSeconds, delta, -1, focusMix, 2, settings, reducedMotion)
  }

  return { ...playback, focusedSeconds, elapsedSeconds }
}

/** Converts local post-stagger time into the existing slot-aware frame contract. */
export function getCollageRevealPlaybackFrame(
  playback: CollageRevealPlayback,
  slot: GalleryCollageSlot,
  settings: Readonly<CollageRevealSettings> = DEFAULT_COLLAGE_REVEAL_SETTINGS,
  reducedMotion = false,
) {
  return getCollageRevealFrame(playback.elapsedSeconds + getCollageRevealStagger(slot, settings, reducedMotion), slot, settings, reducedMotion)
}

/** Returns the number of film-clock seconds needed to complete this slot's reveal. */
export function getCollageRevealTimelineDuration(
  slot: GalleryCollageSlot,
  settings: Readonly<CollageRevealSettings> = DEFAULT_COLLAGE_REVEAL_SETTINGS,
  reducedMotion = false,
) {
  const enabled = settings.particleEnabled && !reducedMotion
  const assembleDuration = enabled ? safeTimelineDuration(settings.assembleDuration, DEFAULT_COLLAGE_REVEAL_SETTINGS.assembleDuration) : 0
  const revealDuration = safeTimelineDuration(settings.revealDuration, DEFAULT_COLLAGE_REVEAL_SETTINGS.revealDuration)
  const staggerDelay = enabled ? Math.max(0, Number.isFinite(settings.staggerDelay) ? settings.staggerDelay : DEFAULT_COLLAGE_REVEAL_SETTINGS.staggerDelay) : 0
  return (slot - 2) * staggerDelay + assembleDuration + revealDuration
}

/** Controller focus decays exponentially at 3.8/s and removes its snapshot below 0.001. */
function getFocusReturnSeconds(focusMix: number) {
  const mix = Math.max(0, Math.min(1, Number.isFinite(focusMix) ? focusMix : 0))
  if (mix <= 0.001) return 0
  return Math.log(mix / 0.001) / 3.8
}

/** Advances in film-clock seconds; a return is compressed smoothly to finish before focus unmounts. */
export function advanceCollageRevealTimeline(
  elapsedSeconds: number,
  deltaSeconds: number,
  direction: -1 | 0 | 1,
  focusMix: number,
  slot: GalleryCollageSlot,
  settings: Readonly<CollageRevealSettings> = DEFAULT_COLLAGE_REVEAL_SETTINGS,
  reducedMotion = false,
) {
  const duration = getCollageRevealTimelineDuration(slot, settings, reducedMotion)
  const elapsed = Math.max(0, Math.min(duration, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0))
  const delta = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0)
  if (direction === 0 || delta === 0) return elapsed
  if (direction > 0) return Math.min(duration, elapsed + delta)

  const returnSeconds = getFocusReturnSeconds(focusMix)
  if (returnSeconds <= 0) return 0
  // focusMix already reflects this frame's controller update, so its remaining
  // time starts now; the prior frame had one `delta` more time remaining.
  return elapsed * returnSeconds / (returnSeconds + delta)
}

/** Resolves elapsed film-clock seconds to a reversible, slot-aware particle and photo frame. */
export function getCollageRevealFrame(
  elapsedSeconds: number,
  slot: GalleryCollageSlot,
  settings: Readonly<CollageRevealSettings> = DEFAULT_COLLAGE_REVEAL_SETTINGS,
  reducedMotion = false,
): CollageRevealFrame {
  const enabled = settings.particleEnabled && !reducedMotion
  const assembleDuration = enabled ? safeTimelineDuration(settings.assembleDuration, DEFAULT_COLLAGE_REVEAL_SETTINGS.assembleDuration) : 0
  const revealDuration = safeTimelineDuration(settings.revealDuration, DEFAULT_COLLAGE_REVEAL_SETTINGS.revealDuration)
  const staggerDelay = enabled ? Math.max(0, Number.isFinite(settings.staggerDelay) ? settings.staggerDelay : DEFAULT_COLLAGE_REVEAL_SETTINGS.staggerDelay) : 0
  const elapsed = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0)
  const slotElapsed = Math.max(0, elapsed - (slot - 2) * staggerDelay)
  const assemblyProgress = assembleDuration === 0 ? 1 : Math.max(0, Math.min(1, slotElapsed / assembleDuration))
  const photoProgress = Math.max(0, Math.min(1, (slotElapsed - assembleDuration) / revealDuration))
  const particleArrival = Math.max(0, Math.min(1, slotElapsed / Math.min(0.12, assembleDuration || 0.12)))
  const particleOpacity = enabled ? 0.8 * smoothstep01(particleArrival) : 0

  return {
    assemblyProgress,
    photoProgress,
    photoOpacity: smoothstep01(photoProgress),
    particleOpacity,
  }
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
