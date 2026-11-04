import { expect, it } from 'vitest'
import { Vector3 } from 'three'
import { calculateMoonReflectionTrack } from './waterMaterial'
import { getMoonFrameTintStrength, getMoonPhotoIllumination } from './moonLighting'

it('gives moon-facing photo surfaces a soft directional cool fill and keeps back faces dimmer', () => {
  const normal = new Vector3(0, 0, 1)
  expect(getMoonPhotoIllumination(normal, new Vector3(0, 0, 1), 1.5)).toBeCloseTo(0.285)
  expect(getMoonPhotoIllumination(normal, new Vector3(0, 0, -1), 1.5)).toBeCloseTo(0.105)
  expect(getMoonPhotoIllumination(normal, new Vector3(0, 0, 1), 8)).toBeLessThanOrEqual(0.32)
})

it('keeps the world-space reflection track finite when the moon aim has no length', () => {
  const point = { x: 0.2, y: 16, z: -126 }
  const track = calculateMoonReflectionTrack(point, point, -2.35)

  expect(track.length).toBeGreaterThan(0)
  expect(track.origin.every(Number.isFinite)).toBe(true)
  expect(track.direction.every(Number.isFinite)).toBe(true)
  expect(Number.isFinite(track.hotspot)).toBe(true)
})

it('keeps the frame tint subtle and bounded by directional moon fill', () => {
  expect(getMoonFrameTintStrength(0)).toBe(0)
  expect(getMoonFrameTintStrength(0.105)).toBeCloseTo(0.0252)
  expect(getMoonFrameTintStrength(0.32)).toBeLessThanOrEqual(0.08)
})
