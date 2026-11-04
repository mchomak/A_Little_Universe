const PHOTO_CELL_MIN_RESOLUTION = 112
const PHOTO_CELL_MAX_RESOLUTION = 640
const PHOTO_CELL_INFLUENCE = 0.55
const PHOTO_ALPHA_START = 0.35
const PHOTO_REVEAL_FEATHER = 0.026

export interface ProgressivePhotoRevealState {
  readonly progress: number
  readonly cellResolution: number
  readonly cellInfluence: number
  readonly alpha: number
}

function clamp01(value: number, fallback = 0) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : fallback))
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(0.000001, edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function glslFloat(value: number) {
  return Number.isInteger(value) ? `${value}.0` : String(value)
}

/** Pure CPU counterpart of the shared GLSL photo-cell refinement curve. */
export function progressivePhotoRevealState(progress: number): ProgressivePhotoRevealState {
  const value = clamp01(progress)
  return {
    progress: value,
    cellResolution: PHOTO_CELL_MIN_RESOLUTION + (PHOTO_CELL_MAX_RESOLUTION - PHOTO_CELL_MIN_RESOLUTION) * value,
    cellInfluence: 4 * value * (1 - value) * PHOTO_CELL_INFLUENCE,
    alpha: PHOTO_ALPHA_START + (1 - PHOTO_ALPHA_START) * value,
  }
}

/** Generic center-out arrival order with a restrained irregular edge, independent of portrait landmarks. */
export function getProgressivePhotoRevealArrivalOrder(u: number, v: number, aspect = 1) {
  const safeU = Number.isFinite(u) ? Math.max(0, Math.min(1, u)) : 0.5
  const safeV = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const maxRadius = Math.hypot(safeAspect * 0.5, 0.5)
  const dx = (safeU - 0.5) * safeAspect
  const dy = safeV - 0.5
  const radius = Math.hypot(dx, dy) / Math.max(0.001, maxRadius)
  const angle = Math.atan2(dy, dx)
  const wave = (
    Math.sin(angle * 9 + 0.7) * 0.014
    + Math.sin(angle * 21 - 0.6) * 0.007
    + Math.sin(safeU * 82 + Math.sin(safeV * 59)) * 0.003
  ) * smoothstep(0.02, 1, radius)
  return clamp01(radius + wave)
}

/** Build a compact grayscale arrival map sampled by both photo and particle shaders. */
export function createProgressivePhotoRevealMap(size = 128, aspect = 1) {
  const edge = Number.isFinite(size) ? Math.max(2, Math.min(512, Math.floor(size))) : 128
  const data = new Uint8Array(edge * edge)
  for (let y = 0; y < edge; y += 1) for (let x = 0; x < edge; x += 1) {
    const u = (x + 0.5) / edge
    // DataTexture.flipY is false: row zero corresponds to shader v=0.
    const v = (y + 0.5) / edge
    data[y * edge + x] = Math.round(getProgressivePhotoRevealArrivalOrder(u, v, aspect) * 255)
  }
  return data
}

/** CPU mirror of the soft photo coverage shared with the particle dissolve. */
export function getProgressivePhotoRevealCoverage(progress: number, arrivalOrder: number) {
  const reveal = clamp01(progress)
  const arrival = clamp01(arrivalOrder, 1)
  if (reveal <= 0) return 0
  if (reveal >= 1) return 1
  return 1 - smoothstep(reveal - PHOTO_REVEAL_FEATHER, reveal + PHOTO_REVEAL_FEATHER, arrival)
}

/** Particles remain visible ahead of the same soft front that reveals the original photo. */
export function getProgressivePhotoParticleOpacity(progress: number, arrivalOrder: number) {
  return 1 - getProgressivePhotoRevealCoverage(progress, arrivalOrder)
}

/** Expects the calling shader to declare `uPhoto` and `uRevealMap` samplers. */
export const progressivePhotoRevealGLSL = `
vec3 progressivePhotoCellColor(vec2 uv, float progress, vec3 original) {
  float reveal = clamp(progress, 0.0, 1.0);
  float cells = mix(${glslFloat(PHOTO_CELL_MIN_RESOLUTION)}, ${glslFloat(PHOTO_CELL_MAX_RESOLUTION)}, reveal);
  vec2 cellUv = (floor(uv * cells) + 0.5) / cells;
  vec3 pixel = texture2D(uPhoto, cellUv).rgb;
  float front = 4.0 * reveal * (1.0 - reveal);
  return mix(original, pixel, front * ${glslFloat(PHOTO_CELL_INFLUENCE)});
}

float progressivePhotoRevealAlpha(float progress) {
  float reveal = clamp(progress, 0.0, 1.0);
  return mix(${glslFloat(PHOTO_ALPHA_START)}, 1.0, reveal);
}

float progressivePhotoRevealCoverage(float progress, float arrival) {
  float reveal = clamp(progress, 0.0, 1.0);
  if (reveal <= 0.0) return 0.0;
  if (reveal >= 1.0) return 1.0;
  float feather = ${glslFloat(PHOTO_REVEAL_FEATHER)};
  return 1.0 - smoothstep(reveal - feather, reveal + feather, clamp(arrival, 0.0, 1.0));
}

float progressivePhotoParticleOpacity(float progress, float arrival) {
  return 1.0 - progressivePhotoRevealCoverage(progress, arrival);
}
`
