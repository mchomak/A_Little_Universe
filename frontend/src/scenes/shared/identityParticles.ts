/**
 * Stable scene-local points. A future scene-03 adapter can provide cached surface
 * samples from the exact open GLB; no mesh or browser/GPU resource changes owner here.
 * `sample` returns identity-scene root coordinates in film world units. The source is
 * queried once during buffer construction; returned positions are copied into owned
 * geometry attributes, so the adapter retains no per-frame or GPU resource lifetime.
 */
export interface LilyParticleSource {
  sample(index: number, count: number): [number, number, number]
}

/** Temporary procedural-lily positions, deterministic across seek and re-entry. */
export const mockLilyParticles: LilyParticleSource = {
  sample(index, count) {
    const t = index / count
    const angle = index * 2.399963
    const radius = Math.sqrt(t) * 1.1
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(angle * 2.4) * 0.32]
  },
}

export interface IdentityParticleData {
  origin: Float32Array
  cloud: Float32Array
  portrait: Float32Array
  seed: Float32Array
  luminance: Float32Array
  reveal: Float32Array
}

function random(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453
  return value - Math.floor(value)
}

/**
 * Build repeatable source to loose cloud to photo-plane targets.
 * Pixel data is sampled in its original crop; image bytes are never transformed.
 */
export function createIdentityParticleData(
  count: number,
  source: LilyParticleSource,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): IdentityParticleData {
  if (!Number.isInteger(count) || count < 1 || width < 2 || height < 2 || pixels.length < width * height * 4) {
    throw new RangeError('Identity particles need a positive count and a complete RGBA image')
  }

  const origin = new Float32Array(count * 3)
  const cloud = new Float32Array(count * 3)
  const portrait = new Float32Array(count * 3)
  const seed = new Float32Array(count)
  const luminance = new Float32Array(count)
  const reveal = new Float32Array(count)

  for (let index = 0; index < count; index++) {
    const offset = index * 3
    const x = Math.floor(random(index, 1) * width)
    const y = Math.floor(random(index, 2) * height)
    const pixel = (y * width + x) * 4
    const red = pixels[pixel] ?? 0
    const green = pixels[pixel + 1] ?? red
    const blue = pixels[pixel + 2] ?? red
    const light = (red * .2126 + green * .7152 + blue * .0722) / 255
    const u = x / (width - 1)
    const v = 1 - y / (height - 1)
    const targetX = (u - .5) * 2.15
    const targetY = (0.5 - y / (height - 1)) * 2.15 + .08
    const targetZ = (random(index, 3) - .5) * .035
    const looseness = .35 + random(index, 4) * .52
    const angle = random(index, 5) * Math.PI * 2
    const point = source.sample(index, count)

    origin.set(point, offset)
    cloud.set([
      targetX + Math.cos(angle) * looseness,
      targetY + Math.sin(angle) * looseness,
      .04 + (random(index, 6) - .5) * .24,
    ], offset)
    portrait.set([targetX, targetY, targetZ], offset)
    seed[index] = random(index, 7)
    luminance[index] = light
    // The reveal begins near the face and hair, then opens across the photo plane.
    reveal[index] = Math.hypot((u - .59) / .62, (v - .62) / .66)
  }

  return { origin, cloud, portrait, seed, luminance, reveal }
}
