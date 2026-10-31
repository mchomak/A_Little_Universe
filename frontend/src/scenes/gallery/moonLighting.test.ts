import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { Vector3 } from 'three'
import { getMoonFrameTintStrength, getMoonPhotoIllumination, getMoonReflectionDepthSpan } from './moonLighting'

it('gives moon-facing photo surfaces a soft directional cool fill and keeps back faces dimmer', () => {
  const normal = new Vector3(0, 0, 1)
  expect(getMoonPhotoIllumination(normal, new Vector3(0, 0, 1), 1.5)).toBeCloseTo(0.285)
  expect(getMoonPhotoIllumination(normal, new Vector3(0, 0, -1), 1.5)).toBeCloseTo(0.105)
  expect(getMoonPhotoIllumination(normal, new Vector3(0, 0, 1), 8)).toBeLessThanOrEqual(0.32)
})

it('collapses a coincident reflection depth span to a finite shader fallback', () => {
  expect(getMoonReflectionDepthSpan(-126, -126)).toBe(0)
  expect(getMoonReflectionDepthSpan(-126, -125.99999)).toBe(0)
  expect(getMoonReflectionDepthSpan(-126, -34)).toBe(92)
  const wetFloorShader = readFileSync(new URL('./WetFloor.tsx', import.meta.url), 'utf8')
  expect(wetFloorShader).toContain('abs(uMoonDepthSpan) < 0.0001 ? 0.5')
})

it('keeps the frame tint subtle and bounded by directional moon fill', () => {
  expect(getMoonFrameTintStrength(0)).toBe(0)
  expect(getMoonFrameTintStrength(0.105)).toBeCloseTo(0.0252)
  expect(getMoonFrameTintStrength(0.32)).toBeLessThanOrEqual(0.08)
})
