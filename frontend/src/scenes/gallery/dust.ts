import { BufferAttribute, BufferGeometry } from 'three'

const MAX_GALLERY_DUST = 600
const LOW_QUALITY_SCALE = 0.44

/** Keeps standard dust at the requested count while reducing work for low quality or reduced motion. */
export function getGalleryDustCount(configuredCount: number, lowQuality: boolean, reducedMotion: boolean) {
  const bounded = Number.isFinite(configuredCount) ? Math.max(0, Math.min(MAX_GALLERY_DUST, Math.round(configuredCount))) : 220
  return lowQuality || reducedMotion ? Math.round(bounded * LOW_QUALITY_SCALE) : bounded
}

function randomFor(index: number, salt: number) {
  const value = Math.sin((index + salt) * 127.1) * 43758.5453
  return value - Math.floor(value)
}

/** Samples seeded warm and moon-silver dust across near, middle, and far world-space depths. */
export function createGalleryDustGeometry(requestedCount: number) {
  const count = Number.isFinite(requestedCount) ? Math.max(0, Math.min(MAX_GALLERY_DUST, Math.round(requestedCount))) : 220
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const phases = new Float32Array(count)
  const speeds = new Float32Array(count)
  const alphas = new Float32Array(count)
  const drift = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const palette = [
    [0.94, 0.85, 0.72], // warm pearl
    [0.84, 0.70, 0.56], // champagne
    [0.72, 0.78, 0.87], // moon silver
  ] as const

  for (let i = 0; i < count; i++) {
    const layer = i % 3
    const depthNoise = randomFor(i, 1)
    const x = (randomFor(i, 2) - 0.5) * 19
    const y = (randomFor(i, 3) - 0.5) * 10
    const z = layer === 0 ? 1.5 - depthNoise * 14 : layer === 1 ? -14 - depthNoise * 22 : -38 - depthNoise * 40
    positions.set([x, y, z], i * 3)
    sizes[i] = layer === 0 ? 0.032 + randomFor(i, 4) * 0.022 : layer === 1 ? 0.022 + randomFor(i, 4) * 0.018 : 0.014 + randomFor(i, 4) * 0.012
    phases[i] = randomFor(i, 5) * Math.PI * 2
    speeds[i] = layer === 0 ? 0.055 + randomFor(i, 6) * 0.035 : layer === 1 ? 0.028 + randomFor(i, 6) * 0.024 : 0.008 + randomFor(i, 6) * 0.014
    alphas[i] = layer === 0 ? 0.075 + randomFor(i, 7) * 0.075 : layer === 1 ? 0.05 + randomFor(i, 7) * 0.065 : 0.024 + randomFor(i, 7) * 0.038
    drift.set([
      (layer === 0 ? 0.06 : layer === 1 ? 0.035 : 0.01) + randomFor(i, 8) * 0.035,
      (layer === 0 ? 0.05 : layer === 1 ? 0.028 : 0.008) + randomFor(i, 9) * 0.03,
      (layer === 0 ? 0.035 : layer === 1 ? 0.02 : 0.006) + randomFor(i, 10) * 0.022,
    ], i * 3)
    colors.set(palette[Math.floor(randomFor(i, 11) * palette.length)]!, i * 3)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('size', new BufferAttribute(sizes, 1))
  geometry.setAttribute('phase', new BufferAttribute(phases, 1))
  geometry.setAttribute('speed', new BufferAttribute(speeds, 1))
  geometry.setAttribute('particleAlpha', new BufferAttribute(alphas, 1))
  geometry.setAttribute('drift', new BufferAttribute(drift, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}
