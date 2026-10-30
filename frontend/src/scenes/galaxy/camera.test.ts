import { expect, it } from 'vitest'
import { galaxyCameraPose, interpolateCameraPose } from './camera'

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
