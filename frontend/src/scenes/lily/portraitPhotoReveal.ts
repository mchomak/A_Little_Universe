import type { ParticlePortraitSettings } from '../../particle-portrait-lab/config'
import { placeLilyPortraitTargets } from './portraitIntegration'
import type { PortraitCameraBasis } from './portraitTargets'
import type { StarPortraitPoint } from './starPortraitTargets'

/** Returns the latest assigned route landing using the braking value consumed by the particle shader. */
export function getLilyPortraitPhotoLastArrivalTime(
  portraitMotion: ArrayLike<number>,
  portraitRoutes: ArrayLike<number>,
  braking: number,
) {
  const safeBraking = Number.isFinite(braking) ? Math.min(2, Math.max(0.25, braking)) : 1
  const count = Math.min(portraitRoutes.length, Math.floor(portraitMotion.length / 4))
  let latestArrival = 0

  for (let index = 0; index < count; index += 1) {
    if ((portraitRoutes[index] ?? 0) <= 0.5) continue
    const offset = index * 4
    const launch = portraitMotion[offset] ?? 0
    const travel = portraitMotion[offset + 1] ?? 0
    if (!Number.isFinite(launch) || !Number.isFinite(travel)) continue
    latestArrival = Math.max(latestArrival, launch + Math.max(0.05, travel * safeBraking))
  }

  return latestArrival
}

export const LILY_PORTRAIT_PHOTO_PAUSE_SECONDS = 0.85
export const LILY_PORTRAIT_PHOTO_REVEAL_SECONDS = 3.2
export const LILY_PORTRAIT_PHOTO_FINAL_HOLD_SECONDS = 1.25
export const LILY_PORTRAIT_PHOTO_DEPTH_OFFSET = 0.012

/** An absolute-time reveal clock stays reversible under pause, seek, resize and replay. */
export function getLilyPortraitPhotoRevealProgress(
  time: number,
  lastArrival: number,
  pause = LILY_PORTRAIT_PHOTO_PAUSE_SECONDS,
  duration = LILY_PORTRAIT_PHOTO_REVEAL_SECONDS,
) {
  const sceneTime = Number.isFinite(time) ? Math.max(0, time) : 0
  const arrival = Number.isFinite(lastArrival) ? Math.max(0, lastArrival) : 0
  const pauseDuration = Number.isFinite(pause) ? Math.max(0, pause) : LILY_PORTRAIT_PHOTO_PAUSE_SECONDS
  const revealDuration = Number.isFinite(duration) ? Math.max(0, duration) : LILY_PORTRAIT_PHOTO_REVEAL_SECONDS
  const revealStart = arrival + pauseDuration
  if (sceneTime <= revealStart) return 0
  if (revealDuration === 0) return 1
  return Math.min(1, Math.max(0, (sceneTime - revealStart) / revealDuration))
}

/** Late geometry or texture readiness restarts the pause from the visible route's latest available time. */
export function getLilyPortraitPhotoRevealAnchor(lastArrival: number, readyAt: number) {
  const arrival = Number.isFinite(lastArrival) ? Math.max(0, lastArrival) : 0
  const ready = Number.isFinite(readyAt) ? Math.max(0, readyAt) : 0
  return Math.max(arrival, ready)
}

/** Already prepared resources are available from the beginning of a replay pass. */
export function getLilyPortraitPhotoRevealAnchorForReplay(lastArrival: number) {
  return getLilyPortraitPhotoRevealAnchor(lastArrival, 0)
}

/** Keep an in-progress absolute reveal stable; before it begins, use the replacement geometry's latest anchor. */
export function getLilyPortraitPhotoStableRevealAnchor(previousAnchor: number, candidateAnchor: number, time: number) {
  const previous = Number.isFinite(previousAnchor) ? Math.max(0, previousAnchor) : 0
  const candidate = Number.isFinite(candidateAnchor) ? Math.max(0, candidateAnchor) : previous
  return getLilyPortraitPhotoRevealProgress(time, previous) > 0 ? previous : candidate
}

// The authored point is measured from the image top; convert it to Three.js UV v from the bottom.
const PORTRAIT_FACE_CENTER: readonly [number, number] = [0.615, 1 - 0.355]

/** A single irregular radial front runs from the approved portrait's face UV toward every edge. */
export function getLilyPortraitPhotoRevealArrivalOrder(u: number, v: number, aspect = 1) {
  const safeU = Number.isFinite(u) ? Math.min(1, Math.max(0, u)) : 0.5
  const safeV = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const maxRadius = Math.max(...[
    [0, 0], [1, 0], [0, 1], [1, 1],
  ].map(([cornerU, cornerV]) => Math.hypot((cornerU! - PORTRAIT_FACE_CENTER[0]) * safeAspect, cornerV! - PORTRAIT_FACE_CENTER[1])))
  const dx = (safeU - PORTRAIT_FACE_CENTER[0]) * safeAspect
  const dy = safeV - PORTRAIT_FACE_CENTER[1]
  const radius = Math.hypot(dx, dy) / Math.max(0.001, maxRadius)
  const angle = Math.atan2(dy, dx)
  const wave = Math.sin(angle * 9 + 0.7) * 0.014
    + Math.sin(angle * 21 - 0.6) * 0.007
    + Math.sin(safeU * 82 + Math.sin(safeV * 59)) * 0.003
  return Math.min(1, Math.max(0, radius + wave))
}

/** Build once as a tiny grayscale DataTexture; only the shader's scalar progress changes per frame. */
export function createLilyPortraitPhotoRevealMap(size = 256, aspect = 1) {
  const edge = Number.isFinite(size) ? Math.max(2, Math.floor(size)) : 256
  const data = new Uint8Array(edge * edge)
  for (let y = 0; y < edge; y += 1) for (let x = 0; x < edge; x += 1) {
    const u = (x + 0.5) / edge
    // DataTexture.flipY defaults to false, so row zero is the shader's v=0 edge.
    const v = (y + 0.5) / edge
    data[y * edge + x] = Math.round(getLilyPortraitPhotoRevealArrivalOrder(u, v, aspect) * 255)
  }
  return data
}

/** CPU mirror of the fragment alpha so tests can verify spatial progression without a WebGL context. */
export function getLilyPortraitPhotoMaskAlpha(progress: number, arrivalOrder: number) {
  const reveal = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  const arrival = Number.isFinite(arrivalOrder) ? Math.min(1, Math.max(0, arrivalOrder)) : 1
  if (reveal <= 0) return 0
  if (reveal >= 1) return 1
  const feather = 0.026
  const edge = Math.min(1, Math.max(0, (arrival - (reveal - feather)) / (2 * feather)))
  const easedEdge = edge * edge * (3 - 2 * edge)
  return 1 - easedEdge
}

export function getLilyPortraitPhotoRequiredSceneDuration(lastArrival: number) {
  const arrival = Number.isFinite(lastArrival) ? Math.max(0, lastArrival) : 0
  return arrival + LILY_PORTRAIT_PHOTO_PAUSE_SECONDS + LILY_PORTRAIT_PHOTO_REVEAL_SECONDS
    + LILY_PORTRAIT_PHOTO_FINAL_HOLD_SECONDS
}

/** Use the approved portrait placement helper for all photo corners, then put the pixels just behind the particles. */
export function createLilyPortraitPhotoPlaneAttributes(
  basis: PortraitCameraBasis,
  photoAspect: number,
  settings: Pick<ParticlePortraitSettings, 'scale' | 'offsetX' | 'offsetY'>,
) {
  const [topLeft, topRight, bottomLeft, bottomRight] = placeLilyPortraitTargets([
    photoPlaneCorner(0, 0), photoPlaneCorner(1, 0), photoPlaneCorner(0, 1), photoPlaneCorner(1, 1),
  ], photoAspect, basis, settings)
  const behind = (point: readonly [number, number, number]) => [
    point[0] + basis.forward[0] * LILY_PORTRAIT_PHOTO_DEPTH_OFFSET,
    point[1] + basis.forward[1] * LILY_PORTRAIT_PHOTO_DEPTH_OFFSET,
    point[2] + basis.forward[2] * LILY_PORTRAIT_PHOTO_DEPTH_OFFSET,
  ]
  const positions = [topLeft!, bottomLeft!, topRight!, topRight!, bottomLeft!, bottomRight!]
    .flatMap((point) => behind(point))
  return {
    positions: new Float32Array(positions),
    // TextureLoader flips the JPG to the usual Three.js convention: the top image row is v=1.
    uvs: new Float32Array([0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0]),
  }
}

function photoPlaneCorner(u: number, v: number): StarPortraitPoint {
  return { u, v, tone: 0.5, contrast: 0, featureWeight: 0.5, seed: 0.5, photoColorLinear: [1, 1, 1] }
}
