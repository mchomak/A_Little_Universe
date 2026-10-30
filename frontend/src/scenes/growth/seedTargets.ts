/** Deterministic, seeded targets for a gently irregular 3D seed volume. */
export function createSeedTargets(count: number, seed: number, freeFraction: number): Float32Array {
  const safeCount = Math.max(0, Math.floor(count))
  const targets = new Float32Array(safeCount * 4)
  const random = randomSource(seed)

  for (let index = 0; index < safeCount; index += 1) {
    const offset = index * 4
    const directionY = random() * 2 - 1
    const angle = random() * Math.PI * 2
    const isSurface = random() < 0.82
    const radial = isSurface ? 0.93 + random() * 0.07 : Math.cbrt(random()) * 0.9
    const vertical = directionY * radial
    const crossSection = Math.sqrt(Math.max(0, 1 - directionY * directionY)) * radial
    const y = vertical * 0.76
    const organicWidth = 1 + vertical * 0.055 + Math.sin(vertical * 4.2 + 0.35) * 0.035

    targets[offset] = Math.cos(angle) * crossSection * 0.37 * organicWidth
      + Math.sin((vertical + 1) * Math.PI * 0.5) * 0.035
    targets[offset + 1] = y
    targets[offset + 2] = Math.sin(angle) * crossSection * 0.31 * (1 - vertical * 0.035)
    targets[offset + 3] = random() < clamp(freeFraction, 0, 0.2) ? 0 : 1
  }
  return targets
}

export function createSeedInitialState(count: number, seed: number, cloudRadius: number) {
  const safeCount = Math.max(0, Math.floor(count))
  const positions = new Float32Array(safeCount * 4)
  const velocities = new Float32Array(safeCount * 4)
  const random = randomSource(seed)
  for (let index = 0; index < safeCount; index += 1) {
    const offset = index * 4
    const directionY = random() * 2 - 1
    const angle = random() * Math.PI * 2
    const horizontal = Math.sqrt(Math.max(0, 1 - directionY * directionY))
    const directionX = horizontal * Math.cos(angle)
    const directionZ = horizontal * Math.sin(angle)
    const radius = Math.max(0.05, cloudRadius) * 0.35 * Math.cbrt(random())
    const speed = 0.3 + random() * 0.75
    positions[offset] = directionX * radius
    positions[offset + 1] = directionY * radius
    positions[offset + 2] = directionZ * radius
    positions[offset + 3] = 1
    velocities[offset] = directionX * speed
    velocities[offset + 1] = directionY * speed
    velocities[offset + 2] = directionZ * speed
    velocities[offset + 3] = random()
  }
  return { positions, velocities }
}

export function createSeedParticleReferences(count: number, side: number) {
  const positions = new Float32Array(count * 3)
  const references = new Float32Array(count * 2)
  for (let index = 0; index < count; index += 1) {
    references[index * 2] = ((index % side) + 0.5) / side
    references[index * 2 + 1] = (Math.floor(index / side) + 0.5) / side
  }
  return { positions, references }
}

function randomSource(seed: number): () => number {
  let state = (Number.isFinite(seed) ? Math.floor(seed) : 1) >>> 0
  if (state === 0) state = 0x6d2b79f5
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min
}
