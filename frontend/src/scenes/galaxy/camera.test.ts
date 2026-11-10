import { expect, it } from 'vitest'
import { galaxyCameraPose, getPlanetariumHandoffProgressAtTime, getPlanetariumHandoffStartTime, interpolateCameraPose } from './camera'

it('creates a standalone three-quarter camera shot and a smooth pullback target', () => {
  const start = galaxyCameraPose(6.4, 0.18, 0.2, -0.1)
  const end = galaxyCameraPose(21.5, 0.52, 0.2, -0.1)
  const middle = interpolateCameraPose(start, end, 0.5)
  expect(start.z).toBeGreaterThan(6)
  expect(end.z).toBeGreaterThan(start.z)
  expect(end.y).toBeGreaterThan(start.y)
  expect(middle.z).toBeGreaterThan(start.z)
  expect(middle.z).toBeLessThan(end.z)
  expect(interpolateCameraPose(start, end, 0)).toEqual(start)
  expect(interpolateCameraPose(start, end, 1)).toEqual(end)
})

it('frames the settled galaxy from approximately 45 degrees above its plane', () => {
  const end = galaxyCameraPose(16, Math.PI / 4, 0, 0)
  expect(end.y).toBeCloseTo(end.z, 10)
})

it('starts the galaxy handoff at the shared scene-clock entry time', () => {
  expect(getPlanetariumHandoffProgressAtTime(10, 10, 10)).toBe(0)
  expect(getPlanetariumHandoffProgressAtTime(15, 10, 10)).toBe(0.5)
  expect(getPlanetariumHandoffProgressAtTime(20, 10, 10)).toBe(1)
})

it('uses the gallery handoff entry time while the shared runtime still has the gallery value', () => {
  expect(getPlanetariumHandoffStartTime(true, 10, 0)).toBe(10)
  expect(getPlanetariumHandoffStartTime(false, 10, 14)).toBe(14)
})
