import { BufferAttribute, BufferGeometry } from 'three'
import { GALLERY_ART } from './artDirection'
import type { SceneComposerConfig } from '../../systems/scene-config/config'

function random(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x100000000
  }
}

/** Samples a quiet, deterministic point outline along a rectangular photo frame. */
export function createFrameParticleGeometry(
  width: number,
  height: number,
  seed: number,
  settings?: Readonly<Pick<SceneComposerConfig['scenes']['gallery'], 'frameIntensity'>>,
  spacing: number = GALLERY_ART.frameParticleSpacing,
  margin = 0.06,
) {
  const frameMargin = Number.isFinite(margin) ? Math.max(0, margin) : 0.06
  const particleSpacing = Number.isFinite(spacing) ? Math.max(0.01, spacing) : GALLERY_ART.frameParticleSpacing
  const frameWidth = width + frameMargin * 2
  const frameHeight = height + frameMargin * 2
  const halfWidth = frameWidth / 2
  const halfHeight = frameHeight / 2
  const perimeterDistances: number[] = []
  let edgeOffset = 0
  for (const edgeLength of [frameWidth, frameHeight, frameWidth, frameHeight]) {
    const edgeCount = Math.max(1, Math.floor(edgeLength / particleSpacing))
    for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex++) {
      perimeterDistances.push(edgeOffset + (edgeIndex + 1) / (edgeCount + 1) * edgeLength)
    }
    edgeOffset += edgeLength
  }
  const perimeterCount = perimeterDistances.length
  const cornerCount = 4
  const count = perimeterCount + cornerCount
  const corners = [
    [-halfWidth, halfHeight],
    [halfWidth, halfHeight],
    [halfWidth, -halfHeight],
    [-halfWidth, -halfHeight],
  ] as const
  const requestedIntensity = settings?.frameIntensity ?? 1
  const intensity = Number.isFinite(requestedIntensity) ? Math.max(0, Math.min(2, requestedIntensity)) : 1
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
    [0.91, 0.85, 0.76], // champagne pearl
    [0.74, 0.77, 0.80], // soft silver
    [0.82, 0.67, 0.60], // quiet blush
  ] as const

  for (let i = 0; i < count; i++) {
    const isCorner = i >= perimeterCount
    let x: number
    let y: number
    let nx: number
    let ny: number
    if (isCorner) {
      const corner = corners[i - perimeterCount]!
      x = corner[0]
      y = corner[1]
      nx = 0
      ny = 0
    } else {
      const distance = perimeterDistances[i]!
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
    }
    positions.set([x, y, 0.045], i * 3)
    normals.set([nx, ny], i * 2)
    sizes[i] = isCorner
      ? 0.095 + randomForParticle() * 0.035
      : GALLERY_ART.frameParticleSize[0] + randomForParticle() * (GALLERY_ART.frameParticleSize[1] - GALLERY_ART.frameParticleSize[0])
    phases[i] = randomForParticle() * Math.PI * 2
    speeds[i] = isCorner ? 0.12 + randomForParticle() * 0.1 : 0.22 + randomForParticle() * 0.42
    const baseAlpha = isCorner ? 0.5 + randomForParticle() * 0.18 : 0.16 + randomForParticle() * 0.22
    alphas[i] = Math.min(1, baseAlpha * intensity)
    mobility[i] = !isCorner && randomForParticle() < 0.2 ? 1 : 0
    const color = isCorner ? [0.98, 0.86, 0.70] as const : palette[Math.floor(randomForParticle() * palette.length)]!
    colors.set(color, i * 3)
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
