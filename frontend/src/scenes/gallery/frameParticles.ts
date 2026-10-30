import { BufferAttribute, BufferGeometry } from 'three'
import { GALLERY_ART } from './artDirection'

function random(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x100000000
  }
}

/** Samples a quiet, deterministic point outline along a rectangular photo frame. */
export function createFrameParticleGeometry(width: number, height: number, seed: number) {
  const frameWidth = width + 0.12
  const frameHeight = height + 0.12
  const halfWidth = frameWidth / 2
  const halfHeight = frameHeight / 2
  const perimeter = 2 * (frameWidth + frameHeight)
  const count = Math.max(32, Math.round(perimeter / GALLERY_ART.frameParticleSpacing))
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 2)
  const sizes = new Float32Array(count)
  const phases = new Float32Array(count)
  const speeds = new Float32Array(count)
  const alphas = new Float32Array(count)
  const mobility = new Float32Array(count)
  const colors = new Float32Array(count * 3)
  const randomForParticle = random(seed + 1)
  const palette = [
    [0.84, 0.88, 0.94], // pearl
    [0.65, 0.70, 0.78], // soft silver
    [0.78, 0.66, 0.62], // very quiet rose gold
  ] as const

  for (let i = 0; i < count; i++) {
    const distance = i / count * perimeter
    let x: number
    let y: number
    let nx: number
    let ny: number
    if (distance < frameWidth) {
      x = -halfWidth + distance; y = halfHeight; nx = 0; ny = 1
    } else if (distance < frameWidth + frameHeight) {
      const along = distance - frameWidth
      x = halfWidth; y = halfHeight - along; nx = 1; ny = 0
    } else if (distance < 2 * frameWidth + frameHeight) {
      const along = distance - frameWidth - frameHeight
      x = halfWidth - along; y = -halfHeight; nx = 0; ny = -1
    } else {
      const along = distance - 2 * frameWidth - frameHeight
      x = -halfWidth; y = -halfHeight + along; nx = -1; ny = 0
    }
    positions.set([x, y, 0.045], i * 3)
    normals.set([nx, ny], i * 2)
    sizes[i] = GALLERY_ART.frameParticleSize[0] + randomForParticle() * (GALLERY_ART.frameParticleSize[1] - GALLERY_ART.frameParticleSize[0])
    phases[i] = randomForParticle() * Math.PI * 2
    speeds[i] = 0.22 + randomForParticle() * 0.42
    alphas[i] = 0.24 + randomForParticle() * 0.36
    mobility[i] = randomForParticle() < 0.2 ? 1 : 0
    colors.set(palette[Math.floor(randomForParticle() * palette.length)]!, i * 3)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal2d', new BufferAttribute(normals, 2))
  geometry.setAttribute('size', new BufferAttribute(sizes, 1))
  geometry.setAttribute('phase', new BufferAttribute(phases, 1))
  geometry.setAttribute('speed', new BufferAttribute(speeds, 1))
  geometry.setAttribute('particleAlpha', new BufferAttribute(alphas, 1))
  geometry.setAttribute('mobility', new BufferAttribute(mobility, 1))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}
