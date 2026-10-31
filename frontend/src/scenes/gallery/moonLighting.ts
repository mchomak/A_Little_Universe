import type { Vector3 } from 'three'

const REFLECTION_DEPTH_EPSILON = 1e-4

/** Low-cost diffuse wrap for self-lit photo prints, directed by their world normal and the moon position. */
export function getMoonPhotoIllumination(surfaceNormal: Vector3, toMoon: Vector3, intensity: number) {
  const normalLength = surfaceNormal.length()
  const lightLength = toMoon.length()
  if (!Number.isFinite(intensity) || intensity <= 0 || normalLength < 1e-4 || lightLength < 1e-4) return 0
  const directional = Math.max(-1, Math.min(1, surfaceNormal.dot(toMoon) / (normalLength * lightLength)))
  const wrappedDiffuse = Math.max(0, Math.min(1, (directional + 0.2) / 1.2))
  return Math.min(0.32, 0.03 + Math.min(3, intensity) * (0.05 + wrappedDiffuse * 0.12))
}

/** A zero span tells the reflection shader to keep the path centered without dividing by zero. */
export function getMoonReflectionDepthSpan(sourceZ: number, targetZ: number) {
  const span = targetZ - sourceZ
  return Number.isFinite(span) && Math.abs(span) >= REFLECTION_DEPTH_EPSILON ? span : 0
}

/** Preserve warm frame emission while allowing at most a restrained cool lunar tint. */
export function getMoonFrameTintStrength(illumination: number) {
  if (!Number.isFinite(illumination) || illumination <= 0) return 0
  return Math.min(0.08, illumination * 0.25)
}
