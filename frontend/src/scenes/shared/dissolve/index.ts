export interface DissolveStyle {
  readonly seed: number
  readonly noiseScale: number
  readonly noiseStrength: number
  readonly edgeWidth: number
  readonly edgeIntensity: number
  readonly edgeColor: readonly [number, number, number]
}

export const DEFAULT_DISSOLVE_STYLE: DissolveStyle = Object.freeze({
  seed: 0,
  noiseScale: 28,
  noiseStrength: 0.82,
  edgeWidth: 0.018,
  edgeIntensity: 0.24,
  edgeColor: Object.freeze([1, 0.76, 0.67]) as readonly [number, number, number],
})

export function normalizeDissolveStyle(input: Partial<DissolveStyle> = {}): DissolveStyle {
  const channel = (value: number | undefined, fallback: number) => bounded(value, 0, 1, fallback)
  const color = input.edgeColor
  return Object.freeze({
    seed: Number.isFinite(input.seed) ? Math.trunc(input.seed!) | 0 : DEFAULT_DISSOLVE_STYLE.seed,
    noiseScale: bounded(input.noiseScale, 1, 256, DEFAULT_DISSOLVE_STYLE.noiseScale),
    noiseStrength: bounded(input.noiseStrength, 0, 1, DEFAULT_DISSOLVE_STYLE.noiseStrength),
    edgeWidth: bounded(input.edgeWidth, 0.001, 0.12, DEFAULT_DISSOLVE_STYLE.edgeWidth),
    edgeIntensity: bounded(input.edgeIntensity, 0, 0.45, DEFAULT_DISSOLVE_STYLE.edgeIntensity),
    edgeColor: Object.freeze([
      channel(color?.[0], DEFAULT_DISSOLVE_STYLE.edgeColor[0]),
      channel(color?.[1], DEFAULT_DISSOLVE_STYLE.edgeColor[1]),
      channel(color?.[2], DEFAULT_DISSOLVE_STYLE.edgeColor[2]),
    ]) as readonly [number, number, number],
  })
}

/** Smooth seeded value noise, shared by CPU sampling and the matching GLSL snippet. */
export function sampleDissolveNoise(x: number, y: number, style: DissolveStyle): number {
  const px = finite(x) * style.noiseScale
  const py = finite(y) * style.noiseScale
  const ix = Math.floor(px), iy = Math.floor(py)
  const sx = smooth(px - ix), sy = smooth(py - iy)
  const a = mix(hash(ix, iy, style.seed), hash(ix + 1, iy, style.seed), sx)
  const b = mix(hash(ix, iy + 1, style.seed), hash(ix + 1, iy + 1, style.seed), sx)
  return mix(a, b, sy)
}

/** Offset a measured grapheme zone within its own interval to create noisy letterwise islands. */
export function getDissolveThreshold(zone: number, noise: number, zoneWidth: number, style: DissolveStyle): number {
  const base = bounded(zone, 0, 1, 0)
  const sample = bounded(noise, 0, 1, 0.5)
  const width = bounded(zoneWidth, 0, 1, 0)
  return bounded(base + (sample - 0.5) * width * style.noiseStrength, 0, 1 - style.edgeWidth, base)
}

/** Film-local time at which one atlas texel crosses its seeded, per-grapheme dissolve threshold. */
export function getDissolveEmissionTime(zone: number, noise: number, zoneWidth: number, start: number, duration: number, style: DissolveStyle): number {
  return finite(start) + Math.max(0, finite(duration)) * getDissolveThreshold(zone, noise, zoneWidth, style)
}

/** Bounded seeded-particle lifetime, capped by the remaining scene window. */
export function getDissolveParticleLifetime(travelDuration: number, variation: number, remainingDuration: number): number {
  const travel = Math.max(0.1, finite(travelDuration))
  const variance = bounded(variation, 0, 1, 0)
  const remaining = Math.max(0, finite(remainingDuration))
  return Math.min(travel * (0.73 + variance * 0.42), remaining)
}

/** Fraction of a stroke erased at film-local progress, with a soft transition around the noisy edge. */
export function getDissolveReveal(progress: number, threshold: number, edgeWidth: number): number {
  const width = bounded(edgeWidth, 0.001, 0.5, DEFAULT_DISSOLVE_STYLE.edgeWidth)
  const amount = bounded((finite(progress) - finite(threshold) + width) / (width * 2), 0, 1, 0)
  return smooth(amount)
}

/** Restrained emissive response centered on the active dissolve threshold. */
export function getDissolveEdge(progress: number, threshold: number, style: DissolveStyle): number {
  const width = Math.max(0.001, style.edgeWidth)
  const distance = (finite(progress) - finite(threshold)) / width
  return style.edgeIntensity * Math.exp(-distance * distance)
}

/** GLSL counterparts for the pure helpers above; safe to interpolate into an R3F shader. */
export const DISSOLVE_GLSL = /* glsl */ `
float dissolveHash(vec2 point, float seed) {
  return fract(sin(dot(point, vec2(127.1, 311.7)) + seed * 74.7) * 43758.5453);
}
float dissolveNoise(vec2 uv, float seed, float scale) {
  vec2 point = uv * scale;
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);
  float lower = mix(dissolveHash(cell, seed), dissolveHash(cell + vec2(1.0, 0.0), seed), local.x);
  float upper = mix(dissolveHash(cell + vec2(0.0, 1.0), seed), dissolveHash(cell + vec2(1.0, 1.0), seed), local.x);
  return mix(lower, upper, local.y);
}
float dissolveThreshold(float zone, float noiseValue, float zoneWidth, float noiseStrength, float edgeWidth) {
  return clamp(zone + (noiseValue - 0.5) * zoneWidth * noiseStrength, 0.0, 1.0 - edgeWidth);
}
float dissolveReveal(float progress, float threshold, float edgeWidth) {
  float width = max(edgeWidth, 0.001);
  return smoothstep(threshold - width, threshold + width, progress);
}
float dissolveEdge(float progress, float threshold, float edgeWidth, float intensity) {
  float edgeDistance = (progress - threshold) / max(edgeWidth, 0.001);
  return exp(-edgeDistance * edgeDistance) * intensity;
}
float dissolveParticleLifetime(float travelDuration, float variation, float remainingDuration) {
  return min(max(0.1, travelDuration) * (0.73 + clamp(variation, 0.0, 1.0) * 0.42), max(0.0, remainingDuration));
}
`

function hash(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return value - Math.floor(value)
}

function bounded(value: number | undefined, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value!)) : fallback
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function smooth(value: number): number {
  return value * value * (3 - 2 * value)
}

function mix(a: number, b: number, progress: number): number {
  return a + (b - a) * progress
}
