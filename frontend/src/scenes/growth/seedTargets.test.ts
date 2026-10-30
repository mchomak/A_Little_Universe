import { expect, it } from 'vitest'
import { createSeedInitialState, createSeedTargets } from './seedTargets'

it('creates a repeatable volumetric seed target with a sparse free-particle tail', () => {
  const first = createSeedTargets(1024, 8142, 0.08)
  const replay = createSeedTargets(1024, 8142, 0.08)
  expect(first).toEqual(replay)
  expect(first).toHaveLength(4096)

  let surface = 0
  let interior = 0
  let free = 0
  for (let index = 0; index < 1024; index += 1) {
    const offset = index * 4
    const x = first[offset] ?? 0, y = first[offset + 1] ?? 0, z = first[offset + 2] ?? 0
    const normalizedRadius = Math.hypot(x / 0.37, y / 0.76, z / 0.31)
    expect(Number.isFinite(normalizedRadius)).toBe(true)
    expect(Math.abs(x)).toBeLessThan(0.43)
    expect(Math.abs(y)).toBeLessThan(0.78)
    expect(Math.abs(z)).toBeLessThan(0.34)
    if (normalizedRadius > 0.78) surface += 1
    if (normalizedRadius < 0.62) interior += 1
    if (first[offset + 3] === 0) free += 1
    else expect(first[offset + 3]).toBe(1)
  }
  expect(surface).toBeGreaterThan(560)
  expect(interior).toBeGreaterThan(25)
  expect(free).toBeGreaterThan(50)
  expect(free).toBeLessThan(120)
})

it('starts seeded particles as a compact three-dimensional cloud with individual outward drift', () => {
  const first = createSeedInitialState(256, 317, 0.62)
  const replay = createSeedInitialState(256, 317, 0.62)
  expect(first.positions).toEqual(replay.positions)
  expect(first.velocities).toEqual(replay.velocities)
  let movement = 0
  for (let index = 0; index < 256; index += 1) {
    const offset = index * 4
    const radius = Math.hypot(first.positions[offset] ?? 0, first.positions[offset + 1] ?? 0, first.positions[offset + 2] ?? 0)
    const speed = Math.hypot(first.velocities[offset] ?? 0, first.velocities[offset + 1] ?? 0, first.velocities[offset + 2] ?? 0)
    expect(radius).toBeLessThan(0.23)
    expect(speed).toBeGreaterThan(0.3)
    expect(speed).toBeLessThan(1.1)
    if (Math.abs(first.velocities[offset + 2] ?? 0) > 0.05) movement += 1
  }
  expect(movement).toBeGreaterThan(180)
})
